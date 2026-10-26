import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Escrow, EscrowEvent, EscrowRole, User } from '@prisma/client';
import { ESCROW_CLOSED, TRUSTY, escrowActions, formatFCFA, type EscrowAction, type EscrowDTO } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireAdmin, requireStrongAuth, verifyPin, type AuthedRequest } from '../middleware/auth';
import { enforceKycLimit, requireKycLevel } from '../middleware/kyc';
import { amlScreen } from '../middleware/aml';
import { appendAudit } from '../services/audit';
import { ensureAccounts, post } from '../services/ledger';
import { emitBalanceChanged, notify } from '../services/notifications';
import { addEvent, notifySettlement, refundBuyer, releaseToSeller, settle, transition } from '../services/trusty';
import { phoneSchema } from './auth';
import { newCode } from './payments';

/** Trusty : transactions sécurisées par séquestre entre deux utilisateurs DALA. */
export const router = Router();
/** Médiation des litiges (back-office, clé x-admin-key). */
export const deskRouter = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;

type Party = Pick<User, 'id' | 'firstName' | 'lastName' | 'phone'>;
type Full = Escrow & { buyer: Party; seller: Party; events: EscrowEvent[] };
const party = { select: { id: true, firstName: true, lastName: true, phone: true } } as const;
const include = { buyer: party, seller: party, events: { orderBy: { createdAt: 'asc' as const } } };
const short = (u: Party) => `${u.firstName} ${u.lastName[0]}.`;

/** Transactions Trusty menées à bien : indicateur de confiance affiché à l'autre participant. */
const completedDeals = (userId: string) => prisma.escrow.count({ where: { status: 'RELEASED', OR: [{ buyerId: userId }, { sellerId: userId }] } });

async function dto(e: Full, role: EscrowRole, now = new Date()): Promise<EscrowDTO> {
  const other = role === 'BUYER' ? e.seller : e.buyer;
  const resolved = e.sellerAmount !== null && e.buyerAmount !== null;
  return {
    id: e.id,
    code: e.code,
    title: e.title,
    description: e.description,
    amount: num(e.amount),
    role,
    initiator: e.initiator,
    status: e.status,
    counterparty: { name: short(other), phone: other.phone, completedDeals: await completedDeals(other.id) },
    deliveryDays: e.deliveryDays,
    inspectionHours: e.inspectionHours,
    deliveryDeadline: e.deliveryDeadline?.toISOString() ?? null,
    inspectionEndsAt: e.inspectionEndsAt?.toISOString() ?? null,
    fundedAt: e.fundedAt?.toISOString() ?? null,
    deliveredAt: e.deliveredAt?.toISOString() ?? null,
    closedAt: e.closedAt?.toISOString() ?? null,
    deliveryNote: e.deliveryNote,
    releaseCode: role === 'BUYER' && (e.status === 'FUNDED' || e.status === 'DELIVERED') ? e.releaseCode : null,
    codeAttemptsLeft: Math.max(0, TRUSTY.maxCodeAttempts - e.codeAttempts),
    resolution: resolved ? { sellerAmount: num(e.sellerAmount), buyerAmount: num(e.buyerAmount), note: e.resolutionNote ?? '' } : null,
    actions: escrowActions(e, role, now),
    events: e.events.map((v) => ({ id: v.id, actor: v.actor, type: v.type, message: v.message, createdAt: v.createdAt.toISOString() })),
    createdAt: e.createdAt.toISOString(),
  };
}

/** Séquestre de l'utilisateur connecté et son rôle. */
async function load(req: unknown, id: string) {
  const me = uid(req);
  const e = await prisma.escrow.findFirst({ where: { id, OR: [{ buyerId: me }, { sellerId: me }] }, include });
  if (!e) throw notFound('Transaction Trusty introuvable');
  return { e, role: (e.buyerId === me ? 'BUYER' : 'SELLER') as EscrowRole };
}

function allow(e: Escrow, role: EscrowRole, action: EscrowAction) {
  if (!escrowActions(e, role).includes(action)) throw conflict('Action impossible à cette étape de la transaction', 'ESCROW_STATE');
}

