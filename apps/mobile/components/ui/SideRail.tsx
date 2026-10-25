import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS, RADIUS, RAIL_WIDTH, SPACING } from '@/theme';
import { AppText } from './AppText';
import { DalaIcon, type DalaIconName } from './DalaIcon';
import { Logo } from './Logo';

/** Rail de navigation latéral, utilisé à la place de la barre d'onglets en paysage (tablette, ordinateur). */
export function SideRail({ state, descriptors, navigation, icons, hidden = [] }: BottomTabBarProps & { icons: Record<string, DalaIconName>; hidden?: string[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.rail, { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.md, paddingLeft: insets.left }]} accessibilityRole="tablist">
      <Logo variant="colorLight" width={84} style={{ marginBottom: SPACING.lg }} />
      {state.routes.map((route, index) => {
        if (hidden.includes(route.name)) return null;
        const focused = state.index === index;
        const label = descriptors[route.key].options.title ?? route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} style={[styles.item, focused && styles.itemActive]}>
            {focused ? <View style={styles.indicator} /> : null}
            <DalaIcon name={icons[route.name] ?? 'home'} size={focused ? 34 : 30} dimmed={!focused} />
            <AppText variant="small" weight={focused ? 'bold' : 'semibold'} color={focused ? COLORS.navy : COLORS.midGray} align="center" numberOfLines={1}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: RAIL_WIDTH,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    gap: SPACING.sm,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 12,
  },
  item: { width: RAIL_WIDTH - 16, alignItems: 'center', gap: 4, paddingVertical: SPACING.sm, borderRadius: RADIUS.md },
  itemActive: { backgroundColor: COLORS.offWhite },
  indicator: { position: 'absolute', left: -4, top: 12, bottom: 12, width: 4, borderRadius: 2, backgroundColor: COLORS.gold },
});
