import { StyleSheet, View } from 'react-native';
import { formatFCFA, formatPercent, type BondDTO } from '@dala/shared';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Badge, Card, DalaIcon } from '@/components/ui';
import { countryFlag } from '@/utils/meta';

export function BondCard({ bond, onPress }: { bond: BondDTO; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.card} accessibilityLabel={`${bond.issuerName}, ${formatPercent(bond.rate)} par an, ${bond.maturityDays} jours`}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <DalaIcon name={bond.isHalal ? 'sukuk' : 'bonds'} size={30} />
          <AppText variant="h3">{countryFlag(bond.issuerCountry)}</AppText>
        </View>
      </View>
      {bond.isHalal ? <Badge label="Halal ✓" color={TEXT_ON_WHITE.green} /> : <Badge label={bond.type === 'SUKUK' ? 'Sukuk' : 'Bon du Trésor'} color={TEXT_ON_WHITE.blue} />}
      <AppText variant="h2" serif color={COLORS.blue}>
        {formatPercent(bond.rate, 2)}
      </AppText>
      <AppText variant="small" color={TEXT_ON_WHITE.muted}>
        par an · {bond.maturityDays} jours
      </AppText>
      <AppText variant="caption" weight="semibold" numberOfLines={2}>
        {bond.issuerName}
      </AppText>
      <AppText variant="small" color={TEXT_ON_WHITE.muted}>
        Dès {formatFCFA(bond.minAmount)}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: 190, marginRight: SPACING.sm, gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
});
