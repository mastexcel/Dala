import { useWindowDimensions } from 'react-native';

/**
 * Mise en page adaptative.
 * - Téléphone : portrait verrouillé, pleine largeur.
 * - Tablette / ordinateur en portrait : colonne centrée de 600 px.
 * - Tablette / ordinateur en paysage (≥ 900 px de large) : rail de navigation latéral,
 *   colonne élargie à 960 px et cartes sur deux colonnes.
 */
export const MAX_CONTENT_WIDTH = 600;
export const MAX_CONTENT_WIDTH_LANDSCAPE = 960;
export const MAX_FORM_WIDTH = 480;
export const RAIL_WIDTH = 104;
const LANDSCAPE_MIN_WIDTH = 900;

export function isLandscapeWide(width: number, height: number) {
  return width >= LANDSCAPE_MIN_WIDTH && width > height;
}

export function useLayoutMode() {
  const { width, height } = useWindowDimensions();
  const landscape = isLandscapeWide(width, height);
  return {
    landscape,
    /** Largeur maximale de la colonne de contenu. */
    contentMax: landscape ? MAX_CONTENT_WIDTH_LANDSCAPE : MAX_CONTENT_WIDTH,
    /** Largeur disponible à côté du rail de navigation. */
    availableWidth: landscape ? width - RAIL_WIDTH : width,
    /** Nombre de colonnes pour les listes de cartes. */
    columns: landscape ? 2 : 1,
  };
}

/** Largeur réellement disponible pour le contenu. */
export function useContentWidth(max?: number) {
  const { contentMax, availableWidth } = useLayoutMode();
  return Math.min(availableWidth, max ?? contentMax);
}

/** Marge latérale pour centrer une colonne dans la fenêtre (barre d'onglets en portrait). */
export function useSideGutter(max = MAX_CONTENT_WIDTH) {
  const { width } = useWindowDimensions();
  return Math.max(0, (width - max) / 2);
}

export const centeredColumn = (max = MAX_CONTENT_WIDTH) => ({ width: '100%' as const, maxWidth: max, alignSelf: 'center' as const });
