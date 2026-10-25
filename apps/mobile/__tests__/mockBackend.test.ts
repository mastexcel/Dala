import { mockRequest } from '@/services/mock/handlers';
import { TEST_PHASE, quoteLoan } from '@dala/shared';
import { ApiError } from '@/services/errors';

jest.setTimeout(10_000);

describe('backend simulé (mode démo)', () => {
  it('exige le PIN au-delà de 50 000 FCFA (art. 84)', async () => {
    await expect(mockRequest('POST', '/accounts/withdraw', { provider: 'ORANGE_MONEY', amount: 60_000 }, {})).rejects.toMatchObject({ code: 'STRONG_AUTH_REQUIRED' });
    await expect(mockRequest('POST', '/accounts/withdraw', { provider: 'ORANGE_MONEY', amount: 60_000 }, { 'x-transaction-pin': '0000' })).rejects.toMatchObject({ code: 'INVALID_PIN' });
  });

  it('retire vers le mobile money et débite le compte principal', async () => {
    const before = await mockRequest<{ main: number }>('GET', '/accounts/summary', undefined, {});
    await mockRequest('POST', '/accounts/withdraw', { provider: 'ORANGE_MONEY', amount: 20_000 }, {});
    const after = await mockRequest<{ main: number }>('GET', '/accounts/summary', undefined, {});
    expect(after.main).toBe(before.main - 20_000);
  });

  it('filtre les transactions par catégorie', async () => {
    const r = await mockRequest<{ items: { type: string }[] }>('GET', '/transactions?category=SAVINGS', undefined, {});
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((t) => t.type.startsWith('SAVINGS'))).toBe(true);
  });
});

describe('phase de test LIF-BCEAO (mode démo)', () => {
  it('ferme l’investissement et le crowdfunding comme l’API', async () => {
    await expect(mockRequest('GET', '/investments/bonds', undefined, {})).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
    await expect(mockRequest('POST', '/crowdfund/projects/p1/invest', { amount: 5_000 }, {})).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
  });

  it('refuse Wave, le KYC niveau 3 et les tontines de plus de 20 membres', async () => {
    await expect(mockRequest('POST', '/accounts/deposit', { provider: 'WAVE', amount: 1_000 }, {})).rejects.toBeInstanceOf(ApiError);
    await expect(mockRequest('POST', '/users/me/kyc', { targetLevel: 3 }, {})).rejects.toMatchObject({ code: 'TEST_LIMIT_REACHED' });
    await expect(mockRequest('POST', '/savings/tontines', { name: 'T', amount: 1_000, frequency: 'MONTHLY', maxMembers: 21 }, {})).rejects.toBeInstanceOf(ApiError);
  });

  it('plafonne le prêt à 100 000 FCFA et ne rémunère pas le coffre-fort', async () => {
    expect(() => quoteLoan(105_000, 30, 90)).toThrow(RangeError);
    const v = await mockRequest<{ options: { rate: number }[] }>('GET', '/savings/vaults', undefined, {});
    expect(v.options.every((o) => o.rate === 0)).toBe(true);
  });

  it("exige la majorité et l'acceptation de l'avertissement à l'inscription", async () => {
    const base = { phone: '+2250707111111', otp: '123456', firstName: 'Awa', lastName: 'Koné', pin: '2580', consent: { version: TEST_PHASE.consentVersion, accepted: true } };
    await expect(mockRequest('POST', '/auth/register', { ...base, dateOfBirth: '2012-01-01' }, {})).rejects.toMatchObject({ code: 'UNDERAGE' });
    await expect(mockRequest('POST', '/auth/register', { ...base, dateOfBirth: '1990-01-01', consent: undefined }, {})).rejects.toBeInstanceOf(ApiError);
  });

  it('exporte les données et refuse la clôture tant qu’il reste un solde', async () => {
    const exp = await mockRequest<{ user: { id: string } }>('GET', '/users/me/data/export', undefined, {});
    expect(exp.user.id).toBeTruthy();
    await expect(mockRequest('POST', '/users/me/close', undefined, { 'x-transaction-pin': '1234' })).rejects.toMatchObject({ code: 'BALANCE_NOT_EMPTY' });
  });
});

describe('équipe commerciale (mode démo)', () => {
  it('accuse réception puis fait répondre une conseillère', async () => {
    const { advisorDemo } = jest.requireActual('@/services/mock/handlers');
    advisorDemo.delayMs = 10;
    const c = await mockRequest<{ id: string; messages: { sender: string }[] }>('POST', '/advisor/conversations', { topic: 'CREDIT', message: 'Bonjour' }, {});
    expect(c.messages.map((m) => m.sender)).toEqual(['USER', 'SYSTEM']);
    await new Promise((r) => setTimeout(r, 50));
    const list = await mockRequest<{ id: string; unread: number; advisorName: string }[]>('GET', '/advisor/conversations', undefined, {});
    expect(list[0]).toMatchObject({ id: c.id, unread: 1 });
    const detail = await mockRequest<{ messages: { sender: string; body: string }[] }>('GET', `/advisor/conversations/${c.id}`, undefined, {});
    expect(detail.messages.at(-1)).toMatchObject({ sender: 'ADVISOR' });
    expect(detail.messages.at(-1)!.body).toMatch(/limité à 100.000.FCFA/);
    const after = await mockRequest<{ unread: number }[]>('GET', '/advisor/conversations', undefined, {});
    expect(after[0].unread).toBe(0);
  });
});

describe('mobile money sur tous les opérateurs ouverts (mode démo)', () => {
  it('envoie vers un numéro MTN et refuse un numéro qui ne correspond pas à l’opérateur', async () => {
    const before = await mockRequest<{ main: number }>('GET', '/accounts/summary', undefined, {});
    await mockRequest('POST', '/accounts/send-mobile-money', { provider: 'MTN_MOMO', phone: '+2250506070809', amount: 5_000 }, {});
    const after = await mockRequest<{ main: number }>('GET', '/accounts/summary', undefined, {});
    expect(after.main).toBe(before.main - 5_000);
    await expect(mockRequest('POST', '/accounts/send-mobile-money', { provider: 'ORANGE_MONEY', phone: '+2250506070809', amount: 5_000 }, {})).rejects.toMatchObject({ code: 'OPERATOR_MISMATCH' });
  });

  it('crée une demande de paiement, la fait payer par un tiers, puis la ferme', async () => {
    const r = await mockRequest<{ id: string; code: string; url: string }>('POST', '/payment-requests', { amount: 7_000, note: 'Repas' }, {});
    expect(r.url).toContain(`/pay/${r.code}`);
    const before = await mockRequest<{ main: number }>('GET', '/accounts/summary', undefined, {});
    await mockRequest('POST', `/pay/${r.code}`, { provider: 'MOOV_MONEY', phone: '+2250102030405' }, {});
    const after = await mockRequest<{ main: number }>('GET', '/accounts/summary', undefined, {});
    expect(after.main).toBe(before.main + 7_000);
    const list = await mockRequest<{ code: string; status: string }[]>('GET', '/payment-requests', undefined, {});
    expect(list.find((x) => x.code === r.code)?.status).toBe('PAID');
    await expect(mockRequest('POST', `/pay/${r.code}`, { provider: 'MOOV_MONEY', phone: '+2250102030405' }, {})).rejects.toMatchObject({ code: 'REQUEST_CLOSED' });
  });
});
