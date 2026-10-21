import { Router } from 'express';
import { z } from 'zod';
import {
  CROWDFUND_REVIEW_DAYS,
  CROWDFUND_VALIDATOR,
  WITHDRAWAL_PERIOD_HOURS,
  equityForInvestment,
  formatFCFA,
  formatPercent,
  validateCrowdfundTicket,
  type CrowdfundHoldingDTO,
} from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, notFound } from '../lib/errors';
import { holdingStatus, projectDTO } from '../lib/serialize';
import { validate } from '../middleware/validate';
import { requireStrongAuth, type AuthedRequest } from '../middleware/auth';
import { enforceKycLimit } from '../middleware/kyc';
import { amlScreen } from '../middleware/aml';
import { post } from '../services/ledger';
import { appendAudit } from '../services/audit';
import { emitBalanceChanged, notify } from '../services/notifications';

export const router = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;
const amountOf = (req: { body: { amount: number } }) => req.body.amount;
const sectors = ['AGRITECH', 'SOLARTECH', 'FOODTECH', 'HEALTHTECH', 'FINTECH', 'EDUTECH', 'LOGISTICS', 'OTHER'] as const;

/** Projets ouverts à l'investissement : uniquement ceux validés par le comité. */
router.get(
  '/projects',
  validate(z.object({ sector: z.enum(sectors).optional(), q: z.string().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const { sector, q } = req.query as { sector?: (typeof sectors)[number]; q?: string };
    const projects = await prisma.project.findMany({
      where: {
        status: { in: ['ACTIVE', 'FUNDED'] },
        validatedBy: CROWDFUND_VALIDATOR,
        ...(sector ? { sector } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      include: { _count: { select: { investments: true } } },
      orderBy: { deadline: 'asc' },
    });
    res.json(projects.map(projectDTO));
  }),
);

router.get(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const p = await prisma.project.findUnique({ where: { id: req.params.id }, include: { _count: { select: { investments: true } } } });
    if (!p || (p.status !== 'ACTIVE' && p.status !== 'FUNDED' && p.submittedBy !== uid(req))) throw notFound('Projet introuvable');
    res.json(projectDTO(p));
  }),
);

/** Investissement en capital (equity uniquement). */
router.post(
  '/projects/:id/invest',
  validate(z.object({ amount: z.number().int().positive(), acceptRisks: z.literal(true) })),
  requireStrongAuth('PAYMENT', amountOf),
  enforceKycLimit(amountOf),
  amlScreen(amountOf),
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    const { amount } = req.body as { amount: number };
    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.project.findUnique({ where: { id: req.params.id } });
      if (!p || p.status !== 'ACTIVE' || p.validatedBy !== CROWDFUND_VALIDATOR) throw notFound('Projet non ouvert à l\'investissement');
      if (p.deadline < new Date()) throw conflict('La levée est terminée');
      if (p.submittedBy === userId) throw badRequest('Vous ne pouvez pas investir dans votre propre projet');
      const error = validateCrowdfundTicket(amount, num(p.fundingGoal), num(p.fundingRaised));
      if (error) throw badRequest(error);
      const equityPct = equityForInvestment(amount, num(p.valuation));
      const raised = num(p.fundingRaised) + amount;
      // Garde-fou : l'equity cédée ne peut excéder le maximum offert.
      if (equityForInvestment(raised, num(p.valuation)) > num(p.equityMax) + 1e-9) throw conflict("Le plafond d'equity offert est atteint");
      const inv = await tx.crowdfundInvestment.create({ data: { userId, projectId: p.id, amount, equityPct } });
      await tx.project.update({
        where: { id: p.id },
        data: { fundingRaised: { increment: amount }, ...(raised >= num(p.fundingGoal) ? { status: 'FUNDED' } : {}) },
      });
      await post(tx, { userId, type: 'CROWDFUND_IN', amount, description: `Crowdfund · ${p.name}`, from: 'MAIN', to: 'CROWDFUND', metadata: { projectId: p.id, investmentId: inv.id } });
      return { inv, project: p, equityPct };
    });
    await notify(userId, {
      title: 'Investissement enregistré 🤝',
      body: `${formatFCFA(amount)} dans ${result.project.name} (${formatPercent(result.equityPct, 3)} du capital). Rétractation possible ${WITHDRAWAL_PERIOD_HOURS} h.`,
      type: 'CROWDFUND',
    });
    emitBalanceChanged(userId);
    res.status(201).json({ id: result.inv.id, equityPct: result.equityPct, status: result.inv.status });
  }),
);

