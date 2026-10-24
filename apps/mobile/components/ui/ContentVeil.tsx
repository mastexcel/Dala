import { View, useWindowDimensions } from 'react-native';
import { MAX_CONTENT_WIDTH } from '@/theme';

/** Voile blanc derrière la colonne de contenu. */
export const VEIL = 'rgba(255,255,255,0.62)';

/**
 * Voile blanc derrière la colonne de contenu, uniquement sur grand écran (tablette, ordinateur) :
 * il encadre la colonne centrée. Sur téléphone, le fond s'affiche sans voile.
 */
export function ContentVeil({ max = MAX_CONTENT_WIDTH, containerWidth, opacity = VEIL }: { max?: number; containerWidth?: number; opacity?: string }) {
  const { width: windowWidth } = useWindowDimensions();
  const width = containerWidth ?? windowWidth;
  if (width <= max) return null;
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, bottom: 0, left: (width - max) / 2, width: max, backgroundColor: opacity }}
    />
  );
}
