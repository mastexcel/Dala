import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, api, bearer, deposit, mainBalance, PIN, prisma, register, resetDb, tokenFor } from './helpers';

beforeAll(resetDb);
afterAll(() => prisma.$disconnect());

describe('LBC/FT, tontines, audit et back-office', () => {
  it('gèle le compte et déclare au CENTIF en cas de fractionnement', async () => {
    const { userId } = await register();
    await prisma.user.update({ where: { id: userId }, data: { kycLevel: 3 } });
    const token = await tokenFor(userId);
    await deposit(token, 4_500_000);
    await deposit(token, 4_600_000);
    const third = await api().post('/v1/accounts/deposit').set(bearer(token)).send({ provider: 'WAVE', amount: 4_700_000 });
    expect(third.body.code).toBe('AML_BLOCKED');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe('FROZEN');
    const alert = await prisma.amlAlert.findFirstOrThrow({ where: { userId, severity: 'RED' } });
    expect(alert.reportedToCentif).toBe(true);
    const frozen = await api().post('/v1/accounts/deposit').set(bearer(token)).send({ provider: 'WAVE', amount: 1_000 });
    expect(frozen.body.code).toBe('ACCOUNT_FROZEN');

    await api().post(`/v1/compliance/admin/aml/alerts/${alert.id}/resolve`).set(ADMIN).send({ unfreeze: true }).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).status).toBe('ACTIVE');
  });

  it('fait tourner une tontine : cotisations puis versement au bénéficiaire du tour', async () => {
    const a = await register('Awa', 'Koné');
    const b = await register('Fatou', 'Diallo');
    await deposit(a.token, 20_000);
    await deposit(b.token, 20_000);
    const t = await api().post('/v1/savings/tontines').set(bearer(a.token)).send({ name: 'Treichville', amount: 10_000, frequency: 'WEEKLY', maxMembers: 2 }).expect(201);
    const joined = await api().post(`/v1/savings/tontines/${t.body.id}/join`).set(bearer(b.token)).expect(200);
    expect(joined.body.status).toBe('ACTIVE');

    const noPin = await api().post(`/v1/savings/tontines/${t.body.id}/contribute`).set(bearer(a.token));
    expect(noPin.body.code).toBe('STRONG_AUTH_REQUIRED');
    await api().post(`/v1/savings/tontines/${t.body.id}/contribute`).set(bearer(a.token)).set('x-transaction-pin', PIN).expect(200);
    const again = await api().post(`/v1/savings/tontines/${t.body.id}/contribute`).set(bearer(a.token)).set('x-transaction-pin', PIN);
    expect(again.status).toBe(409);
    const after = await api().post(`/v1/savings/tontines/${t.body.id}/contribute`).set(bearer(b.token)).set('x-transaction-pin', PIN).expect(200);

    expect(await mainBalance(a.userId)).toBe(30_000); // 20 000 − 10 000 + cagnotte 20 000
    expect(await mainBalance(b.userId)).toBe(10_000);
    expect(after.body.currentCycle).toBe(2);
    expect(after.body.members.every((m: { hasPaid: boolean }) => !m.hasPaid)).toBe(true);
  });

  it('confirme un dépôt en attente uniquement avec une signature opérateur valide', async () => {
    const { userId } = await register();
    const tx = await prisma.transaction.create({ data: { userId, type: 'DEPOSIT', amount: 15_000, description: 'Dépôt Wave', reference: 'DLA-WEBHOOK-1', status: 'PENDING' } });
    const body = { reference: 'DLA-WEBHOOK-1', status: 'SUCCESS' };
    await api().post('/v1/webhooks/mobile-money/WAVE').set('x-signature', 'faux').send(body).expect(401);
    const sig = createHmac('sha256', 'wave-webhook-secret').update(JSON.stringify(body)).digest('hex');
    await api().post('/v1/webhooks/mobile-money/WAVE').set('x-signature', sig).send(body).expect(200);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } })).status).toBe('COMPLETED');
    expect(await mainBalance(userId)).toBe(15_000);
    await api().post('/v1/webhooks/mobile-money/WAVE').set('x-signature', sig).send(body).expect(404);
  });

  it('enregistre une réclamation avec échéance à 15 jours ouvrés', async () => {
    const { token } = await register();
    // Mesuré depuis l'instant précédant la requête : un dimanche, 15 jours ouvrés font exactement 19 jours.
    const before = Date.now();
    const c = await api().post('/v1/compliance/complaints').set(bearer(token)).send({ subject: 'Dépôt non crédité', message: 'Mon dépôt Orange Money de ce matin est absent.', category: 'TRANSACTION' }).expect(201);
    const days = (new Date(c.body.dueBy).getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(19);
    expect(days).toBeLessThanOrEqual(22);
  });

  it('valide une montée en KYC depuis le back-office', async () => {
    const { userId } = await register();
    await api().post(`/v1/compliance/admin/kyc/${userId}/approve`).set(ADMIN).send({ level: 3 }).expect(400);
    await api().post(`/v1/compliance/admin/kyc/${userId}/approve`).set(ADMIN).send({ level: 2 }).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).kycLevel).toBe(2);
  });

  it('garde une piste d’audit intègre et détecte toute altération', async () => {
    const ok = await api().get('/v1/compliance/admin/audit/verify').set(ADMIN).expect(200);
    expect(ok.body).toEqual({ valid: true });
    const row = await prisma.auditLog.findFirstOrThrow({ where: { action: 'LEDGER_DEPOSIT' }, orderBy: { seq: 'asc' } });
    await prisma.auditLog.update({ where: { id: row.id }, data: { payload: { amount: 1 } } });
    const ko = await api().get('/v1/compliance/admin/audit/verify').set(ADMIN).expect(200);
    expect(ko.body).toEqual({ valid: false, brokenAt: row.seq });
  });

  it('produit le reporting mensuel BCEAO', async () => {
    const now = new Date();
    const r = await api().get(`/v1/compliance/admin/reports/bceao?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`).set(ADMIN).expect(200);
    expect(r.body.transactions.find((t: { type: string }) => t.type === 'DEPOSIT').count).toBeGreaterThan(0);
    expect(r.body.aml.find((a: { severity: string }) => a.severity === 'RED').count).toBe(1);
  });
});