const reply = async (req: unknown, res: { json: (b: unknown) => void }, id: string) => {
  const { e, role } = await load(req, id);
  res.json(await dto(e, role));
};

const other = (e: Escrow, role: EscrowRole) => (role === 'BUYER' ? e.sellerId : e.buyerId);
const ping = (userId: string, e: Escrow, title: string, body: string) => notify(userId, { title, body, type: 'TRANSACTION', data: { escrowId: e.id } });

/* ------------------------------ Participants ------------------------------ */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const me = uid(req);
    const list = await prisma.escrow.findMany({ where: { OR: [{ buyerId: me }, { sellerId: me }] }, orderBy: { updatedAt: 'desc' }, take: 50, include });
    res.json(await Promise.all(list.map((e) => dto(e, e.buyerId === me ? 'BUYER' : 'SELLER'))));
  }),
);

router.get('/:id', asyncHandler(async (req, res) => reply(req, res, req.params.id)));

const createSchema = z.object({
  /** Mon rôle dans la transaction. */
  role: z.enum(['BUYER', 'SELLER']),
  counterpartyPhone: phoneSchema,
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(1_000).optional(),
  amount: z.number().int().min(TRUSTY.minAmount).max(TRUSTY.maxAmount),
  deliveryDays: z.number().int().refine((d) => (TRUSTY.deliveryDaysOptions as readonly number[]).includes(d)).default(TRUSTY.defaultDeliveryDays),
  inspectionHours: z.number().int().refine((h) => (TRUSTY.inspectionHoursOptions as readonly number[]).includes(h)).default(TRUSTY.defaultInspectionHours),
});

router.post(
  '/',
  requireKycLevel(2),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof createSchema>;
    const me = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    const counterpart = await prisma.user.findUnique({ where: { phone: b.counterpartyPhone } });
    if (!counterpart || counterpart.status !== 'ACTIVE') throw notFound("Ce numéro n'a pas de compte DALA actif. Invitez la personne à s'inscrire pour utiliser Trusty.");
    if (counterpart.id === me.id) throw badRequest('Vous ne pouvez pas traiter avec vous-même');
    const [buyer, seller] = b.role === 'BUYER' ? [me, counterpart] : [counterpart, me];
    const e = await prisma.escrow.create({
      data: {
        code: newCode(),
        title: b.title,
        description: b.description || null,
        amount: b.amount,
        buyerId: buyer.id,
        sellerId: seller.id,
        initiator: b.role,
        deliveryDays: b.deliveryDays,
        inspectionHours: b.inspectionHours,
        expiresAt: new Date(Date.now() + TRUSTY.proposalTtlDays * 86_400_000),
        events: { create: { actor: b.role, type: 'PROPOSED', message: `${me.firstName} propose la transaction : ${formatFCFA(b.amount)}, livraison sous ${b.deliveryDays} j, vérification ${b.inspectionHours} h.` } },
      },
      include,
    });
    await prisma.$transaction((t) => appendAudit(t, { userId: me.id, action: 'ESCROW_PROPOSED', entity: 'Escrow', entityId: e.id, payload: { amount: b.amount, role: b.role } }));
    await ping(counterpart.id, e, 'Nouvelle transaction Trusty', `${me.firstName} vous propose « ${b.title} » pour ${formatFCFA(b.amount)}. Vérifiez les conditions.`);
    res.status(201).json(await dto(e, b.role));
  }),
);

