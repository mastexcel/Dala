import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, deposit, mainBalance, PIN, prisma, register, resetDb, tokenFor } from './helpers';

beforeAll(resetDb);
afterAll(() => prisma.$disconnect());

/** Utilisateur KYC 2 (transferts autorisés) avec un solde. */
async function funded(amount = 100_000) {
  const u = await register();
  await prisma.user.update({ where: { id: u.userId }, data: { kycLevel: 2 } });
  const token = await tokenFor(u.userId);
  await deposit(token, amount);
  return { ...u, token };
}

describe('Mobile money : envoyer et recevoir sur tous les opérateurs ouverts', () => {
  it('envoie vers le mobile money d’un tiers chez Orange, MTN ou Moov', async () => {
    const { token, userId } = await funded();
    for (const [provider, phone] of [['ORANGE_MONEY', '+2250708091011'], ['MTN_MOMO', '+2250506070809'], ['MOOV_MONEY', '+2250102030405']]) {
      const r = await api().post('/v1/accounts/send-mobile-money').set(bearer(token)).send({ provider, phone, amount: 10_000, note: 'Loyer' }).expect(201);
      expect(r.body.status).toBe('SUCCESS');
    }
    expect(await mainBalance(userId)).toBe(70_000);
    const tx = await prisma.transaction.findMany({ where: { userId, type: 'TRANSFER_OUT' } });
    expect(tx).toHaveLength(3);
    expect(tx.every((t) => t.status === 'COMPLETED' && (t.metadata as { channel: string }).channel === 'MOBILE_MONEY')).toBe(true);
  });

  it('refuse un numéro qui n’appartient pas à l’opérateur, Wave, et exige KYC 2 et le PIN', async () => {
    const { token } = await funded();
    const mismatch = await api().post('/v1/accounts/send-mobile-money').set(bearer(token)).send({ provider: 'ORANGE_MONEY', phone: '+2250506070809', amount: 1_000 });
    expect(mismatch.body.code).toBe('OPERATOR_MISMATCH');
    expect(mismatch.body.error).toContain('commencent par 07');
    expect((await api().post('/v1/accounts/send-mobile-money').set(bearer(token)).send({ provider: 'WAVE', phone: '+2250506070809', amount: 1_000 })).status).toBe(400);
    const noPin = await api().post('/v1/accounts/send-mobile-money').set(bearer(token)).send({ provider: 'MTN_MOMO', phone: '+2250506070809', amount: 60_000 });
    expect(noPin.body.code).toBe('STRONG_AUTH_REQUIRED');
    await api().post('/v1/accounts/send-mobile-money').set(bearer(token)).set('x-transaction-pin', PIN).send({ provider: 'MTN_MOMO', phone: '+2250506070809', amount: 60_000 }).expect(201);

    const kyc1 = await register();
    const r = await api().post('/v1/accounts/send-mobile-money').set(bearer(kyc1.token)).send({ provider: 'MTN_MOMO', phone: '+2250506070809', amount: 1_000 });
    expect(r.body.code).toBe('KYC_LEVEL');
  });

  it('recrédite le compte si l’opérateur refuse l’envoi', async () => {
    const { token, userId } = await funded(20_000);
    // Le fournisseur sandbox échoue sur les montants se terminant par 13.
    const r = await api().post('/v1/accounts/send-mobile-money').set(bearer(token)).send({ provider: 'MOOV_MONEY', phone: '+2250102030405', amount: 5_013 });
    expect(r.body.code).toBe('PROVIDER_FAILED');
    expect(await mainBalance(userId)).toBe(20_000);
  });

  it('recharge depuis un autre numéro de l’utilisateur, sur le bon opérateur', async () => {
    const { token, userId } = await register();
    await api().post('/v1/accounts/deposit').set(bearer(token)).send({ provider: 'MTN_MOMO', phone: '+2250506070809', amount: 3_000 }).expect(201);
    expect(await mainBalance(userId)).toBe(3_000);
    const wrong = await api().post('/v1/accounts/deposit').set(bearer(token)).send({ provider: 'MOOV_MONEY', phone: '+2250506070809', amount: 3_000 });
    expect(wrong.body.code).toBe('OPERATOR_MISMATCH');
  });

  it('fait payer une demande par un tiers, sans compte DALA, depuis n’importe quel opérateur ouvert', async () => {
    const { token, userId } = await register('Aya', 'Kouassi');
    const req = await api().post('/v1/payment-requests').set(bearer(token)).send({ amount: 15_000, note: 'Pagne' }).expect(201);
    expect(req.body.url).toMatch(/\/pay\/[A-Z0-9]{8}$/);

    const info = await api().get(`/v1/pay/${req.body.code}`).expect(200);
    expect(info.body).toMatchObject({ beneficiary: 'Aya K.', amount: 15_000, note: 'Pagne', status: 'OPEN' });
    expect(info.body.providers.map((p: { id: string }) => p.id)).toEqual(['ORANGE_MONEY', 'MTN_MOMO', 'MOOV_MONEY']);

    const wrong = await api().post(`/v1/pay/${req.body.code}`).send({ provider: 'MOOV_MONEY', phone: '+2250708091011' });
    expect(wrong.body.code).toBe('OPERATOR_MISMATCH');
    const paid = await api().post(`/v1/pay/${req.body.code}`).send({ provider: 'ORANGE_MONEY', phone: '+2250708091011' }).expect(201);
    expect(paid.body.status).toBe('PAID');
    expect(await mainBalance(userId)).toBe(15_000);
    expect(await prisma.notification.count({ where: { userId, title: { contains: 'Paiement reçu' } } })).toBe(1);

    const again = await api().post(`/v1/pay/${req.body.code}`).send({ provider: 'MTN_MOMO', phone: '+2250506070809' });
    expect(again.status).toBe(409);
    const list = await api().get('/v1/payment-requests').set(bearer(token)).expect(200);
    expect(list.body[0]).toMatchObject({ code: req.body.code, status: 'PAID' });
  });

  it('confirme un paiement en attente par webhook signé, et rouvre la demande en cas d’échec', async () => {
    const { token, userId } = await register();
    const req = await api().post('/v1/payment-requests').set(bearer(token)).send({ amount: 8_000 }).expect(201);
    const r = await prisma.paymentRequest.findUniqueOrThrow({ where: { code: req.body.code } });
    // Paiement en attente de validation sur le téléphone du payeur.
    const tx = await prisma.transaction.create({
      data: { userId, type: 'TRANSFER_IN', amount: 8_000, description: 'Paiement reçu', reference: 'DLA-PAY-1', status: 'PENDING', metadata: { paymentRequestId: r.id, provider: 'ORANGE_MONEY' } },
    });
    await prisma.paymentRequest.update({ where: { id: r.id }, data: { status: 'PENDING', transactionId: tx.id } });
    const sign = (b: object) => createHmac('sha256', 'orange-webhook-secret').update(JSON.stringify(b)).digest('hex');

    const failed = { reference: 'DLA-PAY-1', status: 'FAILED' };
    await api().post('/v1/webhooks/mobile-money/ORANGE_MONEY').set('x-signature', sign(failed)).send(failed).expect(200);
    expect((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('OPEN');
    expect(await mainBalance(userId)).toBe(0);

    const tx2 = await prisma.transaction.create({
      data: { userId, type: 'TRANSFER_IN', amount: 8_000, description: 'Paiement reçu', reference: 'DLA-PAY-2', status: 'PENDING', metadata: { paymentRequestId: r.id } },
    });
    await prisma.paymentRequest.update({ where: { id: r.id }, data: { status: 'PENDING', transactionId: tx2.id } });
    const ok = { reference: 'DLA-PAY-2', status: 'SUCCESS' };
    await api().post('/v1/webhooks/mobile-money/ORANGE_MONEY').set('x-signature', sign(ok)).send(ok).expect(200);
    expect((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('PAID');
    expect(await mainBalance(userId)).toBe(8_000);
  });

  it('refuse le paiement d’une demande annulée ou expirée, et sert la page publique', async () => {
    const { token } = await register();
    const a = await api().post('/v1/payment-requests').set(bearer(token)).send({ amount: 2_000 }).expect(201);
    await api().post(`/v1/payment-requests/${a.body.id}/cancel`).set(bearer(token)).expect(204);
    expect((await api().post(`/v1/pay/${a.body.code}`).send({ provider: 'ORANGE_MONEY', phone: '+2250708091011' })).body.code).toBe('REQUEST_CLOSED');

    const b = await api().post('/v1/payment-requests').set(bearer(token)).send({ amount: 2_000 }).expect(201);
    await prisma.paymentRequest.update({ where: { code: b.body.code }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    expect((await api().get(`/v1/pay/${b.body.code}`)).body.status).toBe('EXPIRED');
    expect((await api().post(`/v1/pay/${b.body.code}`).send({ provider: 'ORANGE_MONEY', phone: '+2250708091011' })).status).toBe(409);

    const page = await api().get(`/pay/${b.body.code}`).expect(200);
    expect(page.text).toContain('Service en phase de test au sein du LIF-BCEAO');
    await api().get('/pay/pay.js').expect(200);
    expect((await api().get('/v1/pay/INCONNU1')).status).toBe(404);
  });
});
