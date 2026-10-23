import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { USURY_RATE } from '@dala/shared';
import { api, bearer, deposit, mainBalance, ml, PIN, prisma, register, resetDb, startMlStub, stopMlStub } from './helpers';

beforeAll(async () => {
  await resetDb();
  await startMlStub();
});
afterAll(async () => {
  await stopMlStub();
  await prisma.$disconnect();
});

describe('Micro-crédit et scoring', () => {
  it('affiche un devis sous le taux d’usure', async () => {
    const { token } = await register();
    const q = await api().get('/v1/loans/quote?amount=100000&duration=30').set(bearer(token)).expect(200);
    expect(q.body.taeg).toBeLessThanOrEqual(USURY_RATE);
    expect(q.body.totalDue).toBe(q.body.amount + q.body.interest + q.body.fees);
  });

  it('refuse un montant hors grille', async () => {
    const { token } = await register();
    const r = await api().post('/v1/loans').set(bearer(token)).send({ amount: 7_500, duration: 30, acceptTerms: true });
    expect(r.status).toBe(400);
  });

  it('approuve, décaisse, puis solde le prêt par remboursements partiels', async () => {
    ml.probability = 0.92;
    const { token, userId } = await register();
    const r = await api().post('/v1/loans').set(bearer(token)).set('x-transaction-pin', PIN).send({ amount: 100_000, duration: 60, acceptTerms: true }).expect(201);
    expect(r.body.decision).toBe('APPROVED');
    expect(r.body.loan.status).toBe('DISBURSED');
    expect(await mainBalance(userId)).toBe(100_000);
    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: r.body.loan.id } });
    expect((loan.mlFeatures as { source: string }).source).toBe('ml');

    const second = await api().post('/v1/loans').set(bearer(token)).send({ amount: 5_000, duration: 7, acceptTerms: true });
    expect(second.status).toBe(409);

    const detail = await api().get(`/v1/loans/${r.body.loan.id}`).set(bearer(token)).expect(200);
    expect(detail.body.schedule).toHaveLength(2);

    const totalDue = r.body.loan.totalDue as number;
    await deposit(token, totalDue - 100_000);
    await api().post(`/v1/loans/${r.body.loan.id}/repay`).set(bearer(token)).set('x-transaction-pin', PIN).send({ amount: 60_000 }).expect(200);
    // Montant supérieur au restant dû (PIN exigé) : le remboursement est plafonné au solde du prêt.
    const done = await api().post(`/v1/loans/${r.body.loan.id}/repay`).set(bearer(token)).set('x-transaction-pin', PIN).send({ amount: totalDue }).expect(200);
    expect(done.body.status).toBe('REPAID');
    expect(done.body.amountPaid).toBe(totalDue);
    expect(await mainBalance(userId)).toBe(0);
  });

  it('refuse sans décaisser quand la probabilité est faible', async () => {
    ml.probability = 0.3;
    const { token, userId } = await register();
    const r = await api().post('/v1/loans').set(bearer(token)).send({ amount: 20_000, duration: 14, acceptTerms: true }).expect(201);
    expect(r.body.decision).toBe('REJECTED');
    expect(await mainBalance(userId)).toBe(0);
  });

  it('bascule en revue manuelle entre 0,50 et 0,70', async () => {
    ml.probability = 0.6;
    const { token } = await register();
    const r = await api().post('/v1/loans').set(bearer(token)).send({ amount: 20_000, duration: 14, acceptTerms: true }).expect(201);
    expect(r.body.decision).toBe('MANUAL_REVIEW');
    expect(r.body.loan.status).toBe('PENDING');
  });

  it('utilise le repli heuristique si le service ML est indisponible', async () => {
    await stopMlStub();
    const { token } = await register();
    const r = await api().post('/v1/loans').set(bearer(token)).send({ amount: 20_000, duration: 14, acceptTerms: true }).expect(201);
    const loan = await prisma.loan.findUniqueOrThrow({ where: { id: r.body.loan.id } });
    expect((loan.mlFeatures as { source: string }).source).toBe('heuristic');
    await startMlStub();
  });
});
