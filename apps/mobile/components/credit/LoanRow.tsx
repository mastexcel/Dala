import { StyleSheet, View } from 'react-native';
import { Lightning } from 'phosphor-react-native';
import { formatDate, formatFCFA, type LoanDTO } from '@dala/shared';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Badge, Card } from '@/components/ui';
import { LOAN_STATUS_LABEL } from '@/utils/meta';

export function LoanRow({ loan, onPress }: { loan: LoanDTO; onPress: () => void }) {
  const st = LOAN_STATUS_LABEL[loan.status];
  return (
    <Card onPress={onPress} style={{ marginBottom: SPACING.sm }} accessibilityLabel={`Prêt de ${loan.amount} francs CFA, ${st.label}`}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Lightning size={20} color={COLORS.orange} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold">{formatFCFA(loan.amount)}</AppText>
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            {formatDate(loan.createdAt)} · {loan.duration} jours
          </AppText>
        </View>
        <Badge label={st.label} color={st.color === COLORS.green ? TEXT_ON_WHITE.green : st.color === COLORS.red ? TEXT_ON_WHITE.red : st.color === COLORS.orange ? TEXT_ON_WHITE.orange : TEXT_ON_WHITE.blue} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  icon: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: `${COLORS.orange}1A`, alignItems: 'center', justifyContent: 'center' },
});