router.post(
  '/:id/accept',
  requireKycLevel(2),
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'accept');
    await prisma.$transaction(async (t) => {
      await transition(t, e.id, ['PROPOSED'], { status: 'ACCEPTED' });
      await addEvent(t, e.id, role, 'ACCEPTED', `${role === 'BUYER' ? 'L’acheteur' : 'Le vendeur'} accepte les conditions.`);
    });
    await ping(other(e, role), e, 'Transaction Trusty acceptée', role === 'SELLER' ? `« ${e.title} » : bloquez les fonds pour lancer la livraison.` : `« ${e.title} » : l'acheteur va bloquer les fonds.`);
    await reply(req, res, e.id);
  }),
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'cancel');
    await prisma.$transaction(async (t) => {
      await transition(t, e.id, ['PROPOSED', 'ACCEPTED'], { status: 'CANCELLED', closedAt: new Date() });
      await addEvent(t, e.id, role, 'CANCELLED', `${role === 'BUYER' ? 'L’acheteur' : 'Le vendeur'} annule la transaction (aucun fonds bloqué).`);
    });
    await ping(other(e, role), e, 'Transaction Trusty annulée', `« ${e.title} » a été annulée.`);
    await reply(req, res, e.id);
  }),
);

/** Blocage des fonds par l'acheteur : contrôles habituels d'un paiement (PIN, plafonds KYC, LBC/FT). */
const amountSchema = z.object({ amount: z.number().int().positive() });
const bodyAmount = (req: { body: unknown }) => (req.body as { amount: number }).amount;
router.post(
  '/:id/fund',
  requireKycLevel(2),
  validate(amountSchema),
  requireStrongAuth('PAYMENT', bodyAmount),
  enforceKycLimit(bodyAmount, { isTransfer: true }),
  amlScreen(bodyAmount),
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'fund');
    const amount = num(e.amount);
    if (bodyAmount(req) !== amount) throw badRequest('Le montant ne correspond pas à la transaction', 'AMOUNT_MISMATCH');
    const now = new Date();
    await prisma.$transaction(async (t) => {
      await ensureAccounts(t, e.buyerId);
      await transition(t, e.id, ['ACCEPTED'], {
        status: 'FUNDED',
        fundedAt: now,
        deliveryDeadline: new Date(now.getTime() + e.deliveryDays * 86_400_000),
        releaseCode: String(randomInt(0, 1_000_000)).padStart(6, '0'),
      });
      await post(t, { userId: e.buyerId, type: 'ESCROW_HOLD', amount, description: `Fonds bloqués Trusty · ${e.title}`, from: 'MAIN', to: 'ESCROW', metadata: { escrowId: e.id } });
      await addEvent(t, e.id, 'BUYER', 'FUNDED', `${formatFCFA(amount)} bloqués chez DALA. Le vendeur peut livrer en toute confiance.`);
    });
    emitBalanceChanged(e.buyerId);
    await ping(e.sellerId, e, 'Fonds sécurisés 🔒', `${formatFCFA(amount)} sont bloqués pour « ${e.title} ». Vous pouvez livrer : vous serez payé à la confirmation.`);
    await reply(req, res, e.id);
  }),
);

router.post(
  '/:id/deliver',
  validate(z.object({ note: z.string().trim().max(500).optional() })),
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'deliver');
    const note = (req.body as { note?: string }).note || null;
    const now = new Date();
    await prisma.$transaction(async (t) => {
      await transition(t, e.id, ['FUNDED'], { status: 'DELIVERED', deliveredAt: now, deliveryNote: note, inspectionEndsAt: new Date(now.getTime() + e.inspectionHours * 3_600_000) });
      await addEvent(t, e.id, 'SELLER', 'DELIVERED', `Le vendeur déclare la livraison${note ? ` : ${note}` : '.'} L'acheteur a ${e.inspectionHours} h pour vérifier.`);
    });
    await ping(e.buyerId, e, 'Livraison déclarée 📦', `« ${e.title} » : vérifiez puis confirmez la réception, ou signalez un problème sous ${e.inspectionHours} h. Sans réponse, le vendeur sera payé.`);
    await reply(req, res, e.id);
  }),
);

