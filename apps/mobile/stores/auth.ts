import { create } from 'zustand';
import type { UserProfile } from '@dala/shared';
import { API_URL, USE_MOCKS } from '@/services/config';
import { mockRequest } from '@/services/mock/handlers';
import { secureStorage } from '@/utils/secureStorage';

const REFRESH_KEY = 'dala.refreshToken';
const BIOMETRIC_KEY = 'dala.biometricEnabled';
const ONBOARDED_KEY = 'dala.onboarded';

interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  hydrated: boolean;
  hasStoredSession: boolean;
  biometricEnabled: boolean;
  onboarded: boolean;
  hydrate: () => Promise<void>;
  setSession: (r: AuthResponse) => Promise<void>;
  setUser: (u: UserProfile) => void;
  refresh: (opts?: { biometric?: boolean }) => Promise<boolean>;
  logout: () => Promise<void>;
  setBiometric: (enabled: boolean) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

async function postRefresh(refreshToken: string, biometric: boolean): Promise<AuthResponse> {
  const body = { refreshToken, biometric };
  if (USE_MOCKS) return mockRequest<AuthResponse>('POST', '/auth/refresh', body, {});
  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('refresh failed');
  return res.json();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  hydrated: false,
  hasStoredSession: false,
  biometricEnabled: false,
  onboarded: false,

  hydrate: async () => {
    const [refresh, bio, onboarded] = await Promise.all([
      secureStorage.getItem(REFRESH_KEY),
      secureStorage.getItem(BIOMETRIC_KEY),
      secureStorage.getItem(ONBOARDED_KEY),
    ]);
    set({ hydrated: true, hasStoredSession: !!refresh, biometricEnabled: bio === '1', onboarded: onboarded === '1' });
  },

  setSession: async ({ user, accessToken, refreshToken }) => {
    await secureStorage.setItem(REFRESH_KEY, refreshToken);
    set({ user, accessToken, hasStoredSession: true });
  },

  setUser: (user) => set({ user }),

  refresh: async ({ biometric = false } = {}) => {
    const token = await secureStorage.getItem(REFRESH_KEY);
    if (!token) return false;
    try {
      const r = await postRefresh(token, biometric);
      await get().setSession(r);
      return true;
    } catch {
      await secureStorage.deleteItem(REFRESH_KEY);
      set({ user: null, accessToken: null, hasStoredSession: false });
      return false;
    }
  },

  logout: async () => {
    const token = await secureStorage.getItem(REFRESH_KEY);
    if (token && !USE_MOCKS) {
      fetch(`${API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      }).catch(() => undefined);
    }
    await secureStorage.deleteItem(REFRESH_KEY);
    set({ user: null, accessToken: null, hasStoredSession: false });
  },

  setBiometric: async (enabled) => {
    await secureStorage.setItem(BIOMETRIC_KEY, enabled ? '1' : '0');
    set({ biometricEnabled: enabled });
  },

  completeOnboarding: async () => {
    await secureStorage.setItem(ONBOARDED_KEY, '1');
    set({ onboarded: true });
  },
}));
