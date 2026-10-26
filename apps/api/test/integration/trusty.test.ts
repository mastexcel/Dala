import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { trustyTimers } from '../../src/jobs/tasks';
import { ADMIN, PIN, api, bearer, deposit, mainBalance, prisma, register, resetDb, tokenFor } from './helpers';

beforeAll(resetDb);
afterAll(() => prisma.$disconnect());

/** Utilisateur KYC 2 avec un solde. */
async function user(first: string, amount = 0) {
  const u = await register(first, 'Test');
  await prisma.user.update({ where: { id: u.userId }, data: { kycLevel: 2 } });
  const token = await tokenFor(u.userId);
  if (amount) await deposit(token, amount);
  return { ...u, token };
}

const escrowBalance = async (userId: string) => Number((await prisma.account.findFirst({ where: { userId, type: 'ESCROW' } }))?.balance ?? 0);

/** Proposition de l'acheteur acceptée par le vendeur, puis fonds bloqués. */
async function funded(amount = 40_000, opts: { deliveryDays?: number; inspectionHours?: number } = {}) {
  const buyer = await user('Awa', 100_000);
  const seller = await user('Koffi');
  const created = await api().post('/v1/trusty').set(bearer(buyer.token)).send({ role: 'BUYER', counterpartyPhone: seller.phone, title: 'Téléphone Tecno Spark', amount, ...opts }).expect(201);
  const id = created.body.id as string;
  await api().post(`/v1/trusty/${id}/accept`).set(bearer(seller.token)).expect(200);
  await api().post(`/v1/trusty/${id}/fund`).set(bearer(buyer.token)).send({ amount }).expect(200);
  return { buyer, seller, id };
}

