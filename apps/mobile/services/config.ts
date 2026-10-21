export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
/** Mode démo : sans URL d'API (ou forcé), l'app tourne sur un backend simulé en mémoire. */
export const USE_MOCKS = !API_URL || process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
