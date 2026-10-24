import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '@/utils/secureStorage';
import { DEFAULT_AI_SETTINGS, type AiSettings, type ChatTurn } from '@/services/ai/types';

const KEY_STORAGE = 'dala.ai.apiKey';
const SETTINGS_STORAGE = 'dala.ai.settings';
const HISTORY_STORAGE = 'dala.ai.history';
/** Taille maximale de l'historique conservé et renvoyé à l'IA. */
export const MAX_TURNS = 40;

interface AssistantState {
  hydrated: boolean;
  /** Clé de l'utilisateur, gardée dans le trousseau sécurisé de l'appareil uniquement. */
  apiKey: string;
  settings: AiSettings;
  turns: ChatTurn[];
  hydrate: () => Promise<void>;
  connect: (apiKey: string, settings: AiSettings) => Promise<void>;
  updateSettings: (patch: Partial<AiSettings>) => Promise<void>;
  disconnect: () => Promise<void>;
  addTurn: (turn: ChatTurn) => void;
  clearHistory: () => void;
}

const saveHistory = (turns: ChatTurn[]) => void AsyncStorage.setItem(HISTORY_STORAGE, JSON.stringify(turns)).catch(() => undefined);

export const useAssistantStore = create<AssistantState>((set, get) => ({
  hydrated: false,
  apiKey: '',
  settings: DEFAULT_AI_SETTINGS,
  turns: [],
  hydrate: async () => {
    if (get().hydrated) return;
    const [apiKey, settings, history] = await Promise.all([
      secureStorage.getItem(KEY_STORAGE).catch(() => null),
      AsyncStorage.getItem(SETTINGS_STORAGE).catch(() => null),
      AsyncStorage.getItem(HISTORY_STORAGE).catch(() => null),
    ]);
    set({
      hydrated: true,
      apiKey: apiKey ?? '',
      settings: settings ? { ...DEFAULT_AI_SETTINGS, ...(JSON.parse(settings) as Partial<AiSettings>) } : DEFAULT_AI_SETTINGS,
      turns: history ? (JSON.parse(history) as ChatTurn[]) : [],
    });
  },
  connect: async (apiKey, settings) => {
    await secureStorage.setItem(KEY_STORAGE, apiKey);
    await AsyncStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
    set({ apiKey, settings });
  },
  updateSettings: async (patch) => {
    const settings = { ...get().settings, ...patch };
    await AsyncStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
    set({ settings });
  },
  disconnect: async () => {
    await secureStorage.deleteItem(KEY_STORAGE);
    await AsyncStorage.removeItem(SETTINGS_STORAGE);
    set({ apiKey: '', settings: DEFAULT_AI_SETTINGS });
  },
  addTurn: (turn) => {
    const turns = [...get().turns, turn].slice(-MAX_TURNS);
    set({ turns });
    saveHistory(turns);
  },
  clearHistory: () => {
    set({ turns: [] });
    void AsyncStorage.removeItem(HISTORY_STORAGE).catch(() => undefined);
  },
}));

/** Un fournisseur compatible OpenAI local (Ollama…) peut fonctionner sans clé. */
export const isAssistantConnected = (s: Pick<AssistantState, 'apiKey' | 'settings'>) =>
  !!s.apiKey || (s.settings.provider === 'compatible' && !!s.settings.baseUrl);
