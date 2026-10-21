import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';
import { COLORS, RADIUS } from '@/theme';

interface Props {
  value: number; // 0..1
  color?: string;
  height?: number;
  track?: string;
  label?: string;
}

export function ProgressBar({ value, color = COLORS.green, height = 8, track = COLORS.lightGray, label }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[styles.track, { height, backgroundColor: track, borderRadius: height }]}
    >
      <MotiView
        from={{ width: '0%' }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'timing', duration: 700 }}
        style={{ height, backgroundColor: color, borderRadius: height }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ track: { overflow: 'hidden', width: '100%', borderRadius: RADIUS.full } });
