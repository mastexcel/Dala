import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { COLORS, RADIUS, SHADOW, SPACING } from '@/theme';
import { AppText, DalaIcon, type DalaIconName } from '@/components/ui';

const ACTIONS: { label: string; icon: DalaIconName; href: string }[] = [
  { label: 'Envoyer', icon: 'send', href: '/wallet?mode=send' },
  { label: 'Recevoir', icon: 'receive', href: '/wallet?mode=deposit' },
  { label: 'Scanner', icon: 'scan', href: '/wallet?mode=scan' },
  { label: 'Historique', icon: 'tx-all', href: '/transactions' },
];

export function QuickActions() {
  return (
    <View style={styles.row}>
      {ACTIONS.map(({ label, icon, href }) => (
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(href as never)} style={styles.item}>
          <View style={styles.icon}>
            <DalaIcon name={icon} size={34} />
          </View>
          <AppText variant="small" weight="semibold" color={COLORS.darkGray}>
            {label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: SPACING.lg },
  item: { alignItems: 'center', gap: SPACING.xs, flex: 1 },
  icon: { width: 62, height: 62, borderRadius: RADIUS.lg, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', ...SHADOW.card },
});
