import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { COLORS } from '@/theme';

const PALETTE = [COLORS.gold, '#F0C040', COLORS.green, COLORS.white];

/** Pluie de confettis dorés (écrans de succès). */
export function Confetti({ count = 40 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => {
        const x = (i * 97) % width;
        const delay = (i * 53) % 900;
        const size = 6 + (i % 4) * 2;
        return (
          <MotiView
            key={i}
            from={{ translateY: -40, rotate: '0deg', opacity: 1 }}
            animate={{ translateY: height + 40, rotate: `${(i % 2 ? 1 : -1) * 540}deg`, opacity: 0.9 }}
            transition={{ type: 'timing', duration: 2200 + (i % 5) * 300, delay }}
            style={{ position: 'absolute', left: x, width: size, height: size * 1.6, borderRadius: 2, backgroundColor: PALETTE[i % PALETTE.length] }}
          />
        );
      })}
    </View>
  );
}
