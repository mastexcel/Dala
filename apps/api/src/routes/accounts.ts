import { Router } from 'express';
import { z } from 'zod';
import { CI_MOBILE_MONEY, eligibleLoanAmount, formatFCFA, operatorMatchesPhone, type BalanceSummary } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, badRequest, notFound } from '../lib/errors';
import { transactionReference } from '../lib/crypto';
import { validate } from '../middleware/validate';
import { requireStrongAuth, type AuthedRequest } from '../middleware/auth';
import { enforceKycLimit, requireKycLevel } from '../middleware/kyc';
import { amlScreen } from '../middleware/aml';
import { balances, post } from '../services/ledger';
import { appendAudit } from '../services/audit';
import { getProvider, PROVIDER_IDS, type MobileMoneyProviderId } from '../services/mobileMoney';
import { emitBalanceChanged, notify } from '../services/notifications';
import { assertClientFundsCapacity, isProviderEnabled } from '../services/testPhase';
import { payoutToMobileMoney } from '../services/payouts';
import { phoneSchema } from './auth';

export const router = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;
const amountOf = (req: { body: { amount: number } }) => req.body.amount;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const accounts = await prisma.account.findMany({ where: { userId: uid(req) } });
    res.json(accounts.map((a) => ({ id: a.id, type: a.type, balance: num(a.balance), currency: a.currency })));
  }),
);

/** Données du tableau de bord (solde total, répartition, variation du mois). */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [b, goals, user, loans, activeProjects, monthTx] = await Promise.all([
      balances(userId),
      prisma.savingsGoal.findMany({ where: { userId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.loan.findMany({ where: { userId, status: { in: ['DISBURSED', 'OVERDUE'] } } }),
      prisma.crowdfundInvestment.findMany({ where: { userId, status: { in: ['PENDING', 'CONFIRMED'] } }, distinct: ['projectId'], select: { projectId: true } }),
      prisma.transaction.findMany({ where: { userId, createdAt: { gte: startOfMonth }, status: 'COMPLETED', type: { in: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'ESCROW_RELEASE', 'INVESTMENT_RETURN', 'CROWDFUND_RETURN', 'FEE'] } } }),
    ]);
    const creditOutstanding = loans.reduce((s, l) => s + num(l.totalDue) - num(l.amountPaid), 0);
    const total = b.MAIN + b.SAVINGS + b.VAULT + b.INVESTMENT + b.CROWDFUND + b.ESCROW;
    const monthDelta = monthTx.reduce((s, t) => s + num(t.amount), 0);
    const summary: BalanceSummary = {
      total,
      main: b.MAIN,
      savings: b.SAVINGS,
      savingsTarget: goals.reduce((s, g) => s + num(g.targetAmount), 0),
      vault: b.VAULT,
      investments: b.INVESTMENT,
      crowdfund: b.CROWDFUND,
      escrow: b.ESCROW,
      crowdfundActiveProjects: activeProjects.length,
      creditOutstanding,
      creditEligible: creditOutstanding > 0 ? 0 : eligibleLoanAmount(user.creditScore),
      monthDelta,
      monthDeltaPct: total - monthDelta > 0 ? monthDelta / (total - monthDelta) : 0,
    };
    res.json(summary);
  }),
);

/** Contrôle opérateur / préfixe pour les numéros ivoiriens (les autres pays UEMOA ne sont pas vérifiés). */
const fitsOperator = (provider: MobileMoneyProviderId, phone: string) => !phone.startsWith('+225') || operatorMatchesPhone(provider, phone);

/** Message d'erreur quand le numéro n'appartient pas à l'opérateur choisi (préfixes ivoiriens). */
export function operatorMismatch(provider: string, phone: string) {
  const op = CI_MOBILE_MONEY.find((o) => o.id === provider);
  return op?.prefix ? `Ce numéro (${phone}) n'est pas un numéro ${op.name} : les numéros ${op.name} commencent par ${op.prefix}.` : 'Numéro mobile money invalide';
}

const mmSchema = z.object({
  // Opérateurs dont le statut n'est pas vérifié (Wave) : refusés pendant la phase de test.
  provider: z.enum(PROVIDER_IDS.filter(isProviderEnabled) as [MobileMoneyProviderId, ...MobileMoneyProviderId[]]),
  amount: z.number().int().min(100).max(10_000_000),
  phone: phoneSchema.optional(),
});

/** Dépôt depuis un wallet mobile money (Orange Money, MTN MoMo, Wave, Moov). */
router.post(
  '/deposit',
  validate(mmSchema),
  enforceKycLimit(amountOf),
  amlScreen(amountOf),
  asyncHandler(async (req, res) => {
    const { provider, amount, phone } = req.body as z.infer<typeof mmSchema>;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    // Le dépôt peut venir d'un autre numéro de l'utilisateur (ex. son numéro Orange s'il est inscrit avec MTN).
    if (!fitsOperator(provider, phone ?? user.phone)) throw badRequest(operatorMismatch(provider, phone ?? user.phone), 'OPERATOR_MISMATCH');
    // Plafond des fonds clients de la phase de test, vérifié avant d'appeler l'opérateur.
    await prisma.$transaction((tx) => assertClientFundsCapacity(tx, amount));
    const reference = transactionReference();
    const p = getProvider(provider);
    const result = await p.deposit(phone ?? user.phone, amount, reference);
    if (result.status === 'FAILED') throw badRequest(result.message ?? 'Paiement refusé par l\'opérateur', 'PROVIDER_FAILED');
    const tx = await prisma.$transaction((t) =>
      result.status === 'SUCCESS'
        ? post(t, { userId: user.id, type: 'DEPOSIT', amount, description: `Dépôt ${p.name}`, from: null, to: 'MAIN', metadata: { provider, providerReference: result.providerReference } })
        : t.transaction.create({ data: { userId: user.id, type: 'DEPOSIT', amount, description: `Dépôt ${p.name}`, reference, status: 'PENDING', metadata: { provider, providerReference: result.providerReference } } }),
    );
    if (result.status === 'SUCCESS') {
      await notify(user.id, { title: 'Dépôt reçu', body: `${formatFCFA(amount)} via ${p.name}`, type: 'TRANSACTION' });
      emitBalanceChanged(user.id);
    }
    res.status(result.status === 'SUCCESS' ? 201 : 202).json({ status: result.status, transactionId: tx.id });
  }),
);

