import { create } from 'zustand';

interface PinRequest {
  title: string;
  subtitle?: string;
  resolve: (pin: string | null) => void;
}

interface StrongAuthState {
  request: PinRequest | null;
  /** Ouvre la feuille PIN et attend la saisie (null si annulé). */
  askPin: (title: string, subtitle?: string) => Promise<string | null>;
  close: (pin: string | null) => void;
}

export const useStrongAuthStore = create<StrongAuthState>((set, get) => ({
  request: null,
  askPin: (title, subtitle) =>
    new Promise((resolve) => {
      set({ request: { title, subtitle, resolve } });
    }),
  close: (pin) => {
    get().request?.resolve(pin);
    set({ request: null });
  },
}));