describe('Trusty : transaction sécurisée par séquestre', () => {
  it('protocole complet : proposition, acceptation, fonds bloqués, code de remise, vendeur payé', async () => {
    const buyer = await user('Awa', 100_000);
    const seller = await user('Koffi');
    const r = await api().post('/v1/trusty').set(bearer(buyer.token)).send({ role: 'BUYER', counterpartyPhone: seller.phone, title: 'Téléphone Tecno Spark', amount: 60_000 }).expect(201);
    expect(r.body).toMatchObject({ status: 'PROPOSED', role: 'BUYER', actions: ['cancel', 'message'] });
    // L'initiateur ne peut pas accepter sa propre proposition, ni bloquer avant l'acceptation.
    expect((await api().post(`/v1/trusty/${r.body.id}/accept`).set(bearer(buyer.token))).body.code).toBe('ESCROW_STATE');
    expect((await api().post(`/v1/trusty/${r.body.id}/fund`).set(bearer(buyer.token)).set('x-transaction-pin', PIN).send({ amount: 60_000 })).body.code).toBe('ESCROW_STATE');

    const accepted = await api().post(`/v1/trusty/${r.body.id}/accept`).set(bearer(seller.token)).expect(200);
    expect(accepted.body).toMatchObject({ status: 'ACCEPTED', role: 'SELLER' });
    expect((await api().post(`/v1/trusty/${r.body.id}/fund`).set(bearer(buyer.token)).send({ amount: 60_000 })).body.code).toBe('STRONG_AUTH_REQUIRED');
    expect((await api().post(`/v1/trusty/${r.body.id}/fund`).set(bearer(buyer.token)).set('x-transaction-pin', PIN).send({ amount: 50_000 })).body.code).toBe('AMOUNT_MISMATCH');
    const f = await api().post(`/v1/trusty/${r.body.id}/fund`).set(bearer(buyer.token)).set('x-transaction-pin', PIN).send({ amount: 60_000 }).expect(200);
    expect(f.body.status).toBe('FUNDED');
    expect(f.body.releaseCode).toMatch(/^\d{6}$/);
    expect(await mainBalance(buyer.userId)).toBe(40_000);
    expect(await escrowBalance(buyer.userId)).toBe(60_000);
    // Le vendeur voit les fonds bloqués mais jamais le code.
    const sellerView = await api().get(`/v1/trusty/${r.body.id}`).set(bearer(seller.token)).expect(200);
    expect(sellerView.body.releaseCode).toBeNull();
    expect(sellerView.body.actions).toEqual(expect.arrayContaining(['deliver', 'redeem', 'refund']));
    expect((await api().get('/v1/accounts/summary').set(bearer(buyer.token))).body).toMatchObject({ main: 40_000, escrow: 60_000, total: 100_000 });

    const wrong = await api().post(`/v1/trusty/${r.body.id}/redeem`).set(bearer(seller.token)).send({ code: f.body.releaseCode === '000000' ? '111111' : '000000' });
    expect(wrong.body).toMatchObject({ code: 'INVALID_CODE', details: { attemptsLeft: 4 } });
    const done = await api().post(`/v1/trusty/${r.body.id}/redeem`).set(bearer(seller.token)).send({ code: f.body.releaseCode }).expect(200);
    expect(done.body.status).toBe('RELEASED');
    expect(await mainBalance(seller.userId)).toBe(60_000);
    expect(await escrowBalance(buyer.userId)).toBe(0);
    // Historique de l'acheteur : une seule ligne (le blocage), pas de double débit affiché.
    const buyerTx = await prisma.transaction.findMany({ where: { userId: buyer.userId, type: { in: ['ESCROW_HOLD', 'ESCROW_RELEASE', 'ESCROW_REFUND'] } } });
    expect(buyerTx.map((t) => [t.type, Number(t.amount)])).toEqual([['ESCROW_HOLD', -60_000]]);
    // La transaction réussie compte dans la confiance affichée à l'autre participant.
    const next = await api().post('/v1/trusty').set(bearer(seller.token)).send({ role: 'SELLER', counterpartyPhone: buyer.phone, title: 'Coque', amount: 2_000 }).expect(201);
    expect(next.body.counterparty.completedDeals).toBe(1);
  });

  it('livraison à distance : l’acheteur confirme avec son PIN, ou le vendeur est payé à la fin du délai de vérification', async () => {
    const a = await funded();
    await api().post(`/v1/trusty/${a.id}/deliver`).set(bearer(a.seller.token)).send({ note: 'Colis remis à UTB, suivi 4821' }).expect(200);
    expect((await api().post(`/v1/trusty/${a.id}/release`).set(bearer(a.buyer.token))).body.code).toBe('STRONG_AUTH_REQUIRED');
    expect((await api().post(`/v1/trusty/${a.id}/release`).set(bearer(a.seller.token)).set('x-transaction-pin', PIN)).body.code).toBe('ESCROW_STATE');
    await api().post(`/v1/trusty/${a.id}/release`).set(bearer(a.buyer.token)).set('x-transaction-pin', PIN).expect(200);
    expect(await mainBalance(a.seller.userId)).toBe(40_000);

    const b = await funded(30_000, { inspectionHours: 24 });
    await api().post(`/v1/trusty/${b.id}/deliver`).set(bearer(b.seller.token)).send({}).expect(200);
    expect((await trustyTimers(new Date(Date.now() + 23 * 3_600_000))).released).toBe(0);
    expect((await trustyTimers(new Date(Date.now() + 25 * 3_600_000))).released).toBe(1);
    expect(await mainBalance(b.seller.userId)).toBe(30_000);
    const view = await api().get(`/v1/trusty/${b.id}`).set(bearer(b.buyer.token)).expect(200);
    expect(view.body.events.at(-1)).toMatchObject({ actor: 'SYSTEM', type: 'RELEASED' });
  });

  it('litige : fonds gelés, échanges, puis décision de partage du médiateur', async () => {
    const a = await funded(40_000);
    await api().post(`/v1/trusty/${a.id}/deliver`).set(bearer(a.seller.token)).send({}).expect(200);
    const d = await api().post(`/v1/trusty/${a.id}/dispute`).set(bearer(a.buyer.token)).send({ reason: 'L’écran est fissuré à la réception.' }).expect(200);
    expect(d.body.status).toBe('DISPUTED');
    expect(d.body.actions).not.toContain('release');
    // Le délai de vérification ne libère plus rien pendant un litige.
    expect((await trustyTimers(new Date(Date.now() + 30 * 86_400_000))).released).toBe(0);
    await api().post(`/v1/trusty/${a.id}/messages`).set(bearer(a.seller.token)).send({ message: 'Il était intact au départ, voici la photo du colis.' }).expect(201);

    expect((await api().get('/v1/trusty-desk/escrows')).status).toBe(403);
    const list = await api().get('/v1/trusty-desk/escrows').set(ADMIN).expect(200);
    expect(list.body.map((e: { id: string }) => e.id)).toContain(a.id);
    await api().post(`/v1/trusty-desk/escrows/${a.id}/messages`).set(ADMIN).send({ message: 'Merci, nous examinons les photos.', authorName: 'Mariam' }).expect(201);
    expect((await api().post(`/v1/trusty-desk/escrows/${a.id}/resolve`).set(ADMIN).send({ sellerAmount: 50_000, note: 'Dommage constaté.', authorName: 'Mariam' })).status).toBe(400);
    const r = await api().post(`/v1/trusty-desk/escrows/${a.id}/resolve`).set(ADMIN).send({ sellerAmount: 25_000, note: 'Écran à remplacer : remise de 15 000 FCFA.', authorName: 'Mariam' }).expect(200);
    expect(r.body).toMatchObject({ status: 'RELEASED', sellerAmount: 25_000, buyerAmount: 15_000 });
    expect(await mainBalance(a.seller.userId)).toBe(25_000);
    expect(await mainBalance(a.buyer.userId)).toBe(60_000 + 15_000);
    const view = await api().get(`/v1/trusty/${a.id}`).set(bearer(a.buyer.token)).expect(200);
    expect(view.body.resolution).toMatchObject({ sellerAmount: 25_000, buyerAmount: 15_000 });
  });

  it('sans livraison : l’acheteur récupère ses fonds après le délai, ou automatiquement après la marge', async () => {
    const a = await funded(20_000, { deliveryDays: 1 });
    expect((await api().post(`/v1/trusty/${a.id}/reclaim`).set(bearer(a.buyer.token))).body.code).toBe('ESCROW_STATE');
    await prisma.escrow.update({ where: { id: a.id }, data: { deliveryDeadline: new Date(Date.now() - 1_000) } });
    await api().post(`/v1/trusty/${a.id}/reclaim`).set(bearer(a.buyer.token)).expect(200);
    expect(await mainBalance(a.buyer.userId)).toBe(100_000);

    const b = await funded(20_000, { deliveryDays: 1 });
    expect((await trustyTimers(new Date(Date.now() + 2 * 86_400_000))).refunded).toBe(0);
    expect((await trustyTimers(new Date(Date.now() + 5 * 86_400_000))).refunded).toBe(1);
    expect(await mainBalance(b.buyer.userId)).toBe(100_000);
    expect(await escrowBalance(b.buyer.userId)).toBe(0);
  });

  it('garde-fous : plafond, KYC 2, compte DALA requis, code bloqué après 5 erreurs, proposition expirée', async () => {
    const buyer = await user('Awa', 10_000);
    const seller = await user('Koffi');
    expect((await api().post('/v1/trusty').set(bearer(buyer.token)).send({ role: 'BUYER', counterpartyPhone: seller.phone, title: 'Moto', amount: 600_000 })).status).toBe(400);
    expect((await api().post('/v1/trusty').set(bearer(buyer.token)).send({ role: 'BUYER', counterpartyPhone: '+2250799999999', title: 'Moto', amount: 5_000 })).status).toBe(404);
    const kyc1 = await register('Yao', 'Test');
    expect((await api().post('/v1/trusty').set(bearer(kyc1.token)).send({ role: 'BUYER', counterpartyPhone: seller.phone, title: 'Moto', amount: 5_000 })).body.code).toBe('KYC_LEVEL');
    // Solde insuffisant : rien n'est bloqué.
    const big = await api().post('/v1/trusty').set(bearer(seller.token)).send({ role: 'SELLER', counterpartyPhone: buyer.phone, title: 'Sac de riz x10', amount: 20_000 }).expect(201);
    await api().post(`/v1/trusty/${big.body.id}/accept`).set(bearer(buyer.token)).expect(200);
    expect((await api().post(`/v1/trusty/${big.body.id}/fund`).set(bearer(buyer.token)).send({ amount: 20_000 })).body.code).toBe('INSUFFICIENT_FUNDS');
    expect((await prisma.escrow.findUniqueOrThrow({ where: { id: big.body.id } })).status).toBe('ACCEPTED');

    const a = await funded(10_000);
    for (let i = 0; i < 5; i++) await api().post(`/v1/trusty/${a.id}/redeem`).set(bearer(a.seller.token)).send({ code: '999999' });
    const view = await api().get(`/v1/trusty/${a.id}`).set(bearer(a.seller.token)).expect(200);
    // Le code tiré au hasard peut valoir 999999 : dans ce cas la transaction est déjà terminée.
    if (view.body.status === 'FUNDED') {
      expect(view.body.actions).not.toContain('redeem');
      expect(view.body.codeAttemptsLeft).toBe(0);
    }

    expect((await trustyTimers(new Date(Date.now() + 8 * 86_400_000))).expired).toBeGreaterThanOrEqual(1);
    expect((await prisma.escrow.findUniqueOrThrow({ where: { id: big.body.id } })).status).toBe('CANCELLED');
  });
});
