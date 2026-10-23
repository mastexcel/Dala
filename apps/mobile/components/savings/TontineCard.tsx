import { StyleSheet, View } from 'react-native';
import { formatDate, formatFCFA, type TontineDTO } from '@dala/shared';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Badge, Card, DalaIcon, ProgressBar } from '@/components/ui';
import { FREQUENCY_LABEL } from '@/utils/meta';

export function TontineCard({ tontine, onPress }: { tontine: TontineDTO; onPress?: () => void }) {
  const me = tontine.members.find((m) => m.position === tontine.myPosition);
  return (
    <Card onPress={onPress} style={{ marginBottom: SPACING.sm, gap: SPACING.sm }} accessibilityLabel={tontine.name}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <DalaIcon name="tontines" size={32} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold" numberOfLines={2}>
            {tontine.name}
          </AppText>
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            {tontine.members.length} membres · {formatFCFA(tontine.amount)} · {FREQUENCY_LABEL[tontine.frequency].toLowerCase()}
          </AppText>
        </View>
      </View>
      <ProgressBar value={tontine.currentCycle / tontine.totalCycles} label="Avancement du cycle" />
      <View style={styles.row}>
        <AppText variant="small" color={TEXT_ON_WHITE.muted} style={{ flex: 1 }}>
          Tour {tontine.currentCycle}/{tontine.totalCycles} · Vous êtes n°{tontine.myPosition}
        </AppText>
        {me?.hasPaid ? (
          <View style={styles.status}>
            <DalaIcon name="success" size={18} />
            <Badge label="Cotisé" color={TEXT_ON_WHITE.green} />
          </View>
        ) : (
          <View style={styles.status}>
            <DalaIcon name="pending" size={18} />
            <Badge label={`À cotiser · ${formatDate(tontine.nextContributionDate)}`} color={TEXT_ON_WHITE.orange} />
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  icon: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center' },
});
