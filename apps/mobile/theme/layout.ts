import { useWindowDimensions } from 'react-native';

/**
 * Affichage portrait sur grand écran (tablette, ordinateur) : le contenu reste une colonne
 * centrée de largeur « téléphone confortable », le fond d'écran occupe toute la surface.
 */
export const MAX_CONTENT_WIDTH = 600;
export const MAX_FORM_WIDTH = 480;

/** Largeur réellement disponible pour le contenu (≤ MAX_CONTENT_WIDTH). */
export function useContentWidth(max = MAX_CONTENT_WIDTH) {
  const { width } = useWindowDimensions();
  return Math.min(width, max);
}

/** Marge latérale pour centrer une colonne de largeur `max` dans la fenêtre. */
export function useSideGutter(max = MAX_CONTENT_WIDTH) {
  const { width } = useWindowDimensions();
  return Math.max(0, (width - max) / 2);
}

export const centeredColumn = (max = MAX_CONTENT_WIDTH) => ({ width: '100%' as const, maxWidth: max, alignSelf: 'center' as const });