/** Remise en main propre : le vendeur saisit le code que lui donne l'acheteur. */
router.post(
  '/:id/redeem',
  validate(z.object({ code: z.string().trim().regex(/^\d{6}$/) })),
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'redeem');
    if ((req.body as { code: string }).code !== e.releaseCode) {
      const updated = await prisma.escrow.update({ where: { id: e.id }, data: { codeAttempts: { increment: 1 } } });
      const left = Math.max(0, TRUSTY.maxCodeAttempts - updated.codeAttempts);
      if (!left) {
        await prisma.escrowEvent.create({ data: { escrowId: e.id, actor: 'SYSTEM', type: 'CODE_LOCKED', message: "Trop de codes erronés : la saisie est bloquée. L'acheteur doit confirmer la réception dans l'application." } });
        await ping(e.buyerId, e, 'Code Trusty bloqué', `Plusieurs codes erronés ont été saisis pour « ${e.title} ». Ne communiquez votre code qu'à la remise du bien.`);
      }
      throw badRequest(left ? `Code incorrect. ${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}.` : 'Code incorrect. La saisie est bloquée.', 'INVALID_CODE', { attemptsLeft: left });
    }
    await releaseToSeller(e, 'SELLER', 'Code de remise validé à la livraison : fonds versés au vendeur.');
    await reply(req, res, e.id);
  }),
);

/** Confirmation de réception par l'acheteur : irréversible, le PIN est toujours demandé. */
router.post(
  '/:id/release',
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'release');
    const pin = req.header('x-transaction-pin');
    if (!pin) throw forbidden('Confirmation par PIN requise', 'STRONG_AUTH_REQUIRED');
    if (!(await verifyPin(uid(req), pin))) throw forbidden('PIN incorrect', 'INVALID_PIN');
    await releaseToSeller(e, 'BUYER', "L'acheteur confirme la réception : fonds versés au vendeur.");
    await reply(req, res, e.id);
  }),
);

router.post(
  '/:id/dispute',
  validate(z.object({ reason: z.string().trim().min(10).max(1_000) })),
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'dispute');
    const reason = (req.body as { reason: string }).reason;
    await prisma.$transaction(async (t) => {
      await transition(t, e.id, ['FUNDED', 'DELIVERED'], { status: 'DISPUTED' });
      await addEvent(t, e.id, 'BUYER', 'DISPUTED', `Litige ouvert par l'acheteur : ${reason}`);
      await addEvent(t, e.id, 'SYSTEM', 'MEDIATION', 'Les fonds restent bloqués. Un médiateur DALA examine les échanges et vous répond ici sous 48 h ouvrées. Ajoutez vos explications et preuves (numéro de suivi, description…).');
    });
    await ping(e.sellerId, e, 'Litige Trusty', `L'acheteur signale un problème sur « ${e.title} ». Répondez dans la transaction : un médiateur DALA va trancher.`);
    await reply(req, res, e.id);
  }),
);

/** Remboursement volontaire par le vendeur (bien indisponible, accord amiable). */
router.post(
  '/:id/refund',
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'refund');
    await refundBuyer(e, 'SELLER', "Le vendeur rembourse l'acheteur.", ['FUNDED', 'DELIVERED', 'DISPUTED']);
    await reply(req, res, e.id);
  }),
);

/** Délai de livraison dépassé : l'acheteur récupère ses fonds. */
router.post(
  '/:id/reclaim',
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'reclaim');
    await refundBuyer(e, 'BUYER', "Délai de livraison dépassé : l'acheteur récupère ses fonds.", ['FUNDED']);
    await reply(req, res, e.id);
  }),
);

router.post(
  '/:id/messages',
  validate(z.object({ message: z.string().trim().min(1).max(1_000) })),
  asyncHandler(async (req, res) => {
    const { e, role } = await load(req, req.params.id);
    allow(e, role, 'message');
    await addEvent(prisma, e.id, role, 'MESSAGE', (req.body as { message: string }).message);
    await ping(other(e, role), e, `Message Trusty · ${e.title}`, (req.body as { message: string }).message.slice(0, 120));
    res.status(201);
    await reply(req, res, e.id);
  }),
);

/* -------------------------------- Médiation -------------------------------- */

deskRouter.use(requireAdmin);

