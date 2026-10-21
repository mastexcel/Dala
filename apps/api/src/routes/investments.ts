import { Router } from 'express';
import { z } from 'zod';
import { formatFCFA, simulateBond, WITHDRAWAL_PERIOD_HOURS, type PortfolioDTO } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, notFound } from '../lib/errors';
import { investmentDTO } from '../lib/serialize';
import { validate } from '../middleware/validate';
import { requireStrongAuth, type AuthedRequest } from '../middleware/auth';
import { enforceKycLimit } from '../middleware/kyc';
import { amlScreen } from '../middleware/aml';
import { post } from '../services/ledger';
import { emitBalanceChanged, notify } from '../services/notifications';
import { BONDS, FUNDS, findInstrument, instrumentName } from '../services/treasury';

export const router = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;
const amountOf = (req: { body: { amount: number } }) => req.body.amount;

router.get('/bonds', (req, res) => {
  const halal = req.query.halal === 'true';
  res.json(halal ? BONDS.filter((b) => b.isHalal) : BONDS);
});

router.get('/bonds/:id', (req, res, next) => {
  const bond = BONDS.find((b) => b.id === req.params.id);
  if (!bond) return next(notFound('Titre introuvable'));
  res.json(bond);
});

router.get('/funds', (req, res) => {
  const halal = req.query.halal === 'true';
  res.json(halal ? FUNDS.filter((f) => f.isHalal) : FUNDS);
});

router.get(
  '/simulate',
  validate(z.object({ instrumentId: z.string(), amount: z.coerce.number().int().positive() }), 'query'),
  (req, res, next) => {
    const { instrumentId, amount } = req.query as unknown as { instrumentId: string; amount: number };
    const inst = findInstrument(instrumentId);
    if (!inst) return next(notFound('Titre introuvable'));
    if (inst.kind === 'bond') return res.json(simulateBond(amount, inst.item.rate, inst.item.maturityDays));
    const projected = Math.round(amount * inst.item.ytdPerformance * (1 - inst.item.fees));
    res.json({ amount, interest: projected, total: amount + projected, effectiveYield: projected / amount, indicative: true });
  },
);

/** Portefeuille : valeur, rendement depuis le début d'année et historique 30 j. */
router.get(
  '/portfolio',
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    const now = new Date();
    const investments = await prisma.investment.findMany({ where: { userId, status: { in: ['ACTIVE', 'MATURED'] } }, orderBy: { createdAt: 'desc' } });
    const active = investments.filter((i) => i.status === 'ACTIVE');
    const valueAt = (at: Date) =>
      active
        .filter((i) => i.createdAt <= at)
        .reduce((s, i) => s + num(i.amount) * (1 + (num(i.rate) * (at.getTime() - i.createdAt.getTime())) / (365 * 86_400_000)), 0);
    const invested = active.reduce((s, i) => s + num(i.amount), 0);
    const totalValue = Math.round(valueAt(now));
    const history = Array.from({ length: 30 }, (_, k) => {
      const d = new Date(now.getTime() - (29 - k) * 86_400_000);
      return { date: d.toISOString().slice(0, 10), value: Math.round(valueAt(d)) };
    });
    const portfolio: PortfolioDTO = {
      totalValue,
      invested,
      ytdReturn: totalValue - invested,
      ytdReturnPct: invested ? (totalValue - invested) / invested : 0,
      history,
      investments: investments.map((i) => investmentDTO(i, instrumentName(i.instrumentId))),
    };
    res.json(portfolio);
  }),
);

const investSchema = z.object({ instrumentId: z.string(), amount: z.number().int().positive(), acceptTerms: z.literal(true) });

router.post(
  '/',
  validate(investSchema),
  requireStrongAuth('PAYMENT', amountOf),
  enforceKycLimit(amountOf),
  amlScreen(amountOf),
  asyncHandler(async (req, res) => {
    const { instrumentId, amount } = req.body as z.infer<typeof investSchema>;
    const userId = uid(req);
    const inst = findInstrument(instrumentId);
    if (!inst) throw notFound('Titre introuvable');
    if (amount < inst.item.minAmount) throw badRequest(`Montant minimum : ${formatFCFA(inst.item.minAmount)}`);
    const isBond = inst.kind === 'bond';
    const rate = isBond ? inst.item.rate : inst.item.ytdPerformance;
    const maturityDate = new Date(Date.now() + (isBond ? inst.item.maturityDays : 365) * 86_400_000);
    if (isBond && new Date(inst.item.closingDate) < new Date()) throw conflict('Souscription clôturée pour cette émission');
    const inv = await prisma.$transaction(async (tx) => {
      const i = await tx.investment.create({
        data: { userId, type: isBond ? inst.item.type : 'FCP', instrumentId, amount, rate, maturityDate, isHalal: inst.item.isHalal },
      });
      await post(tx, { userId, type: 'INVESTMENT_BUY', amount, description: instrumentName(instrumentId), from: 'MAIN', to: 'INVESTMENT', metadata: { investmentId: i.id } });
      return i;
    });
    await notify(userId, {
      title: 'Investissement confirmé 📈',
      body: `${formatFCFA(amount)} placés sur ${instrumentName(instrumentId)}. Rétractation possible pendant ${WITHDRAWAL_PERIOD_HOURS} h.`,
      type: 'INVEST',
    });
    emitBalanceChanged(userId);
    res.status(201).json(investmentDTO(inv, instrumentName(instrumentId)));
  }),
);

/** Droit de rétractation de 48 h (Art. 52-74). */
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    const inv = await prisma.investment.findFirst({ where: { id: req.params.id, userId } });
    if (!inv) throw notFound();
    if (inv.status !== 'ACTIVE') throw conflict('Investissement non annulable');
    if (Date.now() - inv.createdAt.getTime() > WITHDRAWAL_PERIOD_HOURS * 3_600_000) throw conflict('Délai de rétractation de 48 h dépassé');
    await prisma.$transaction(async (tx) => {
      await tx.investment.update({ where: { id: inv.id }, data: { status: 'CANCELLED' } });
      await post(tx, { userId, type: 'INVESTMENT_RETURN', amount: num(inv.amount), description: 'Rétractation investissement', from: 'INVESTMENT', to: 'MAIN', metadata: { investmentId: inv.id } });
    });
    emitBalanceChanged(userId);
    res.json({ ok: true });
  }),
);
