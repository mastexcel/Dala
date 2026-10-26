import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { PaymentRequest } from '@prisma/client';
import {
  AML_LARGE_TRANSACTION,
  CI_MOBILE_MONEY,
  PAYMENT_REQUEST_TTL_HOURS,
  checkKycLimit,
  formatFCFA,
  operatorMatchesPhone,
  type KycLevel,
  type PaymentRequestDTO,
} from '@dala/shared';
import { config } from '../config';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { randomToken, transactionReference } from '../lib/crypto';
import { validate } from '../middleware/validate';
import { requireStrongAuth, type AuthedRequest } from '../middleware/auth';
import { enforceKycLimit, monthToDateVolume, requireKycLevel } from '../middleware/kyc';
import { amlScreen } from '../middleware/aml';
import { appendAudit } from '../services/audit';
import { post } from '../services/ledger';
import { getProvider, PROVIDER_IDS, type MobileMoneyProviderId } from '../services/mobileMoney';
import { emitBalanceChanged, notify } from '../services/notifications';
import { assertClientFundsCapacity, isProviderEnabled } from '../services/testPhase';
import { phoneSchema } from './auth';

/** Demandes de paiement de l'utilisateur connecté. */
export const router = Router();
/** Paiement public d'une demande (le payeur n'a pas de compte DALA). */
export const publicRouter = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;

const ENABLED_PROVIDERS = PROVIDER_IDS.filter(isProviderEnabled) as [MobileMoneyProviderId, ...MobileMoneyProviderId[]];

/** Lien public : PUBLIC_URL si défini (domaine de production), sinon l'hôte de la requête. */
const baseUrl = (req: Request) => (config.PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

/** Code court lisible (sans 0/O ni 1/I pour éviter les confusions). */
export function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = Buffer.from(randomToken(16), 'base64url');
  return Array.from(bytes.subarray(0, 8), (b) => alphabet[b % alphabet.length]).join('');
}

function dto(r: PaymentRequest, base: string): PaymentRequestDTO {
  const expired = r.status === 'OPEN' && r.expiresAt < new Date();
  return {
    id: r.id,
    code: r.code,
    amount: num(r.amount),
    note: r.note,
    status: expired ? 'EXPIRED' : r.status,
    expiresAt: r.expiresAt.toISOString(),
    paidAt: r.paidAt?.toISOString() ?? null,
    url: `${base}/pay/${r.code}`,
    createdAt: r.createdAt.toISOString(),
  };
}

/* ------------------------------ Utilisateur ------------------------------ */

const createSchema = z.object({ amount: z.number().int().min(100).max(AML_LARGE_TRANSACTION), note: z.string().trim().max(140).optional() });

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { amount, note } = req.body as z.infer<typeof createSchema>;
    const r = await prisma.paymentRequest.create({
      data: { code: newCode(), userId: uid(req), amount, note: note || null, expiresAt: new Date(Date.now() + PAYMENT_REQUEST_TTL_HOURS * 3_600_000) },
    });
    res.status(201).json(dto(r, baseUrl(req)));
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await prisma.paymentRequest.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' }, take: 20 });
    res.json(list.map((r) => dto(r, baseUrl(req))));
  }),
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const done = await prisma.paymentRequest.updateMany({ where: { id: req.params.id, userId: uid(req), status: 'OPEN' }, data: { status: 'CANCELLED' } });
    if (!done.count) throw conflict('Cette demande ne peut plus être annulée');
    res.status(204).end();
  }),
);

/**
 * Payer une demande DALA avec son solde (QR ou lien scanné dans l'application).
 * Le montant est renvoyé par le client et doit correspondre à la demande : il sert aux contrôles
 * habituels (PIN au-delà de 50 000 FCFA, plafonds KYC des transferts, LBC/FT).
 */
