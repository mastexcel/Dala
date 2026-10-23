import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CROWDFUND_VALIDATOR } from '@dala/shared';
import { ADMIN, api, bearer, deposit, mainBalance, prisma, register, resetDb, tokenFor } from './helpers';

let founder: Awaited<ReturnType<typeof register>>;
let projectId: string;

beforeAll(async () => {
  await resetDb();
  founder = await register('Mariam', 'Bamba');
});
afterAll(() => prisma.$disconnect());

const project = {
  name: 'AgriTech CI',
  sector: 'AGRITECH',
  description: 'Coopérative de cacao bio certifiée qui équipe 1 200 producteurs en capteurs et en traçabilité.',
  problem: 'Les planteurs perçoivent une faible part de la valeur finale.',
  solution: 'Traçabilité par parcelle et prime bio négociée collectivement.',
  targetMarket: 'Producteurs de cacao',
  fundingGoal: 2_000_000,
  valuation: 20_000_000,
  equityMin: 0.05,
  equityMax: 0.15,
  documents: [{ name: 'Business plan', url: 'kyc/bp.pdf', kind: 'BUSINESS_PLAN' }],
  teamMembers: [{ name: 'Mariam Bamba', role: 'CEO' }],
};

describe('Crowdfunding en capital', () => {
  it('soumet un projet, invisible tant que le comité ne l’a pas validé', async () => {
    const r = await api()
      .post('/v1/crowdfund/projects')
      .set(bearer(founder.token))
      .send({ ...project, deadline: new Date(Date.now() + 30 * 86_400_000).toISOString() })
      .expect(201);
    projectId = r.body.id;
    expect(r.body.status).toBe('SUBMITTED');
    const list = await api().get('/v1/crowdfund/projects').set(bearer(founder.token)).expect(200);
    expect(list.body).toHaveLength(0);
  });

  it('refuse une equity cédée supérieure au maximum offert', async () => {
    const r = await api()
      .post('/v1/crowdfund/projects')
      .set(bearer(founder.token))
      .send({ ...project, valuation: 5_000_000, deadline: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    expect(r.status).toBe(400);
  });

  it('publie le projet validé par Bridge Investment Partners', async () => {
    await api().post(`/v1/compliance/admin/projects/${projectId}/review`).set(ADMIN).send({ decision: 'ACTIVE' }).expect(200);
    const list = await api().get('/v1/crowdfund/projects').set(bearer(founder.token)).expect(200);
    expect(list.body[0]).toMatchObject({ id: projectId, validatedBy: CROWDFUND_VALIDATOR });
  });

  it('interdit d’investir dans son propre projet', async () => {
    await deposit(founder.token, 10_000);
    const r = await api().post(`/v1/crowdfund/projects/${projectId}/invest`).set(bearer(founder.token)).send({ amount: 5_000, acceptRisks: true });
    expect(r.status).toBe(400);
  });

  it('calcule la part de capital, permet la rétractation et clôture la levée à l’objectif', async () => {
    const inv = await register('Yao', 'Kouassi');
    await prisma.user.update({ where: { id: inv.userId }, data: { kycLevel: 3 } });
    const token = await tokenFor(inv.userId);
    await deposit(token, 2_500_000);

    const small = await api().post(`/v1/crowdfund/projects/${projectId}/invest`).set(bearer(token)).send({ amount: 5_000, acceptRisks: true }).expect(201);
    expect(small.body.equityPct).toBeCloseTo(5_000 / 20_000_000, 8);
    const stored = await prisma.crowdfundInvestment.findUniqueOrThrow({ where: { id: small.body.id } });
    expect(stored.equityPct.toNumber()).toBeCloseTo(0.00025, 8);

    await api().post(`/v1/crowdfund/investments/${small.body.id}/cancel`).set(bearer(token)).expect(200);
    expect(await mainBalance(inv.userId)).toBe(2_500_000);

    const tooMuch = await api().post(`/v1/crowdfund/projects/${projectId}/invest`).set(bearer(token)).set('x-transaction-pin', '2580').send({ amount: 2_100_000, acceptRisks: true });
    expect(tooMuch.status).toBe(400);

    await api().post(`/v1/crowdfund/projects/${projectId}/invest`).set(bearer(token)).set('x-transaction-pin', '2580').send({ amount: 2_000_000, acceptRisks: true }).expect(201);
    const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(p.status).toBe('FUNDED');
    const portfolio = await api().get('/v1/crowdfund/portfolio').set(bearer(token)).expect(200);
    expect(portfolio.body.holdings.find((h: { status: string }) => h.status === 'FINANCE').amount).toBe(2_000_000);
  });
});
