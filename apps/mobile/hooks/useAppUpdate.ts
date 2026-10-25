import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';

/** Numéro de version intégré à la construction par le workflow (absent en développement). */
export const BUILD_NUMBER = Number(process.env.EXPO_PUBLIC_BUILD_NUMBER ?? 0) || null;

/** Fiche publiée avec chaque APK de test : lien permanent vers la dernière version. */
export const UPDATE_MANIFEST_URL = 'https://github.com/mastexcel/Dala/releases/download/test-android/version.json';
export const LATEST_APK_URL = 'https://github.com/mastexcel/Dala/releases/download/test-android/DALA-Finance.apk';

export interface UpdateManifest {
  versionCode: number;
  commit: string;
  publishedAt: string;
  url: string;
}

export function isNewer(manifest: UpdateManifest | undefined, current: number | null) {
  return !!manifest && current !== null && manifest.versionCode > current;
}

/** Vérifie (au plus toutes les 6 h) si une version plus récente de l'APK est publiée. */
export function useAppUpdate() {
  const enabled = Platform.OS === 'android' && BUILD_NUMBER !== null;
  const q = useQuery({
    queryKey: ['app-update'],
    enabled,
    staleTime: 6 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as UpdateManifest;
    },
  });
  return { available: enabled && isNewer(q.data, BUILD_NUMBER), latest: q.data };
}