const payWithBalanceSchema = z.object({ amount: z.number().int().positive() });
router.post(
  '/by-code/:code/pay',
  requireKycLevel(2),
  validate(payWithBalanceSchema),
  requireStrongAuth('PAYMENT', (req) => (req.body as { amount: number }).amount),
  enforceKycLimit((req) => (req.body as { amount: number }).amount, { isTransfer: true }),
  amlScreen((req) => (req.body as { amount: number }).amount),
  asyncHandler(async (req, res) => {
    const payerId = uid(req);
    const r = await prisma.paymentRequest.findUnique({ where: { code: req.params.code.toUpperCase() }, include: { user: true } });
    if (!r) throw notFound('Demande de paiement introuvable');
    const amount = num(r.amount);
    if ((req.body as { amount: number }).amount !== amount) throw badRequest('Le montant ne correspond pas à la demande', 'AMOUNT_MISMATCH');
    if (r.userId === payerId) throw badRequest('Vous ne pouvez pas payer votre propre demande');
    if (r.status !== 'OPEN' || r.expiresAt < new Date()) throw conflict('Cette demande n’est plus active', 'REQUEST_CLOSED');
    if (r.user.status !== 'ACTIVE') throw forbidden('Le bénéficiaire ne peut pas recevoir de paiement pour le moment', 'BENEFICIARY_UNAVAILABLE');
    const payer = await prisma.user.findUniqueOrThrow({ where: { id: payerId } });
    await prisma.$transaction(async (t) => {
      const reserved = await t.paymentRequest.updateMany({ where: { id: r.id, status: 'OPEN' }, data: { status: 'PAID', paidAt: new Date(), payerPhone: payer.phone, provider: 'DALA' } });
      if (!reserved.count) throw conflict('Cette demande n’est plus active', 'REQUEST_CLOSED');
      await post(t, { userId: payerId, type: 'TRANSFER_OUT', amount, description: `Paiement à ${r.user.firstName} ${r.user.lastName[0]}.${r.note ? ` · ${r.note}` : ''}`, from: 'MAIN', to: null, metadata: { paymentRequestId: r.id, to: r.userId } });
      const credit = await post(t, { userId: r.userId, type: 'TRANSFER_IN', amount, description: `Paiement reçu de ${payer.firstName} ${payer.lastName[0]}.${r.note ? ` · ${r.note}` : ''}`, from: null, to: 'MAIN', metadata: { paymentRequestId: r.id, from: payerId } });
      await t.paymentRequest.update({ where: { id: r.id }, data: { transactionId: credit.id } });
      await appendAudit(t, { userId: r.userId, action: 'PAYMENT_REQUEST_PAID', entity: 'PaymentRequest', entityId: r.id, payload: { amount, provider: 'DALA' } });
    });
    await Promise.all([
      notify(payerId, { title: 'Paiement effectué', body: `${formatFCFA(amount)} payés à ${r.user.firstName}`, type: 'TRANSACTION' }),
      notify(r.userId, { title: 'Paiement reçu 💸', body: `${payer.firstName} vous a payé ${formatFCFA(amount)}`, type: 'TRANSACTION' }),
    ]);
    emitBalanceChanged(payerId);
    emitBalanceChanged(r.userId);
    res.status(201).json({ status: 'PAID' });
  }),
);

/* ------------------------------ Paiement public ------------------------------ */

/** Limite les tentatives de paiement par adresse IP (le lien est public). */
const payLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.', code: 'RATE_LIMITED' } });

async function findOpen(code: string) {
  const r = await prisma.paymentRequest.findUnique({ where: { code: code.toUpperCase() }, include: { user: { select: { id: true, firstName: true, lastName: true, kycLevel: true, status: true } } } });
  if (!r) throw notFound('Demande de paiement introuvable');
  return r;
}

publicRouter.get(
  '/:code',
  asyncHandler(async (req, res) => {
    const r = await findOpen(req.params.code);
    res.json({
      ...dto(r, baseUrl(req)),
      beneficiary: `${r.user.firstName} ${r.user.lastName[0]}.`,
      providers: CI_MOBILE_MONEY.filter((o) => isProviderEnabled(o.id)).map((o) => ({ id: o.id, name: o.name, prefix: o.prefix })),
    });
  }),
);

const paySchema = z.object({ provider: z.enum(ENABLED_PROVIDERS), phone: phoneSchema });

