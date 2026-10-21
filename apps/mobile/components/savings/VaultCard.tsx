import { StyleSheet, View } from 'react-native';
import { LockKey } from 'phosphor-react-native';
import { daysBetween, formatDate, formatFCFA, formatPercent, type VaultDTO } from '@dala/shared';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Card, ProgressBar } from '@/components/ui';

export function VaultCard({ vault }: { vault: VaultDTO }) {
  const total = daysBetween(new Date(vault.createdAt), new Date(vault.unlockDate));
  const left = Math.max(0, daysBetween(new Date(), new Date(vault.unlockDate)));
  return (
    <Card style={{ marginBottom: SPACING.sm, gap: SPACING.sm }}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <LockKey size={22} color={COLORS.gold} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold">{formatFCFA(vault.amount)}</AppText>
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            {vault.months} mois · {formatPercent(vault.rate)} / an
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            Intérêts acquis
          </AppText>
          <AppText weight="bold" color={TEXT_ON_WHITE.green}>
            +{formatFCFA(vault.accruedInterest)}
          </AppText>
        </View>
      </View>
      <ProgressBar value={1 - left / Math.max(1, total)} color={COLORS.gold} label="Temps écoulé avant déblocage" />
      <AppText variant="small" color={TEXT_ON_WHITE.muted}>
        Déblocage le {formatDate(vault.unlockDate)} · {left} jours restants
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  icon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: `${COLORS.gold}22`, alignItems: 'center', justifyContent: 'center' },
});
