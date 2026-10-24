import { mockRequest } from '@/services/mock/handlers';
import { ApiError } from '@/services/errors';

jest.setTimeout(10_000);

describe('backend simulé (mode démo)', () => {
  it('exige le PIN au-delà de 50 000 FCFA (art. 84)', async () => {
    await expect(mockRequest('POST', '/investments', { instrumentId: 'bt-ci-364', amount: 60_000 }, {})).rejects.toMatchObject({ code: 'STRONG_AUTH_REQUIRED' });
    await expect(mockRequest('POST', '/investments', { instrumentId: 'bt-ci-364', amount: 60_000 }, { 'x-transaction-pin': '0000' })).rejects.toMatchObject({ code: 'INVALID_PIN' });
  });

  it('investit et débite le compte principal', async () => {
    const before = await mockRequest<{ main: number }>('GET', '/accounts/summary', undefined, {});
    await mockRequest('POST', '/investments', { instrumentId: 'bt-ci-364', amount: 20_000 }, {});
    const after = await mockRequest<{ main: number }>('GET', '/accounts/summary', undefined, {});
    expect(after.main).toBe(before.main - 20_000);
  });

  it('refuse un ticket crowdfunding sous le minimum', async () => {
    await expect(mockRequest('POST', '/crowdfund/projects/p1/invest', { amount: 1_000 }, {})).rejects.toBeInstanceOf(ApiError);
  });

  it('filtre les transactions par catégorie', async () => {
    const r = await mockRequest<{ items: { type: string }[] }>('GET', '/transactions?category=CROWDFUND', undefined, {});
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((t) => t.type.startsWith('CROWDFUND'))).toBe(true);
  });
});

describe('équipe commerciale (mode démo)', () => {
  it('accuse réception puis fait répondre une conseillère', async () => {
    const { advisorDemo } = jest.requireActual('@/services/mock/handlers');
    advisorDemo.delayMs = 10;
    const c = await mockRequest<{ id: string; messages: { sender: string }[] }>('POST', '/advisor/conversations', { topic: 'CROWDFUND', message: 'Bonjour' }, {});
    expect(c.messages.map((m) => m.sender)).toEqual(['USER', 'SYSTEM']);
    await new Promise((r) => setTimeout(r, 50));
    const list = await mockRequest<{ id: string; unread: number; advisorName: string }[]>('GET', '/advisor/conversations', undefined, {});
    expect(list[0]).toMatchObject({ id: c.id, unread: 1 });
    const detail = await mockRequest<{ messages: { sender: string; body: string }[] }>('GET', `/advisor/conversations/${c.id}`, undefined, {});
    expect(detail.messages.at(-1)).toMatchObject({ sender: 'ADVISOR' });
    expect(detail.messages.at(-1)!.body).toContain('uniquement en capital');
    const after = await mockRequest<{ unread: number }[]>('GET', '/advisor/conversations', undefined, {});
    expect(after[0].unread).toBe(0);
  });
});