publicRouter.post(
  '/:code',
  payLimiter,
  validate(paySchema),
  asyncHandler(async (req, res) => {
    const { provider, phone } = req.body as z.infer<typeof paySchema>;
    const r = await findOpen(req.params.code);
    if (r.status !== 'OPEN') throw conflict(r.status === 'PAID' ? 'Cette demande a déjà été payée' : 'Cette demande n’est plus active', 'REQUEST_CLOSED');
    if (r.expiresAt < new Date()) throw conflict('Cette demande a expiré', 'REQUEST_CLOSED');
    if (r.user.status !== 'ACTIVE') throw forbidden('Le bénéficiaire ne peut pas recevoir de paiement pour le moment', 'BENEFICIARY_UNAVAILABLE');
    if (phone.startsWith('+225') && !operatorMatchesPhone(provider, phone)) {
      const op = CI_MOBILE_MONEY.find((o) => o.id === provider);
      throw badRequest(`Ce numéro n'est pas un numéro ${op?.name ?? provider}${op?.prefix ? ` (préfixe ${op.prefix})` : ''}.`, 'OPERATOR_MISMATCH');
    }
    const amount = num(r.amount);
    // Plafonds du bénéficiaire (KYC) et de la phase de test (fonds clients).
    const kyc = checkKycLimit({ kycLevel: r.user.kycLevel as KycLevel, monthToDateVolume: await monthToDateVolume(r.user.id), amount });
    if (!kyc.allowed) throw forbidden('Le bénéficiaire a atteint son plafond mensuel', 'KYC_LIMIT');
    await prisma.$transaction((t) => assertClientFundsCapacity(t, amount));

    // Réservation : une seule tentative de paiement à la fois pour une demande.
    const reserved = await prisma.paymentRequest.updateMany({ where: { id: r.id, status: 'OPEN' }, data: { status: 'PENDING', payerPhone: phone, provider } });
    if (!reserved.count) throw conflict('Un paiement est déjà en cours pour cette demande', 'REQUEST_CLOSED');

    const p = getProvider(provider);
    const reference = transactionReference();
    const masked = `${phone.slice(0, 7)}…${phone.slice(-2)}`;
    const description = `Paiement reçu · ${p.name} ${masked}${r.note ? ` · ${r.note}` : ''}`;
    const result = await p.deposit(phone, amount, reference);
    if (result.status === 'FAILED') {
      await prisma.paymentRequest.update({ where: { id: r.id }, data: { status: 'OPEN', payerPhone: null, provider: null } });
      throw badRequest(result.message ?? "Paiement refusé par l'opérateur", 'PROVIDER_FAILED');
    }
    const metadata = { provider, payerPhone: phone, paymentRequestId: r.id, providerReference: result.providerReference };
    if (result.status === 'SUCCESS') {
      const tx = await prisma.$transaction(async (t) => {
        const created = await post(t, { userId: r.user.id, type: 'TRANSFER_IN', amount, description, from: null, to: 'MAIN', metadata });
        await t.paymentRequest.update({ where: { id: r.id }, data: { status: 'PAID', paidAt: new Date(), transactionId: created.id } });
        await appendAudit(t, { userId: r.user.id, action: 'PAYMENT_REQUEST_PAID', entity: 'PaymentRequest', entityId: r.id, payload: { amount, provider } });
        return created;
      });
      await notify(r.user.id, { title: 'Paiement reçu 💸', body: `${formatFCFA(amount)} reçus via ${p.name}`, type: 'TRANSACTION' });
      emitBalanceChanged(r.user.id);
      return res.status(201).json({ status: 'PAID', transactionId: tx.id });
    }
    // En attente : l'opérateur confirme par webhook (validation sur le téléphone du payeur).
    const tx = await prisma.transaction.create({ data: { userId: r.user.id, type: 'TRANSFER_IN', amount, description, reference, status: 'PENDING', metadata } });
    await prisma.paymentRequest.update({ where: { id: r.id }, data: { transactionId: tx.id } });
    res.status(202).json({ status: 'PENDING', message: 'Validez le paiement sur votre téléphone.' });
  }),
);
