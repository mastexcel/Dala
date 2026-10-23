import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS, RADIUS, SHADOW, SPACING } from '@/theme';
import { AppText } from './AppText';
import { DalaIcon, type DalaIconName } from './DalaIcon';

interface Props<T extends string> {
  tabs: { key: T; label: string; icon?: DalaIconName }[];
  value: T;
  onChange: (key: T) => void;
  accent?: string;
}

/** Onglets segmentés : l'onglet actif est une carte blanche (les icônes DALA restent lisibles). */
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
            accessibilityLabel={t.label}
            onPress={() => onChange(t.key)}
            style={[styles.tab, active && styles.active, active && { borderBottomColor: accent }]}
          >
            {t.icon ? <DalaIcon name={t.icon} size={22} dimmed={!active} /> : null}
            <AppText variant="small" weight="bold" color={active ? accent : COLORS.darkGray} numberOfLines={1}>
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
  tab: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm, alignItems: 'center', gap: 2, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  active: { backgroundColor: COLORS.white, ...SHADOW.card },
});