/** Retrait vers un wallet mobile money de l'utilisateur. */
router.post(
  '/withdraw',
  validate(mmSchema),
  requireStrongAuth('PAYMENT', amountOf),
  enforceKycLimit(amountOf),
  amlScreen(amountOf),
  asyncHandler(async (req, res) => {
    const { provider, amount, phone } = req.body as z.infer<typeof mmSchema>;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    const to = phone ?? user.phone;
    if (!fitsOperator(provider, to)) throw badRequest(operatorMismatch(provider, to), 'OPERATOR_MISMATCH');
    const r = await payoutToMobileMoney({ userId: user.id, provider, phone: to, amount, type: 'WITHDRAWAL', description: `Retrait ${getProvider(provider).name}` });
    await notify(user.id, { title: 'Retrait effectué', body: `${formatFCFA(amount)} vers ${r.providerName}`, type: 'TRANSACTION' });
    emitBalanceChanged(user.id);
    res.status(201).json({ status: r.status, transactionId: r.transactionId });
  }),
);

/**
 * Envoi vers le mobile money d'un tiers, sur n'importe quel opérateur ouvert (Orange, MTN, Moov…).
 * Assimilé à un transfert : KYC niveau 2 et authentification forte au-delà de 50 000 FCFA.
 */
const sendMmSchema = mmSchema.extend({ phone: phoneSchema, note: z.string().max(140).optional() });
router.post(
  '/send-mobile-money',
  requireKycLevel(2),
  validate(sendMmSchema),
  requireStrongAuth('PAYMENT', amountOf),
  enforceKycLimit(amountOf, { isTransfer: true }),
  amlScreen(amountOf),
  asyncHandler(async (req, res) => {
    const { provider, amount, phone, note } = req.body as z.infer<typeof sendMmSchema>;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    if (!fitsOperator(provider, phone)) throw badRequest(operatorMismatch(provider, phone), 'OPERATOR_MISMATCH');
    const name = getProvider(provider).name;
    const masked = `${phone.slice(0, 7)}…${phone.slice(-2)}`;
    const r = await payoutToMobileMoney({ userId: user.id, provider, phone, amount, type: 'TRANSFER_OUT', description: `Envoi ${name} · ${masked}`, metadata: { channel: 'MOBILE_MONEY', note } });
    await notify(user.id, { title: 'Envoi effectué', body: `${formatFCFA(amount)} envoyés vers ${name} (${masked})`, type: 'TRANSACTION' });
    emitBalanceChanged(user.id);
    res.status(201).json({ status: r.status, transactionId: r.transactionId });
  }),
);

/** Transfert DALA → DALA (KYC niveau 2 minimum, ajout bénéficiaire = authentification forte). */
const transferSchema = z.object({ toPhone: phoneSchema, amount: z.number().int().min(100), note: z.string().max(140).optional() });
router.post(
  '/transfer',
  requireKycLevel(2),
  validate(transferSchema),
  requireStrongAuth('PAYMENT', amountOf),
  enforceKycLimit(amountOf, { isTransfer: true }),
  amlScreen(amountOf),
  asyncHandler(async (req, res) => {
    const { toPhone, amount, note } = req.body as z.infer<typeof transferSchema>;
    const sender = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    const recipient = await prisma.user.findUnique({ where: { phone: toPhone } });
    if (!recipient) throw notFound('Destinataire introuvable sur DALA');
    if (recipient.id === sender.id) throw badRequest('Impossible de vous envoyer de l\'argent à vous-même');
    await prisma.$transaction(async (t) => {
      await post(t, { userId: sender.id, type: 'TRANSFER_OUT', amount, description: `Envoi à ${recipient.firstName} ${recipient.lastName[0]}.`, from: 'MAIN', to: null, metadata: { to: recipient.id, note } });
      await post(t, { userId: recipient.id, type: 'TRANSFER_IN', amount, description: `Reçu de ${sender.firstName} ${sender.lastName[0]}.`, from: null, to: 'MAIN', metadata: { from: sender.id, note } });
    });
    await Promise.all([
      notify(sender.id, { title: 'Envoi effectué', body: `${formatFCFA(amount)} envoyés à ${recipient.firstName}`, type: 'TRANSACTION' }),
      notify(recipient.id, { title: 'Argent reçu 💸', body: `${sender.firstName} vous a envoyé ${formatFCFA(amount)}`, type: 'TRANSACTION' }),
    ]);
    emitBalanceChanged(sender.id);
    emitBalanceChanged(recipient.id);
    res.status(201).json({ ok: true });
  }),
);
