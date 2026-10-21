import { QueryClient, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline-first : on sert le cache immédiatement puis on revalide quand le réseau revient.
      networkMode: 'offlineFirst',
      staleTime: 30_000,
      gcTime: 24 * 60 * 60_000,
      retry: 1,
    },
    mutations: { networkMode: 'online' },
  },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'dala.cache' });

/** Données critiques conservées hors-ligne (solde, transactions récentes, profil). */
export const PERSISTED_KEYS = ['summary', 'transactions', 'me', 'goals', 'credit'];
