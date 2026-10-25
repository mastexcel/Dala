import { qk } from '@/hooks/queries';
import { crowdfundApi, investApi, accountApi } from '@/services/api';
import { queryClient } from '@/services/queryClient';
import { askClaude, verifyClaude } from './anthropic';
import { APP_GUIDE, buildMarketContext, HELP_PROMPT, SYSTEM_PROMPT, type MarketSnapshot } from './context';
import { TEST_PHASE } from '@dala/shared';
import { askOpenAiCompatible, verifyOpenAiCompatible } from './openaiCompatible';
import { AI_PROVIDERS, AiError, type AiReply, type AiSettings, type ChatTurn } from './types';

export * from './types';
export { buildMarketContext, SYSTEM_PROMPT } from './context';

/** Données de marché DALA (et situation de l'utilisateur s'il l'accepte), depuis le cache si possible. */
export async function loadSnapshot(shareFinancialData: boolean): Promise<MarketSnapshot> {
  const get = <T,>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
    queryClient.fetchQuery({ queryKey, queryFn, staleTime: 5 * 60_000 }).catch(() => undefined);
  const [bonds, funds, projects, summary, portfolio, crowdfund] = await Promise.all([
    get(qk.bonds(false), () => investApi.bonds(false)),
    get(qk.funds(false), () => investApi.funds(false)),
    get(qk.projects(undefined), () => crowdfundApi.projects()),
    shareFinancialData ? get(qk.summary, accountApi.summary) : undefined,
    shareFinancialData ? get(qk.portfolio, investApi.portfolio) : undefined,
    shareFinancialData ? get(qk.cfPortfolio, crowdfundApi.portfolio) : undefined,
  ]);
  return { bonds: bonds ?? [], funds: funds ?? [], projects: projects ?? [], summary, portfolio, crowdfund };
}

/** Envoie la conversation au fournisseur choisi, directement depuis l'appareil. */
export async function askAssistant(settings: AiSettings, apiKey: string, history: ChatTurn[]): Promise<AiReply> {
  if (!apiKey && settings.provider !== 'compatible') throw new AiError('Connectez d’abord une clé API.', 'config');
  if (TEST_PHASE.aiAssistant === 'off') throw new AiError("L'assistant IA n'est pas disponible pendant la phase de test.", 'config');
  // Mode « aide » : ni données personnelles, ni données de marché, ni recherche web.
  const help = TEST_PHASE.aiAssistant === 'help';
  const system = help ? HELP_PROMPT : SYSTEM_PROMPT;
  const context = help ? APP_GUIDE : buildMarketContext(await loadSnapshot(settings.shareFinancialData));
  if (settings.provider === 'anthropic') {
    return askClaude({ apiKey, model: settings.model, system, context, history, webSearch: !help && settings.webSearch });
  }
  const baseUrl = settings.provider === 'openai' ? AI_PROVIDERS.openai.baseUrl! : settings.baseUrl;
  return askOpenAiCompatible({ apiKey, baseUrl, model: settings.model, system, context, history });
}

export function verifyConnection(settings: AiSettings, apiKey: string) {
  if (settings.provider === 'anthropic') return verifyClaude(apiKey, settings.model);
  return verifyOpenAiCompatible(apiKey, settings.provider === 'openai' ? AI_PROVIDERS.openai.baseUrl! : settings.baseUrl);
}
