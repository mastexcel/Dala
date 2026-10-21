import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { COLORS } from '@/theme';
import { AppText } from '@/components/ui';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Jauge du score DALA (0-100) : dégradé rouge → orange → vert → or, animée. */
export function ScoreGauge({ score, size = 240 }: { score: number; size?: number }) {
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const length = Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(100, score)) / 100, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [score, progress]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : 'À construire';

  return (
    <View style={{ alignItems: 'center' }} accessibilityRole="progressbar" accessibilityLabel={`Score DALA ${score} sur 100, ${label}`}>
      <Svg width={size} height={size / 2 + stroke}>
        <Defs>
          <LinearGradient id="score" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={COLORS.red} />
            <Stop offset="0.35" stopColor={COLORS.orange} />
            <Stop offset="0.7" stopColor={COLORS.green} />
            <Stop offset="1" stopColor={COLORS.gold} />
          </LinearGradient>
        </Defs>
        <Path d={arc} stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <AnimatedPath d={arc} stroke="url(#score)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${length} ${length}`} animatedProps={animatedProps} />
      </Svg>
      <View style={{ position: 'absolute', bottom: 6, alignItems: 'center' }}>
        <AppText variant="h1" serif color={COLORS.white} style={{ fontSize: 44, lineHeight: 52 }}>
          {score}
        </AppText>
        <AppText variant="caption" weight="semibold" color={COLORS.gold}>
          {label} · Score DALA
        </AppText>
      </View>
    </View>
  );
}