/** Rétractation dans les 48 h : remboursement intégral. */
router.post(
  '/investments/:id/cancel',
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    await prisma.$transaction(async (tx) => {
      const inv = await tx.crowdfundInvestment.findFirst({ where: { id: req.params.id, userId }, include: { project: true } });
      if (!inv) throw notFound();
      if (inv.status !== 'PENDING') throw conflict('Investissement non annulable');
      if (Date.now() - inv.createdAt.getTime() > WITHDRAWAL_PERIOD_HOURS * 3_600_000) throw conflict('Délai de rétractation de 48 h dépassé');
      await tx.crowdfundInvestment.update({ where: { id: inv.id }, data: { status: 'CANCELLED' } });
      await tx.project.update({
        where: { id: inv.projectId },
        data: { fundingRaised: { decrement: num(inv.amount) }, ...(inv.project.status === 'FUNDED' ? { status: 'ACTIVE' } : {}) },
      });
      await post(tx, { userId, type: 'CROWDFUND_RETURN', amount: num(inv.amount), description: `Rétractation · ${inv.project.name}`, from: 'CROWDFUND', to: 'MAIN', metadata: { investmentId: inv.id } });
    });
    emitBalanceChanged(userId);
    res.json({ ok: true });
  }),
);

router.get(
  '/portfolio',
  asyncHandler(async (req, res) => {
    const list = await prisma.crowdfundInvestment.findMany({ where: { userId: uid(req) }, include: { project: true }, orderBy: { createdAt: 'desc' } });
    const holdings: CrowdfundHoldingDTO[] = list.map((c) => {
      const active = c.status === 'PENDING' || c.status === 'CONFIRMED';
      return {
        id: c.id,
        projectId: c.projectId,
        projectName: c.project.name,
        sector: c.project.sector,
        amount: num(c.amount),
        equityPct: num(c.equityPct),
        // Valeur estimée = quote-part × valorisation post-money ; égale au ticket tant que la
        // société n'a pas été revalorisée (pas de marché secondaire).
        estimatedValue: active ? Math.round(num(c.equityPct) * num(c.project.valuation)) : 0,
        status: holdingStatus(c, c.project),
        createdAt: c.createdAt.toISOString(),
      };
    });
    const totalInvested = holdings.filter((h) => h.status !== 'CLOTURE').reduce((s, h) => s + h.amount, 0);
    res.json({ totalInvested, holdings });
  }),
);

/* ------------------------- Soumission de projet ------------------------- */

const submitSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    sector: z.enum(sectors),
    description: z.string().min(50),
    problem: z.string().min(20),
    solution: z.string().min(20),
    targetMarket: z.string().min(5),
    fundingGoal: z.number().int().min(1_000_000),
    valuation: z.number().int().min(5_000_000),
    equityMin: z.number().min(0.01).max(0.49),
    equityMax: z.number().min(0.01).max(0.49),
    deadline: z.coerce.date(),
    imageUrl: z.string().url().optional(),
    documents: z.array(z.object({ name: z.string(), url: z.string(), kind: z.enum(['BUSINESS_PLAN', 'VALIDATION', 'PROJECTIONS', 'OTHER']) })).min(1),
    teamMembers: z.array(z.object({ name: z.string(), role: z.string(), photoUrl: z.string().url().optional() })).min(1),
  })
  .refine((p) => p.equityMin <= p.equityMax, { message: "L'equity min doit être ≤ equity max" })
  .refine((p) => p.fundingGoal / p.valuation <= p.equityMax, { message: "Objectif / valorisation dépasse l'equity maximale offerte" })
  .refine((p) => p.deadline.getTime() > Date.now() + 14 * 86_400_000, { message: 'La date de clôture doit être à plus de 14 jours' });

router.post(
  '/projects',
  validate(submitSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof submitSchema>;
    const userId = uid(req);
    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: { ...b, submittedBy: userId, equityOffered: b.fundingGoal / b.valuation, status: 'SUBMITTED' },
      });
      await appendAudit(tx, { userId, action: 'PROJECT_SUBMITTED', entity: 'Project', entityId: p.id });
      return p;
    });
    await notify(userId, {
      title: 'Projet soumis ✅',
      body: `Votre projet sera examiné par le comité ${CROWDFUND_VALIDATOR}. Délai moyen : ${CROWDFUND_REVIEW_DAYS} jours ouvrés.`,
      type: 'CROWDFUND',
    });
    res.status(201).json({ id: project.id, status: project.status });
  }),
);

router.get(
  '/my-projects',
  asyncHandler(async (req, res) => {
    const list = await prisma.project.findMany({ where: { submittedBy: uid(req) }, include: { _count: { select: { investments: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(list.map(projectDTO));
  }),
);
