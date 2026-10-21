import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, DotsThreeOutline, QrCode } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { COLORS, RADIUS, SHADOW, SPACING } from '@/theme';
import { AppText } from '@/components/ui';

type IconT = ComponentType<{ size?: number; color?: string; weight?: 'duotone' }>;

const ACTIONS: { label: string; Icon: IconT; href: string }[] = [
  { label: 'Envoyer', Icon: ArrowUpRight, href: '/wallet?mode=send' },
  { label: 'Recevoir', Icon: ArrowDownLeft, href: '/wallet?mode=deposit' },
  { label: 'Scanner', Icon: QrCode, href: '/wallet?mode=scan' },
  { label: 'Plus', Icon: DotsThreeOutline, href: '/invest' },
];

export function QuickActions() {
  return (
    <View style={styles.row}>
      {ACTIONS.map(({ label, Icon, href }) => (
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(href as never)} style={styles.item}>
          <View style={styles.icon}>
            <Icon size={26} color={COLORS.navy} weight="duotone" />
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
  icon: { width: 58, height: 58, borderRadius: RADIUS.lg, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', ...SHADOW.card },
});
