import { Router } from 'express';
import { z } from 'zod';
import { addMonths, formatFCFA, VAULT_OPTIONS, vaultRate, type TontineDTO } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { goalDTO, vaultDTO } from '../lib/serialize';
import { validate } from '../middleware/validate';
import { requireStrongAuth, type AuthedRequest } from '../middleware/auth';
import { enforceKycLimit } from '../middleware/kyc';
import { amlScreen } from '../middleware/aml';
import { post } from '../services/ledger';
import { emitBalanceChanged, notify } from '../services/notifications';
import { beneficiaryPosition, nextContributionDate, potAmount } from '../services/tontine';

export const router = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;
const amountOf = (req: { body: { amount: number } }) => req.body.amount;
const frequency = z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']);

/* ----------------------------- Objectifs ----------------------------- */

router.get(
  '/goals',
  asyncHandler(async (req, res) => {
    const goals = await prisma.savingsGoal.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' } });
    res.json(goals.map(goalDTO));
  }),
);

const goalSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    targetAmount: z.number().int().min(1_000),
    deadline: z.coerce.date().optional(),
    autoSave: z.boolean().default(false),
    frequency: frequency.optional(),
    autoAmount: z.number().int().min(100).optional(),
    icon: z.string().max(30).default('target'),
  })
  .refine((g) => !g.autoSave || (g.frequency && g.autoAmount), { message: "Fréquence et montant requis pour l'épargne automatique" })
  .refine((g) => !g.deadline || g.deadline > new Date(), { message: 'La date limite doit être future' });

router.post(
  '/goals',
  validate(goalSchema),
  asyncHandler(async (req, res) => {
    const goal = await prisma.savingsGoal.create({ data: { ...(req.body as z.infer<typeof goalSchema>), userId: uid(req) } });
    res.status(201).json(goalDTO(goal));
  }),
);

router.patch(
  '/goals/:id',
  validate(z.object({ autoSave: z.boolean().optional(), frequency: frequency.optional(), autoAmount: z.number().int().min(100).optional(), name: z.string().min(2).optional() })),
  asyncHandler(async (req, res) => {
    const goal = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: uid(req) } });
    if (!goal) throw notFound();
    res.json(goalDTO(await prisma.savingsGoal.update({ where: { id: goal.id }, data: req.body })));
  }),
);

router.post(
  '/goals/:id/deposit',
  validate(z.object({ amount: z.number().int().min(100) })),
  requireStrongAuth('PAYMENT', amountOf),
  asyncHandler(async (req, res) => {
    const { amount } = req.body as { amount: number };
    const goal = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: uid(req) } });
    if (!goal) throw notFound();
    const updated = await prisma.$transaction(async (tx) => {
      await post(tx, { userId: goal.userId, type: 'SAVINGS_IN', amount, description: `Épargne · ${goal.name}`, from: 'MAIN', to: 'SAVINGS', metadata: { goalId: goal.id } });
      return tx.savingsGoal.update({ where: { id: goal.id }, data: { currentAmount: { increment: amount } } });
    });
    if (num(updated.currentAmount) >= num(updated.targetAmount) && num(goal.currentAmount) < num(goal.targetAmount)) {
      await notify(goal.userId, { title: 'Objectif atteint ! 🎯', body: `Bravo, « ${goal.name} » est complété.`, type: 'SAVINGS' });
    }
    emitBalanceChanged(goal.userId);
    res.json(goalDTO(updated));
  }),
);