const deskView = (e: Full) => ({
  id: e.id,
  code: e.code,
  title: e.title,
  description: e.description,
  amount: num(e.amount),
  status: e.status,
  buyer: { name: `${e.buyer.firstName} ${e.buyer.lastName}`, phone: e.buyer.phone },
  seller: { name: `${e.seller.firstName} ${e.seller.lastName}`, phone: e.seller.phone },
  deliveryNote: e.deliveryNote,
  fundedAt: e.fundedAt,
  deliveredAt: e.deliveredAt,
  deliveryDeadline: e.deliveryDeadline,
  updatedAt: e.updatedAt,
  events: e.events.map((v) => ({ actor: v.actor, type: v.type, message: v.message, createdAt: v.createdAt })),
});

deskRouter.get(
  '/escrows',
  validate(z.object({ status: z.enum(['DISPUTED', 'ALL']).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const list = await prisma.escrow.findMany({
      where: req.query.status === 'ALL' ? {} : { status: 'DISPUTED' },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include,
    });
    res.json(list.map(deskView));
  }),
);

deskRouter.get(
  '/escrows/:id',
  asyncHandler(async (req, res) => {
    const e = await prisma.escrow.findUnique({ where: { id: req.params.id }, include });
    if (!e) throw notFound('Transaction Trusty introuvable');
    res.json(deskView(e));
  }),
);

const mediator = z.string().trim().min(2).max(60);

deskRouter.post(
  '/escrows/:id/messages',
  validate(z.object({ message: z.string().trim().min(1).max(2_000), authorName: mediator })),
  asyncHandler(async (req, res) => {
    const { message, authorName } = req.body as { message: string; authorName: string };
    const e = await prisma.escrow.findUnique({ where: { id: req.params.id } });
    if (!e) throw notFound('Transaction Trusty introuvable');
    if (ESCROW_CLOSED.includes(e.status)) throw conflict('Transaction terminée', 'ESCROW_STATE');
    await addEvent(prisma, e.id, 'MEDIATOR', 'MESSAGE', `${authorName} (médiation DALA) : ${message}`);
    await Promise.all([e.buyerId, e.sellerId].map((u) => ping(u, e, 'Message de la médiation Trusty', message.slice(0, 120))));
    res.status(201).json({ ok: true });
  }),
);

/** Décision du médiateur : part du vendeur (0 = remboursement total, montant entier = versement total). */
const resolveSchema = z.object({ sellerAmount: z.number().int().min(0), note: z.string().trim().min(10).max(1_000), authorName: mediator });

deskRouter.post(
  '/escrows/:id/resolve',
  validate(resolveSchema),
  asyncHandler(async (req, res) => {
    const { sellerAmount, note, authorName } = req.body as z.infer<typeof resolveSchema>;
    const e = await prisma.escrow.findUnique({ where: { id: req.params.id } });
    if (!e) throw notFound('Transaction Trusty introuvable');
    if (e.status !== 'DISPUTED') throw conflict('Seul un litige peut être tranché', 'ESCROW_STATE');
    const amount = num(e.amount);
    if (sellerAmount > amount) throw badRequest(`La part du vendeur ne peut pas dépasser ${formatFCFA(amount)}`);
    const buyerAmount = amount - sellerAmount;
    await prisma.$transaction(async (t) => {
      await transition(t, e.id, ['DISPUTED'], {
        status: sellerAmount > 0 ? 'RELEASED' : 'REFUNDED',
        closedAt: new Date(),
        sellerAmount,
        buyerAmount,
        resolutionNote: note,
        resolvedBy: authorName,
      });
      await settle(t, e, sellerAmount);
      await addEvent(t, e.id, 'MEDIATOR', 'RESOLVED', `Décision de ${authorName} (médiation DALA) : ${formatFCFA(sellerAmount)} au vendeur, ${formatFCFA(buyerAmount)} à l'acheteur. ${note}`);
      await appendAudit(t, { action: 'ESCROW_RESOLVED', entity: 'Escrow', entityId: e.id, payload: { sellerAmount, buyerAmount, mediator: authorName } });
    });
    await notifySettlement(e, sellerAmount);
    res.json({ status: sellerAmount > 0 ? 'RELEASED' : 'REFUNDED', sellerAmount, buyerAmount });
  }),
);
