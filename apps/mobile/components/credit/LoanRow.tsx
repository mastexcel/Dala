import { StyleSheet, View } from 'react-native';
import { formatDate, formatFCFA, type LoanDTO } from '@dala/shared';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Badge, Card, DalaIcon, type DalaIconName } from '@/components/ui';
import { LOAN_STATUS_LABEL } from '@/utils/meta';

const STATUS_ICON: Partial<Record<LoanDTO['status'], DalaIconName>> = {
  REPAID: 'success',
  PENDING: 'pending',
  OVERDUE: 'warning',
  DEFAULTED: 'error',
  REJECTED: 'close',
  DISBURSED: 'credit',
};

export function LoanRow({ loan, onPress }: { loan: LoanDTO; onPress: () => void }) {
  const st = LOAN_STATUS_LABEL[loan.status];
  return (
    <Card onPress={onPress} style={{ marginBottom: SPACING.sm }} accessibilityLabel={`Prêt de ${loan.amount} francs CFA, ${st.label}`}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <DalaIcon name={STATUS_ICON[loan.status] ?? 'credit'} size={30} />
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
  icon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center' },
});
