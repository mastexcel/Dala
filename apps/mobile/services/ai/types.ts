/** Assistant IA connecté par l'utilisateur avec sa propre clé d'API. */

export type AiProviderId = 'anthropic' | 'openai' | 'compatible';

export interface AiModelOption {
  id: string;
  label: string;
}

export interface AiProviderPreset {
  id: AiProviderId;
  label: string;
  /** Où l'utilisateur obtient sa clé. */
  keyUrl?: string;
  keyPlaceholder: string;
  baseUrl?: string;
  models: AiModelOption[];
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderPreset> = {
  anthropic: {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-…',
    models: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 · le plus complet' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 · rapide' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 · économique' },
    ],
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-…',
    baseUrl: 'https://api.openai.com/v1',
    models: [{ id: 'gpt-4o-mini', label: 'gpt-4o-mini' }],
  },
  compatible: {
    id: 'compatible',
    label: 'Autre (compatible OpenAI)',
    keyPlaceholder: 'Clé du fournisseur',
    models: [],
  },
};

export interface AiSettings {
  provider: AiProviderId;
  model: string;
  /** Adresse de l'API pour un fournisseur compatible OpenAI (Mistral, Groq, OpenRouter, Ollama…). */
  baseUrl: string;
  /** Joindre soldes et portefeuille de l'utilisateur au contexte envoyé à l'IA. */
  shareFinancialData: boolean;
  /** Recherche web côté Claude pour l'actualité des marchés. */
  webSearch: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'anthropic',
  model: AI_PROVIDERS.anthropic.models[0].id,
  baseUrl: '',
  shareFinancialData: true,
  webSearch: true,
};

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** Sources citées par la recherche web. */
  sources?: { title: string; url: string }[];
}

export interface AiReply {
  content: string;
  sources: { title: string; url: string }[];
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate_limit' | 'network' | 'refusal' | 'config' | 'provider',
  ) {
    super(message);
  }
}
