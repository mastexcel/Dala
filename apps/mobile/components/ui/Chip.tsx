import { Pressable, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '@/theme';
import { AppText } from './AppText';

export function Chip({ label, active, onPress, color = COLORS.navy }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? color : COLORS.lightGray, backgroundColor: active ? color : COLORS.white }]}
    >
      <AppText variant="caption" weight="semibold" color={active ? COLORS.white : COLORS.darkGray}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1.5 },
});
