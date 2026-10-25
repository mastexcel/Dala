import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, deposit, mainBalance, PIN, prisma, register, resetDb, tokenFor } from './helpers';
import { setModuleForTests } from '../../src/services/testPhase';

// Le module investissement est fermé pendant la phase de test : on le rouvre ici pour vérifier son code.
beforeAll(async () => {
  await resetDb();
  setModuleForTests('invest', true);
});
afterAll(async () => {
  setModuleForTests('invest', false);
  await prisma.$disconnect();
});

describe('Portefeuille, plafonds KYC et authentification forte', () => {
  it('crédite un dépôt mobile money et met à jour le tableau de bord', async () => {
    const { token, userId } = await register();
    await deposit(token, 100_000);
    expect(await mainBalance(userId)).toBe(100_000);
    const s = await api().get('/v1/accounts/summary').set(bearer(token)).expect(200);
    expect(s.body.total).toBe(100_000);
    expect(s.body.monthDelta).toBe(100_000);
  });

  it('bloque au-delà du plafond mensuel KYC niveau 1 (200 000 FCFA)', async () => {
    const { token } = await register();
    await deposit(token, 150_000);
    const r = await api().post('/v1/accounts/deposit').set(bearer(token)).send({ provider: 'ORANGE_MONEY', amount: 60_000 });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('KYC_LIMIT');
    expect(r.body.details.requiredLevel).toBe(2);
  });

  it('rembourse le compte si l’opérateur refuse un retrait', async () => {
    const { token, userId } = await register();
    await deposit(token, 50_000);
    const r = await api().post('/v1/accounts/withdraw').set(bearer(token)).send({ provider: 'ORANGE_MONEY', amount: 1_013 });
    expect(r.body.code).toBe('PROVIDER_FAILED');
    expect(await mainBalance(userId)).toBe(50_000);
  });

  it('exige le PIN au-delà de 50 000 FCFA, puis autorise la rétractation sous 48 h', async () => {
    const { token, userId } = await register();
    await prisma.user.update({ where: { id: userId }, data: { kycLevel: 2 } });
    await deposit(token, 150_000);
    const body = { instrumentId: 'bt-ci-364', amount: 60_000, acceptTerms: true };
    const noPin = await api().post('/v1/investments').set(bearer(token)).send(body);
    expect(noPin.body.code).toBe('STRONG_AUTH_REQUIRED');
    const badPin = await api().post('/v1/investments').set(bearer(token)).set('x-transaction-pin', '0000').send(body);
    expect(badPin.body.code).toBe('INVALID_PIN');
    const inv = await api().post('/v1/investments').set(bearer(token)).set('x-transaction-pin', PIN).send(body).expect(201);
    expect(await mainBalance(userId)).toBe(90_000);
    const p = await api().get('/v1/investments/portfolio').set(bearer(token)).expect(200);
    expect(p.body.invested).toBe(60_000);
    await api().post(`/v1/investments/${inv.body.id}/cancel`).set(bearer(token)).expect(200);
    expect(await mainBalance(userId)).toBe(150_000);
  });

  it('refuse un débit supérieur au solde sans rien modifier', async () => {
    const { token, userId } = await register();
    await deposit(token, 10_000);
    const r = await api().post('/v1/investments').set(bearer(token)).send({ instrumentId: 'bt-ml-91', amount: 20_000, acceptTerms: true });
    expect(r.body.code).toBe('INSUFFICIENT_FUNDS');
    expect(await mainBalance(userId)).toBe(10_000);
    expect(await prisma.investment.count({ where: { userId } })).toBe(0);
  });

  it('gère objectifs d’épargne et coffre-fort', async () => {
    const { token, userId } = await register();
    await deposit(token, 100_000);
    const goal = await api().post('/v1/savings/goals').set(bearer(token)).send({ name: 'Mariage', targetAmount: 50_000 }).expect(201);
    await api().post(`/v1/savings/goals/${goal.body.id}/deposit`).set(bearer(token)).send({ amount: 20_000 }).expect(200);
    const vault = await api().post('/v1/savings/vaults').set(bearer(token)).send({ amount: 30_000, months: 6 }).expect(201);
    // Pas de rémunération de l'épargne pendant la phase de test (réservée à un établissement agréé).
    expect(vault.body.rate).toBe(0);
    const s = await api().get('/v1/accounts/summary').set(bearer(token)).expect(200);
    expect(s.body).toMatchObject({ main: 50_000, savings: 20_000, vault: 30_000, total: 100_000 });
  });

  it('réserve les transferts au KYC niveau 2 et crédite le destinataire', async () => {
    const a = await register('Moussa', 'Traoré');
    const b = await register('Fatou', 'Diallo');
    await deposit(a.token, 20_000);
    const denied = await api().post('/v1/accounts/transfer').set(bearer(a.token)).send({ toPhone: b.phone, amount: 5_000 });
    expect(denied.body.code).toBe('KYC_LEVEL');
    await prisma.user.update({ where: { id: a.userId }, data: { kycLevel: 2 } });
    await api().post('/v1/accounts/transfer').set(bearer(await tokenFor(a.userId))).send({ toPhone: b.phone, amount: 5_000 }).expect(201);
    expect(await mainBalance(a.userId)).toBe(15_000);
    expect(await mainBalance(b.userId)).toBe(5_000);
    expect(await prisma.notification.count({ where: { userId: b.userId, title: { contains: 'reçu' } } })).toBe(1);
  });

  it('exporte le relevé en CSV et PDF', async () => {
    const { token } = await register();
    await deposit(token, 7_000);
    const csv = await api().get('/v1/transactions/export?format=csv').set(bearer(token)).expect(200);
    expect(csv.text).toContain('DEPOSIT;Dépôt Orange Money;7000;COMPLETED');
    expect(csv.text).toContain('Laboratoire d\'Innovation Financière de la BCEAO');
    const pdf = await api().get('/v1/transactions/export?format=pdf').set(bearer(token)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });
});