router.post(
  '/goals/:id/withdraw',
  validate(z.object({ amount: z.number().int().min(100) })),
  requireStrongAuth('PAYMENT', amountOf),
  asyncHandler(async (req, res) => {
    const { amount } = req.body as { amount: number };
    const goal = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: uid(req) } });
    if (!goal) throw notFound();
    if (amount > num(goal.currentAmount)) throw badRequest('Montant supérieur à l\'épargne de cet objectif');
    const updated = await prisma.$transaction(async (tx) => {
      await post(tx, { userId: goal.userId, type: 'SAVINGS_OUT', amount, description: `Retrait · ${goal.name}`, from: 'SAVINGS', to: 'MAIN', metadata: { goalId: goal.id } });
      return tx.savingsGoal.update({ where: { id: goal.id }, data: { currentAmount: { decrement: amount } } });
    });
    emitBalanceChanged(goal.userId);
    res.json(goalDTO(updated));
  }),
);

/* ----------------------------- Tontines ------------------------------ */

async function tontineDTO(id: string, userId: string): Promise<TontineDTO> {
  const t = await prisma.tontine.findUniqueOrThrow({
    where: { id },
    include: { members: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } }, orderBy: { position: 'asc' } } },
  });
  const me = t.members.find((m) => m.userId === userId);
  return {
    id: t.id,
    name: t.name,
    amount: num(t.amount),
    frequency: t.frequency,
    maxMembers: t.maxMembers,
    currentCycle: t.currentCycle,
    totalCycles: t.totalCycles,
    status: t.status,
    nextContributionDate: nextContributionDate(t.createdAt, t.frequency, t.currentCycle).toISOString(),
    myPosition: me?.position ?? 0,
    members: t.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: `${m.user.firstName} ${m.user.lastName[0]}.`,
      avatarUrl: m.user.avatarUrl,
      position: m.position,
      hasPaid: m.hasPaid,
      hasReceived: m.hasReceived,
    })),
  };
}

router.get(
  '/tontines',
  asyncHandler(async (req, res) => {
    const memberships = await prisma.tontineMember.findMany({ where: { userId: uid(req) }, select: { tontineId: true } });
    res.json(await Promise.all(memberships.map((m) => tontineDTO(m.tontineId, uid(req)))));
  }),
);

router.get(
  '/tontines/:id',
  asyncHandler(async (req, res) => {
    const member = await prisma.tontineMember.findFirst({ where: { tontineId: req.params.id, userId: uid(req) } });
    if (!member) throw notFound();
    res.json(await tontineDTO(req.params.id, uid(req)));
  }),
);

const tontineSchema = z.object({
  name: z.string().trim().min(2).max(60),
  amount: z.number().int().min(500),
  frequency,
  maxMembers: z.number().int().min(2).max(50),
});

router.post(
  '/tontines',
  validate(tontineSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof tontineSchema>;
    const t = await prisma.tontine.create({
      data: { ...b, totalCycles: b.maxMembers, status: 'PENDING', members: { create: { userId: uid(req), position: 1 } } },
    });
    res.status(201).json(await tontineDTO(t.id, uid(req)));
  }),
);

router.post(
  '/tontines/:id/join',
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    await prisma.$transaction(async (tx) => {
      const t = await tx.tontine.findUnique({ where: { id: req.params.id }, include: { members: true } });
      if (!t) throw notFound();
      if (t.status !== 'PENDING') throw conflict('Cette tontine a déjà démarré');
      if (t.members.some((m) => m.userId === userId)) throw conflict('Vous êtes déjà membre');
      if (t.members.length >= t.maxMembers) throw conflict('Tontine complète');
      await tx.tontineMember.create({ data: { tontineId: t.id, userId, position: t.members.length + 1 } });
      if (t.members.length + 1 === t.maxMembers) await tx.tontine.update({ where: { id: t.id }, data: { status: 'ACTIVE' } });
    });
    res.json(await tontineDTO(req.params.id, userId));
  }),
);

