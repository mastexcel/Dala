import { create } from 'zustand';

interface UiState {
  balanceHidden: boolean;
  toggleBalance: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  balanceHidden: false,
  toggleBalance: () => set((s) => ({ balanceHidden: !s.balanceHidden })),
}));
