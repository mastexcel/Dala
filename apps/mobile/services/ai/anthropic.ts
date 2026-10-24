import Anthropic from '@anthropic-ai/sdk';
import { AiError, type AiReply, type ChatTurn } from './types';

/** Modèles qui acceptent le réglage d'effort et le repli automatique côté serveur. */
const MANAGED_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']);
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);
/** Relances après une pause de la recherche web (pause_turn). */
const MAX_CONTINUATIONS = 3;

interface Options {
  apiKey: string;
  model: string;
  system: string;
  context: string;
  history: ChatTurn[];
  webSearch: boolean;
}

export function anthropicClient(apiKey: string) {
  // La clé appartient à l'utilisateur et ne quitte que son appareil : l'appel direct
  // depuis l'app (y compris la version web) est donc voulu.
  return new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com', dangerouslyAllowBrowser: true, timeout: 120_000, maxRetries: 2 });
}

function params({ model, system, context, webSearch }: Options, messages: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.MessageCreateParamsNonStreaming {
  const managed = MANAGED_MODELS.has(model);
  return {
    model,
    max_tokens: 16_000,
    system: [
      { type: 'text', text: system },
      { type: 'text', text: context },
    ],
    messages,
    ...(managed ? { output_config: { effort: 'medium' as const } } : {}),
    ...(FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    ...(webSearch && managed ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 }] } : {}),
  };
}

function toAiError(e: unknown): AiError {
  if (e instanceof Anthropic.AuthenticationError) return new AiError('Clé API refusée par Anthropic. Vérifiez-la dans les réglages de l’assistant.', 'auth');
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError('Cette clé n’a pas accès au modèle choisi.', 'auth');
  if (e instanceof Anthropic.RateLimitError) return new AiError('Limite d’utilisation atteinte chez Anthropic. Réessayez dans un instant.', 'rate_limit');
  if (e instanceof Anthropic.BadRequestError) return new AiError(`Requête refusée par Anthropic : ${e.message}`, 'provider');
  if (e instanceof Anthropic.APIConnectionError) return new AiError('Impossible de joindre Anthropic. Vérifiez votre connexion.', 'network');
  if (e instanceof Anthropic.APIError) return new AiError(`Erreur Anthropic (${e.status ?? '?'}) : ${e.message}`, 'provider');
  return new AiError(e instanceof Error ? e.message : 'Erreur inconnue', 'provider');
}

const isWebSearchUnavailable = (e: unknown) => e instanceof Anthropic.BadRequestError && /web_search/i.test(e.message);

export async function askClaude(opts: Options): Promise<AiReply> {
  const client = anthropicClient(opts.apiKey);
  const messages: Anthropic.Beta.BetaMessageParam[] = opts.history.map((t) => ({ role: t.role, content: t.content }));
  try {
    return await run(client, opts, messages);
  } catch (e) {
    // Recherche web désactivée pour l'organisation : on répond sans.
    if (opts.webSearch && isWebSearchUnavailable(e)) {
      try {
        return await run(client, { ...opts, webSearch: false }, messages);
      } catch (e2) {
        throw toAiError(e2);
      }
    }
    throw e instanceof AiError ? e : toAiError(e);
  }
}

async function run(client: Anthropic, opts: Options, initial: Anthropic.Beta.BetaMessageParam[]): Promise<AiReply> {
  const messages = [...initial];
  const texts: string[] = [];
  const sources = new Map<string, string>();
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const response = await client.beta.messages.create(params(opts, messages));
    if (response.stop_reason === 'refusal') {
      throw new AiError('L’assistant a décliné cette demande. Reformulez votre question.', 'refusal');
    }
    for (const block of response.content) {
      if (block.type === 'text') {
        texts.push(block.text);
        for (const c of block.citations ?? []) {
          if (c.type === 'web_search_result_location') sources.set(c.url, c.title ?? c.url);
        }
      }
    }
    // La recherche web peut mettre la réponse en pause : on la relance là où elle s'est arrêtée.
    if (response.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: response.content });
  }
  const content = texts.join('').trim();
  if (!content) throw new AiError('Réponse vide de l’assistant. Réessayez.', 'provider');
  return { content, sources: [...sources].map(([url, title]) => ({ url, title })) };
}

/** Vérifie la clé et l'accès au modèle sans consommer de jetons. */
export async function verifyClaude(apiKey: string, model: string) {
  try {
    await anthropicClient(apiKey).models.retrieve(model);
  } catch (e) {
    if (e instanceof Anthropic.NotFoundError) throw new AiError(`Modèle « ${model} » introuvable pour cette clé.`, 'config');
    throw toAiError(e);
  }
}
