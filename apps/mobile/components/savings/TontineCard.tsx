import { StyleSheet, View } from 'react-native';
import { UsersThree } from 'phosphor-react-native';
import { formatDate, formatFCFA, type TontineDTO } from '@dala/shared';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Badge, Card, ProgressBar } from '@/components/ui';
import { FREQUENCY_LABEL } from '@/utils/meta';

export function TontineCard({ tontine, onPress }: { tontine: TontineDTO; onPress?: () => void }) {
  const me = tontine.members.find((m) => m.position === tontine.myPosition);
  return (
    <Card onPress={onPress} style={{ marginBottom: SPACING.sm, gap: SPACING.sm }} accessibilityLabel={tontine.name}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <UsersThree size={22} color={COLORS.green} weight="duotone" />
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
          <Badge label="Cotisé ✓" color={TEXT_ON_WHITE.green} />
        ) : (
          <Badge label={`À cotiser · ${formatDate(tontine.nextContributionDate)}`} color={TEXT_ON_WHITE.orange} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  icon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: `${COLORS.green}1A`, alignItems: 'center', justifyContent: 'center' },
});
