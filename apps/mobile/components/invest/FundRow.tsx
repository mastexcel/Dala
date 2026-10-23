import { StyleSheet, View } from 'react-native';
import { formatPercent, type FundDTO } from '@dala/shared';
import { SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Badge, Card, DalaIcon } from '@/components/ui';

const RISK = { FAIBLE: { label: 'Risque faible', color: TEXT_ON_WHITE.green }, MOYEN: { label: 'Risque moyen', color: TEXT_ON_WHITE.orange }, ELEVE: { label: 'Risque élevé', color: TEXT_ON_WHITE.red } };

export function FundRow({ fund, onPress }: { fund: FundDTO; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ marginBottom: SPACING.sm }} accessibilityLabel={`${fund.name}, performance ${formatPercent(fund.ytdPerformance)}`}>
      <View style={styles.row}>
        <DalaIcon name={fund.isHalal ? 'sukuk' : 'fcp'} size={40} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText weight="bold">{fund.name}</AppText>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Badge label={RISK[fund.risk].label} color={RISK[fund.risk].color} />
            {fund.isHalal ? <Badge label="Halal ✓" color={TEXT_ON_WHITE.green} /> : null}
          </View>
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            Frais {formatPercent(fund.fees, 2)} / an · {fund.manager}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="h4" weight="bold" color={TEXT_ON_WHITE.green}>
            +{formatPercent(fund.ytdPerformance)}
          </AppText>
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            depuis janv.
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md } });
