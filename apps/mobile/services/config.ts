export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** Environnement de construction : 'production' pour les versions remises aux utilisateurs. */
export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

/**
 * Mode démonstration (données fictives, backend simulé) : uniquement s'il est demandé
 * explicitement à la construction (APK de démonstration), et jamais en production.
 */
export const USE_MOCKS = process.env.EXPO_PUBLIC_DEMO_MODE === 'true' && APP_ENV !== 'production';

/** Configuration invalide : ni API ni mode démo (l'app affiche un écran d'erreur au lieu de démarrer). */
export const CONFIG_ERROR =
  process.env.EXPO_PUBLIC_DEMO_MODE === 'true' && APP_ENV === 'production'
    ? 'Le mode démonstration ne peut pas être activé dans une version de production.'
    : !USE_MOCKS && !API_URL
      ? "Adresse de l'API manquante (EXPO_PUBLIC_API_URL)."
      : null;
