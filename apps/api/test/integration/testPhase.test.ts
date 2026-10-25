import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_PHASE } from '@dala/shared';
import { purgeExpiredAccounts } from '../../src/jobs/tasks';
import { ADMIN, api, bearer, CONSENT, deposit, mainBalance, ml, nextPhone, PIN, prisma, register, resetDb, startMlStub, stopMlStub } from './helpers';

/** Engagements du dossier LIF-BCEAO, vérifiés côté serveur. */
beforeAll(async () => {
  await resetDb();
  await startMlStub();
});
afterAll(async () => {
  await stopMlStub();
  await prisma.$disconnect();
});

async function startRegistration(body: Record<string, unknown> = {}) {
  const phone = nextPhone();
  const otp = await api().post('/v1/auth/otp/request').send({ phone, purpose: 'REGISTER' }).expect(200);
  return api()
    .post('/v1/auth/register')
    .send({ phone, otp: otp.body.devCode, firstName: 'Awa', lastName: 'Koné', pin: PIN, dateOfBirth: '1995-03-01', consent: CONSENT, ...body });
}

describe('Phase de test LIF-BCEAO : engagements appliqués par le serveur', () => {
  it("ferme l'investissement et le crowdfunding (AMF-UMOA)", async () => {
    const { token } = await register();
    for (const path of ['/v1/investments/bonds', '/v1/investments/portfolio', '/v1/crowdfund/projects']) {
      const r = await api().get(path).set(bearer(token)).expect(404);
      expect(r.body.code).toBe('MODULE_DISABLED');
    }
    await api().post('/v1/compliance/admin/projects/x/review').set(ADMIN).send({ decision: 'ACTIVE' }).expect(404);
  });

  it("exige l'acceptation horodatée de l'avertissement et la majorité", async () => {
    expect((await startRegistration({ consent: undefined })).status).toBe(400);
    expect((await startRegistration({ consent: { version: 'ancienne', accepted: true } })).status).toBe(400);
    expect((await startRegistration({ dateOfBirth: undefined })).status).toBe(400);
    const minor = new Date();
    minor.setUTCFullYear(minor.getUTCFullYear() - 17);
    const underage = await startRegistration({ dateOfBirth: minor.toISOString().slice(0, 10) });
    expect(underage.status).toBe(403);
    expect(underage.body.code).toBe('UNDERAGE');

    const ok = await startRegistration();
    expect(ok.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ok.body.user.id } });
    expect(user.consentVersion).toBe(TEST_PHASE.consentVersion);
    expect(user.consentAcceptedAt).toBeInstanceOf(Date);
    expect(user.dateOfBirth?.toISOString().slice(0, 10)).toBe('1995-03-01');
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { userId: user.id, action: 'CONSENT_ACCEPTED' } });
    expect(audit.payload).toMatchObject({ version: TEST_PHASE.consentVersion });
  });

  it(`limite les inscriptions à ${TEST_PHASE.limits.maxUsers} utilisateurs`, async () => {
    const existing = await prisma.user.count();
    const missing = TEST_PHASE.limits.maxUsers - existing;
    await prisma.user.createMany({
      data: Array.from({ length: missing }, (_, i) => ({ phone: `+22501${String(i).padStart(8, '0')}`, firstName: 'Test', lastName: 'Capacité', pin: 'x' })),
    });
    const otp = await api().post('/v1/auth/otp/request').send({ phone: nextPhone(), purpose: 'REGISTER' });
    expect(otp.status).toBe(409);
    expect(otp.body.code).toBe('TEST_LIMIT_REACHED');
    // Une place libérée par une clôture rouvre les inscriptions.
    await prisma.user.updateMany({ where: { lastName: 'Capacité' }, data: { status: 'CLOSED' } });
    expect((await startRegistration()).status).toBe(201);
    await prisma.user.deleteMany({ where: { lastName: 'Capacité' } });
  });

  it('plafonne chaque prêt à 100 000 FCFA et l’encours total à 5 M FCFA', async () => {
    ml.probability = 0.99;
    const { token, userId } = await register();
    const tooBig = await api().post('/v1/loans').set(bearer(token)).set('x-transaction-pin', PIN).send({ amount: 105_000, duration: 30, acceptTerms: true });
    expect(tooBig.status).toBe(400);

    const other = await register('Seydou', 'Keita');
    await prisma.loan.create({
      data: { userId: other.userId, amount: 4_950_000, interestRate: 0.12, fees: 0, totalDue: 4_950_000, duration: 30, dueDate: new Date(Date.now() + 30 * 86_400_000), status: 'DISBURSED' },
    });
    const capped = await api().post('/v1/loans').set(bearer(token)).set('x-transaction-pin', PIN).send({ amount: 60_000, duration: 30, acceptTerms: true });
    expect(capped.status).toBe(409);
    expect(capped.body.code).toBe('TEST_LIMIT_REACHED');
    expect(await mainBalance(userId)).toBe(0);
    await prisma.loan.deleteMany({ where: { userId: other.userId } });
  });

  it('refuse les dépôts au-delà de 30 M FCFA de fonds clients', async () => {
    const { token, userId } = await register();
    await prisma.user.update({ where: { id: userId }, data: { kycLevel: 2 } });
    const used = await prisma.account.aggregate({ _sum: { balance: true } });
    const room = TEST_PHASE.limits.maxClientFunds - Number(used._sum.balance ?? 0);
    await prisma.account.updateMany({ where: { userId, type: 'SAVINGS' }, data: { balance: room - 1_000 } });
    await deposit(token, 1_000);
    const r = await api().post('/v1/accounts/deposit').set(bearer(token)).send({ provider: 'ORANGE_MONEY', amount: 1_000 });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('TEST_LIMIT_REACHED');
    await prisma.account.updateMany({ where: { userId }, data: { balance: 0 } });
  });

  it('limite les tontines à 30 et à 20 membres', async () => {
    const { token } = await register();
    const body = { name: 'Tontine', amount: 5_000, frequency: 'MONTHLY', maxMembers: 21 };
    expect((await api().post('/v1/savings/tontines').set(bearer(token)).send(body)).status).toBe(400);
    const open = await prisma.tontine.count({ where: { status: { in: ['PENDING', 'ACTIVE'] } } });
    await prisma.tontine.createMany({
      data: Array.from({ length: TEST_PHASE.limits.maxTontines - open }, (_, i) => ({ name: `T${i}`, amount: 1_000, frequency: 'MONTHLY', maxMembers: 5, totalCycles: 5, status: 'PENDING' })),
    });
    const r = await api().post('/v1/savings/tontines').set(bearer(token)).send({ ...body, maxMembers: 20 });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('TEST_LIMIT_REACHED');
    await prisma.tontine.deleteMany({ where: { name: { startsWith: 'T' }, members: { none: {} } } });
  });

  it('ferme le KYC niveau 3 et le connecteur Wave', async () => {
    const { token, userId } = await register();
    await prisma.user.update({ where: { id: userId }, data: { kycLevel: 2 } });
    const kyc = await api().post('/v1/users/me/kyc').set(bearer(token)).send({ targetLevel: 3, incomeProofPath: 'a', videoPath: 'b' });
    expect(kyc.status).toBe(403);
    expect((await api().post('/v1/accounts/deposit').set(bearer(token)).send({ provider: 'WAVE', amount: 1_000 })).status).toBe(400);
    expect((await api().post('/v1/accounts/withdraw').set(bearer(token)).set('x-transaction-pin', PIN).send({ provider: 'WAVE', amount: 1_000 })).status).toBe(400);
  });

  it('exporte les données, affiche la conservation et clôture le compte vide', async () => {
    const { token, userId } = await register();
    const policy = await api().get('/v1/users/me/data/retention').set(bearer(token)).expect(200);
    expect(policy.body.yearsAfterClosure).toBe(10);

    await deposit(token, 2_000);
    const exp = await api().get('/v1/users/me/data/export').set(bearer(token)).expect(200);
    expect(exp.headers['content-disposition']).toContain('attachment');
    expect(exp.body.user).toMatchObject({ id: userId, consentVersion: TEST_PHASE.consentVersion });
    expect(exp.body.transactions).toHaveLength(1);
    expect(exp.body.user.pin).toBeUndefined();

    // Clôture refusée tant qu'il reste un solde, puis PIN exigé.
    const notEmpty = await api().post('/v1/users/me/close').set(bearer(token)).set('x-transaction-pin', PIN);
    expect(notEmpty.body.code).toBe('BALANCE_NOT_EMPTY');
    await api().post('/v1/accounts/withdraw').set(bearer(token)).set('x-transaction-pin', PIN).send({ provider: 'ORANGE_MONEY', amount: 2_000 }).expect(201);
    expect((await api().post('/v1/users/me/close').set(bearer(token))).body.code).toBe('STRONG_AUTH_REQUIRED');
    await api().post('/v1/users/me/close').set(bearer(token)).set('x-transaction-pin', PIN).expect(200);
    const closed = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(closed.status).toBe('CLOSED');
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0);

    // Données conservées 10 ans (LBC/FT), puis anonymisées.
    expect(await purgeExpiredAccounts()).toBe(0);
    const later = new Date();
    later.setFullYear(later.getFullYear() + 10, later.getMonth(), later.getDate() + 1);
    expect(await purgeExpiredAccounts(later)).toBe(1);
    const purged = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(purged).toMatchObject({ firstName: 'Anonymisé', email: null, dateOfBirth: null, kycDocuments: null });
    expect(purged.phone).toBe(`purge-${userId}`);
  });

  it('ajoute au rapport BCEAO les indicateurs du plan de test et le suivi des plafonds', async () => {
    const now = new Date();
    const r = await api().get(`/v1/compliance/admin/reports/bceao?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`).set(ADMIN).expect(200);
    expect(r.body.status).toBe('Service en phase de test au sein du LIF-BCEAO');
    expect(r.body.testPlan.activation.registered).toBeGreaterThan(0);
    expect(r.body.testPlan).toHaveProperty('recovery.loanRepaymentRate');
    expect(r.body.testPlan).toHaveProperty('complaints.withinDeadlineRate');
    expect(r.body.limits.users.limit).toBe(TEST_PHASE.limits.maxUsers);
    expect(r.body.limits.clientFunds.limit).toBe(TEST_PHASE.limits.maxClientFunds);
    expect(r.body.limits.creditOutstanding.limit).toBe(TEST_PHASE.limits.maxCreditOutstanding);
  });
});
