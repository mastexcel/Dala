import { askClaude, verifyClaude } from '@/services/ai/anthropic';
import { buildMarketContext, SYSTEM_PROMPT } from '@/services/ai/context';
import { askOpenAiCompatible } from '@/services/ai/openaiCompatible';
import { AiError, type ChatTurn } from '@/services/ai/types';
import { bonds, funds, projects } from '@/services/mock/db';

const history: ChatTurn[] = [{ id: '1', role: 'user', content: 'Analyse le marché', createdAt: new Date().toISOString() }];
const base = { apiKey: 'sk-ant-test', model: 'claude-opus-5-5', system: SYSTEM_PROMPT, context: 'Données DALA', history, webSearch: true };

const message = (content: unknown[], stop_reason = 'end_turn') => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content,
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
});

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_1' } }));
}

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body as string);
const sentHeaders = (call = 0) => {
  // Le SDK transmet un objet Headers (éventuellement d'une autre implémentation que celle de Jest).
  const h = fetchMock.mock.calls[call][1].headers;
  const entries: Iterable<[string, string]> = typeof h?.entries === 'function' ? h.entries() : Array.isArray(h) ? h : Object.entries(h ?? {});
  return Object.fromEntries([...entries].map(([k, v]) => [k.toLowerCase(), v])) as Record<string, string>;
};

describe('contexte de marché envoyé à l’IA', () => {
  const snapshot = { bonds, funds, projects: projects.filter((p) => p.status === 'ACTIVE') };

  it('décrit les titres, les fonds et les projets en FCFA', () => {
    const ctx = buildMarketContext(snapshot, new Date('2026-10-24'));
    expect(ctx).toContain('Titres publics et Sukuk');
    expect(ctx).toContain(bonds[0].issuerName);
    expect(ctx).toContain('AgriTech CI');
    expect(ctx).toContain('Bridge Investment Partners');
    expect(ctx).toMatch(/FCFA/);
    expect(ctx).not.toMatch(/€|\bEUR\b|\bUSD\b|\$/);
    expect(ctx).not.toContain("Situation de l'utilisateur");
  });

  it("n'ajoute la situation personnelle qu'avec l'accord de l'utilisateur", () => {
    const ctx = buildMarketContext({ ...snapshot, summary: { total: 900_000, main: 245_000, savings: 300_000, savingsTarget: 600_000, vault: 100_000, investments: 125_000, crowdfund: 75_000, crowdfundActiveProjects: 2, creditOutstanding: 0, creditEligible: 150_000, monthDelta: 0, monthDeltaPct: 0 } }, new Date());
    expect(ctx).toContain("Situation de l'utilisateur");
    expect(ctx).toContain('245');
  });

  it('cadre le crowdfunding en capital et le caractère non personnalisé des réponses', () => {
    expect(SYSTEM_PROMPT).toContain('uniquement du financement en capital');
    expect(SYSTEM_PROMPT).toContain('pas un conseil en investissement personnalisé');
    expect(SYSTEM_PROMPT).toMatch(/FCFA/);
  });
});

describe('Claude (clé de l’utilisateur)', () => {
  it('appelle directement l’API Messages avec repli automatique et recherche web', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply(200, message([{ type: 'text', text: 'Les taux sont stables.', citations: [{ type: 'web_search_result_location', url: 'https://www.umoatitres.org', title: 'UMOA-Titres', cited_text: 'x', encrypted_index: 'e' }] }])),
    );
    const r = await askClaude(base);
    expect(r).toEqual({ content: 'Les taux sont stables.', sources: [{ url: 'https://www.umoatitres.org', title: 'UMOA-Titres' }] });

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/);
    const headers = sentHeaders();
    expect(headers.authorization).toBe('Bearer sk-ant-test');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
    const body = sentBody();
    expect(body).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', output_config: { effort: 'medium' }, messages: [{ role: 'user', content: 'Analyse le marché' }] });
    expect(body.system[0].text).toBe(SYSTEM_PROMPT);
    expect(body.tools).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }]);
    expect(body.thinking).toBeUndefined();
  });

  it('reprend une réponse mise en pause par la recherche web', async () => {
    fetchMock
      .mockImplementationOnce(() => reply(200, message([{ type: 'text', text: 'Début. ' }], 'pause_turn')))
      .mockImplementationOnce(() => reply(200, message([{ type: 'text', text: 'Fin.' }])));
    const r = await askClaude(base);
    expect(r.content).toBe('Début. Fin.');
    expect(sentBody(1).messages.at(-1)).toMatchObject({ role: 'assistant' });
  });

  it('répond sans recherche web si elle est désactivée pour la clé', async () => {
    fetchMock
      .mockImplementationOnce(() => reply(400, { type: 'error', error: { type: 'invalid_request_error', message: 'web_search is not enabled for this organization' } }))
      .mockImplementationOnce(() => reply(200, message([{ type: 'text', text: 'Réponse.' }])));
    await expect(askClaude(base)).resolves.toMatchObject({ content: 'Réponse.' });
    expect(sentBody(1).tools).toBeUndefined();
  });

  it('signale une clé refusée et un refus du modèle', async () => {
    fetchMock.mockImplementation(() => reply(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
    await expect(askClaude({ ...base, webSearch: false })).rejects.toMatchObject({ kind: 'auth' });
    fetchMock.mockReset();
    fetchMock.mockImplementationOnce(() => reply(200, message([], 'refusal')));
    await expect(askClaude(base)).rejects.toMatchObject({ kind: 'refusal' });
  });

  it("n'envoie le repli et l'effort qu'aux modèles qui les acceptent", async () => {
    fetchMock.mockImplementationOnce(() => reply(200, message([{ type: 'text', text: 'ok' }])));
    await askClaude({ ...base, model: 'claude-haiku-5-5', webSearch: false });
    const body = sentBody();
    expect(body.fallbacks).toBeUndefined();
    expect(body.output_config).toEqual({ effort: 'medium' });
    expect(sentHeaders()['anthropic-beta']).toBeUndefined();
  });

  it('vérifie la clé sans consommer de jetons', async () => {
    fetchMock.mockImplementationOnce(() => reply(200, { id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }));
    await verifyClaude('sk-ant-test', 'claude-opus-5-5');
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.anthropic.com/v1/models/claude-opus-5-5');
  });
});

describe('fournisseur compatible OpenAI', () => {
  it('envoie le prompt système et l’historique, puis lit la réponse', async () => {
    fetchMock.mockImplementationOnce(() => reply(200, { choices: [{ message: { role: 'assistant', content: ' Bonjour ' } }] }));
    const r = await askOpenAiCompatible({ apiKey: 'k', baseUrl: 'https://api.mistral.ai/v1/', model: 'mistral-large-latest', system: 'S', context: 'C', history });
    expect(r.content).toBe('Bonjour');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer k');
    expect(sentBody().messages).toEqual([{ role: 'system', content: 'S\n\nC' }, { role: 'user', content: 'Analyse le marché' }]);
  });

  it('refuse une adresse invalide sans appel réseau', async () => {
    await expect(askOpenAiCompatible({ apiKey: 'k', baseUrl: 'ftp://x', model: 'm', system: 'S', context: 'C', history })).rejects.toBeInstanceOf(AiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
