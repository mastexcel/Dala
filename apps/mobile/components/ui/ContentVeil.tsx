import { View, useWindowDimensions } from 'react-native';
import { MAX_CONTENT_WIDTH } from '@/theme';

/** Voile blanc derrière la colonne de contenu : garantit la lisibilité sur les fonds illustrés. */
export const VEIL = 'rgba(255,255,255,0.62)';

export function ContentVeil({ max = MAX_CONTENT_WIDTH, opacity = VEIL }: { max?: number; opacity?: string }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, max);
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, bottom: 0, left: (width - w) / 2, width: w, backgroundColor: opacity }}
    />
  );
}
