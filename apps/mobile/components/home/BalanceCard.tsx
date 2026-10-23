import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeSlash, TrendDown, TrendUp } from 'phosphor-react-native';
import { formatFCFA, formatPercent, type BalanceSummary } from '@dala/shared';
import { COLORS, RADIUS, SPACING } from '@/theme';
import { AppText, Amount, Logo } from '@/components/ui';
import { useUiStore } from '@/stores/ui';

export function BalanceCard({ summary }: { summary: BalanceSummary }) {
  const hidden = useUiStore((s) => s.balanceHidden);
  const toggle = useUiStore((s) => s.toggleBalance);
  const up = summary.monthDelta >= 0;
  const Trend = up ? TrendUp : TrendDown;
  return (
    <LinearGradient colors={[...COLORS.gradientPrimary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.top}>
        <AppText variant="caption" color={COLORS.lightGray}>
          Solde total
        </AppText>
        <Pressable onPress={toggle} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'Afficher le solde' : 'Masquer le solde'}>
          {hidden ? <EyeSlash size={22} color={COLORS.lightGray} /> : <Eye size={22} color={COLORS.lightGray} />}
        </Pressable>
      </View>
      <Amount value={summary.total} maskable variant="h1" serif color={COLORS.white} style={{ fontSize: 34, lineHeight: 42 }} />
      <View style={styles.delta}>
        <Trend size={16} color={up ? '#5EE6B5' : '#FF8A80'} weight="bold" />
        <AppText variant="caption" weight="semibold" color={up ? '#5EE6B5' : '#FF8A80'}>
          {hidden ? '••••' : formatFCFA(summary.monthDelta, { sign: true })} ce mois · {up ? '↑' : '↓'} {formatPercent(Math.abs(summary.monthDeltaPct))}
        </AppText>
      </View>
      <Logo variant="whiteFine" width={150} style={styles.watermark} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.xs, overflow: 'hidden' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs },
  watermark: { position: 'absolute', right: -12, bottom: -6, opacity: 0.12 },
});
