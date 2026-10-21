import { Router } from 'express';
import { z } from 'zod';
import {
  LOAN_DURATIONS,
  eligibleLoanAmount,
  formatFCFA,
  isValidLoanAmount,
  loanSchedule,
  quoteLoan,
  type CreditOverview,
  type LoanDecision,
} from '@dala/shared';
import type { Prisma } from '@prisma/client';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { loanDTO } from '../lib/serialize';
import { validate } from '../middleware/validate';
import { requireStrongAuth, type AuthedRequest } from '../middleware/auth';
import { amlScreen } from '../middleware/aml';
import { post } from '../services/ledger';
import { emitBalanceChanged, notify } from '../services/notifications';
import { buildFeatures, decide, scoreProbability } from '../services/scoring';
import { enqueue } from '../jobs/queue';

export const router = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;
const amountOf = (req: { body: { amount: number } }) => req.body.amount;
const durationSchema = z.coerce.number().refine((d) => (LOAN_DURATIONS as readonly number[]).includes(d), 'Durée invalide');

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    const loans = await prisma.loan.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const hasOpen = loans.some((l) => ['PENDING', 'APPROVED', 'DISBURSED', 'OVERDUE'].includes(l.status));
    const overview: CreditOverview = {
      score: user.creditScore,
      eligibleAmount: hasOpen ? 0 : eligibleLoanAmount(user.creditScore),
      loans: loans.map(loanDTO),
    };
    res.json(overview);
  }),
);

/** Devis transparent avant toute demande (Art. 52-74). */
router.get(
  '/quote',
  validate(z.object({ amount: z.coerce.number().int(), duration: durationSchema }), 'query'),
  asyncHandler(async (req, res) => {
    const { amount, duration } = req.query as unknown as { amount: number; duration: number };
    if (!isValidLoanAmount(amount)) throw badRequest('Montant hors grille (5 000 à 500 000 FCFA, par pas de 5 000)');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    res.json(quoteLoan(amount, duration, user.creditScore));
  }),
);

const requestSchema = z.object({ amount: z.number().int(), duration: durationSchema, purpose: z.string().max(120).optional(), acceptTerms: z.literal(true) });

/** Demande de prêt → scoring ML instantané → décision (approuvé/refusé/revue manuelle). */
router.post(
  '/',
  validate(requestSchema),
  requireStrongAuth('PAYMENT', amountOf),
  amlScreen(amountOf),
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    const { amount, duration, purpose } = req.body as z.infer<typeof requestSchema>;
    if (!isValidLoanAmount(amount)) throw badRequest('Montant hors grille (5 000 à 500 000 FCFA, par pas de 5 000)');
    const open = await prisma.loan.count({ where: { userId, status: { in: ['PENDING', 'APPROVED', 'DISBURSED', 'OVERDUE'] } } });
    if (open > 0) throw conflict('Vous avez déjà un prêt en cours');

    const features = await buildFeatures(userId);
    const scoring = await scoreProbability(features);
    const score = Math.round(scoring.probability * 100);
    const eligible = eligibleLoanAmount(score);
    let decision: LoanDecision = decide(scoring.probability);
    if (decision === 'APPROVED' && amount > eligible) decision = eligible > 0 ? 'MANUAL_REVIEW' : 'REJECTED';

    const quote = quoteLoan(amount, duration, score);
    const loan = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { creditScore: score } });
      const l = await tx.loan.create({
        data: {
          userId,
          amount,
          interestRate: quote.annualRate,
          fees: quote.fees,
          totalDue: quote.totalDue,
          duration,
          dueDate: new Date(quote.dueDate),
          status: decision === 'APPROVED' ? 'DISBURSED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING',
          mlScore: scoring.probability,
          mlFeatures: { ...features, source: scoring.source, modelVersion: scoring.modelVersion ?? null, purpose: purpose ?? null } as Prisma.InputJsonValue,
          disbursedAt: decision === 'APPROVED' ? new Date() : null,
        },
      });
      if (decision === 'APPROVED') {
        await post(tx, { userId, type: 'LOAN_DISBURSEMENT', amount, description: `Prêt DALA ${duration} j`, from: null, to: 'MAIN', metadata: { loanId: l.id } });
      }
      return l;
    });

    const messages: Record<LoanDecision, { title: string; body: string }> = {
      APPROVED: { title: 'Prêt approuvé ⚡', body: `${formatFCFA(amount)} crédités. Total à rembourser : ${formatFCFA(quote.totalDue)}.` },
      REJECTED: { title: 'Demande non retenue', body: 'Continuez à épargner régulièrement pour améliorer votre score DALA.' },
      MANUAL_REVIEW: { title: 'Demande en cours d\'analyse', body: 'Un conseiller examine votre demande sous 24 h.' },
    };
    await notify(userId, { ...messages[decision], type: 'CREDIT' });
    if (decision === 'APPROVED') emitBalanceChanged(userId);
    res.status(201).json({ decision, score, loan: loanDTO(loan), quote });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const loan = await prisma.loan.findFirst({ where: { id: req.params.id, userId: uid(req) }, include: { repayments: { orderBy: { paidAt: 'desc' } } } });
    if (!loan) throw notFound();
    const start = loan.disbursedAt ?? loan.createdAt;
    res.json({
      ...loanDTO(loan),
      schedule: loanSchedule(num(loan.totalDue), loan.duration, start, num(loan.amountPaid)),
      repayments: loan.repayments.map((r) => ({ id: r.id, amount: num(r.amount), paidAt: r.paidAt.toISOString() })),
      daysLeft: Math.ceil((loan.dueDate.getTime() - Date.now()) / 86_400_000),
    });
  }),
);

/** Remboursement partiel ou total. */
router.post(
  '/:id/repay',
  validate(z.object({ amount: z.number().int().min(100) })),
  requireStrongAuth('PAYMENT', amountOf),
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    const { amount } = req.body as { amount: number };
    const loan = await prisma.$transaction(async (tx) => {
      const l = await tx.loan.findFirst({ where: { id: req.params.id, userId } });
      if (!l) throw notFound();
      if (l.status !== 'DISBURSED' && l.status !== 'OVERDUE') throw forbidden('Ce prêt ne peut pas être remboursé');
      const remaining = num(l.totalDue) - num(l.amountPaid);
      const pay = Math.min(amount, remaining);
      await post(tx, { userId, type: 'LOAN_REPAYMENT', amount: pay, description: 'Remboursement prêt DALA', from: 'MAIN', to: null, metadata: { loanId: l.id } });
      await tx.repayment.create({ data: { loanId: l.id, amount: pay } });
      return tx.loan.update({
        where: { id: l.id },
        data: { amountPaid: { increment: pay }, ...(pay >= remaining ? { status: 'REPAID' } : {}) },
      });
    });
    if (loan.status === 'REPAID') {
      await notify(userId, { title: 'Prêt remboursé ✅', body: 'Merci ! Votre score DALA va être mis à jour.', type: 'CREDIT' });
      await enqueue('rescore', { userId });
    }
    emitBalanceChanged(userId);
    res.json(loanDTO(loan));
  }),
);