/** Cotisation au tour courant ; quand tous ont cotisé, versement au bénéficiaire et passage au tour suivant. */
router.post(
  '/tontines/:id/contribute',
  // Le montant est porté par la tontine : le PIN est exigé à chaque cotisation.
  requireStrongAuth('PAYMENT', () => Number.POSITIVE_INFINITY),
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    const payout = await prisma.$transaction(async (tx) => {
      const t = await tx.tontine.findUnique({ where: { id: req.params.id }, include: { members: true } });
      if (!t) throw notFound();
      if (t.status !== 'ACTIVE') throw conflict("La tontine n'est pas active");
      const me = t.members.find((m) => m.userId === userId);
      if (!me) throw forbidden("Vous n'êtes pas membre de cette tontine");
      if (me.hasPaid) throw conflict('Cotisation déjà versée pour ce tour');
      const amount = num(t.amount);
      await post(tx, { userId, type: 'SAVINGS_IN', amount, description: `Cotisation tontine · ${t.name}`, from: 'MAIN', to: null, metadata: { tontineId: t.id, cycle: t.currentCycle } });
      await tx.tontineMember.update({ where: { id: me.id }, data: { hasPaid: true } });

      const allPaid = t.members.every((m) => m.id === me.id || m.hasPaid);
      if (!allPaid) return null;
      const beneficiary = t.members.find((m) => m.position === beneficiaryPosition(t.currentCycle));
      if (!beneficiary) return null;
      const pot = potAmount(amount, t.members.length);
      await post(tx, { userId: beneficiary.userId, type: 'SAVINGS_OUT', amount: pot, description: `Tour de tontine · ${t.name}`, from: null, to: 'MAIN', metadata: { tontineId: t.id, cycle: t.currentCycle } });
      await tx.tontineMember.update({ where: { id: beneficiary.id }, data: { hasReceived: true } });
      await tx.tontineMember.updateMany({ where: { tontineId: t.id }, data: { hasPaid: false } });
      const finished = t.currentCycle >= t.totalCycles;
      await tx.tontine.update({ where: { id: t.id }, data: finished ? { status: 'COMPLETED' } : { currentCycle: { increment: 1 } } });
      return { userId: beneficiary.userId, pot, name: t.name };
    });
    if (payout) {
      await notify(payout.userId, { title: "C'est votre tour ! 🎉", body: `${formatFCFA(payout.pot)} reçus de la tontine « ${payout.name} »`, type: 'SAVINGS' });
      emitBalanceChanged(payout.userId);
    }
    emitBalanceChanged(userId);
    res.json(await tontineDTO(req.params.id, userId));
  }),
);

/* ----------------------------- Coffre-fort --------------------------- */

router.get(
  '/vaults',
  asyncHandler(async (req, res) => {
    const vaults = await prisma.vault.findMany({ where: { userId: uid(req), released: false }, orderBy: { unlockDate: 'asc' } });
    res.json({ options: VAULT_OPTIONS, vaults: vaults.map((v) => vaultDTO(v)) });
  }),
);

const vaultSchema = z.object({ amount: z.number().int().min(5_000), months: z.union([z.literal(3), z.literal(6), z.literal(12)]) });
router.post(
  '/vaults',
  validate(vaultSchema),
  requireStrongAuth('PAYMENT', amountOf),
  enforceKycLimit(amountOf),
  amlScreen(amountOf),
  asyncHandler(async (req, res) => {
    const { amount, months } = req.body as z.infer<typeof vaultSchema>;
    const userId = uid(req);
    const rate = vaultRate(months);
    const vault = await prisma.$transaction(async (tx) => {
      const v = await tx.vault.create({ data: { userId, amount, rate, months, unlockDate: addMonths(new Date(), months) } });
      await post(tx, { userId, type: 'SAVINGS_IN', amount, description: `Coffre-fort ${months} mois`, from: 'MAIN', to: 'VAULT', metadata: { vaultId: v.id } });
      return v;
    });
    await notify(userId, { title: 'Coffre-fort créé 🔒', body: `${formatFCFA(amount)} bloqués ${months} mois à ${(rate * 100).toFixed(1)} %/an`, type: 'SAVINGS' });
    emitBalanceChanged(userId);
    res.status(201).json(vaultDTO(vault));
  }),
);
