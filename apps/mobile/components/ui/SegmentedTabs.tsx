import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '@/theme';
import { AppText } from './AppText';

interface Props<T extends string> {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  accent?: string;
}

export function SegmentedTabs<T extends string>({ tabs, value, onChange, accent = COLORS.navy }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(t.key)}
            style={[styles.tab, active && { backgroundColor: accent }]}
          >
            <AppText variant="caption" weight="bold" color={active ? COLORS.white : COLORS.darkGray} numberOfLines={1}>
              {t.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: COLORS.lightGray, borderRadius: RADIUS.md, padding: 4, marginBottom: SPACING.md },
  tab: { flex: 1, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.sm, alignItems: 'center' },
});
