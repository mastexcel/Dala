import { StyleSheet, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { formatFCFA } from '@dala/shared';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText } from './AppText';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  color?: string;
  label?: string;
}

export function AmountSlider({ value, onChange, min, max, step, color = COLORS.gold, label = 'Montant' }: Props) {
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
        {label}
      </AppText>
      <AppText variant="h1" serif color={COLORS.navy} align="center">
        {formatFCFA(value)}
      </AppText>
      <Slider
        accessibilityLabel={label}
        value={value}
        minimumValue={min}
        maximumValue={Math.max(min, max)}
        step={step}
        onValueChange={(v) => onChange(Math.round(v / step) * step)}
        minimumTrackTintColor={color}
        maximumTrackTintColor={COLORS.lightGray}
        thumbTintColor={color}
        style={{ height: 40 }}
      />
      <View style={styles.bounds}>
        <AppText variant="small" color={TEXT_ON_WHITE.muted}>
          {formatFCFA(min)}
        </AppText>
        <AppText variant="small" color={TEXT_ON_WHITE.muted}>
          {formatFCFA(max)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACING.xs },
  bounds: { flexDirection: 'row', justifyContent: 'space-between' },
});
