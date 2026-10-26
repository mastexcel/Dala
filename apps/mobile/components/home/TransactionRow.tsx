import { StyleSheet, View } from 'react-native';
import { formatRelative, type TransactionDTO, type TransactionType } from '@dala/shared';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Amount, DalaIcon, type DalaIconName } from '@/components/ui';

const STATUS_LABEL = { PENDING: 'En attente', FAILED: 'Échouée', CANCELLED: 'Annulée', COMPLETED: '' } as const;

export const TX_ICON: Record<TransactionType, DalaIconName> = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdraw',
  TRANSFER_IN: 'transfers',
  TRANSFER_OUT: 'transfers',
  SAVINGS_IN: 'tx-savings',
  SAVINGS_OUT: 'tx-savings',
  INVESTMENT_BUY: 'tx-invest',
  INVESTMENT_RETURN: 'interest',
  CROWDFUND_IN: 'tx-crowdfund',
  CROWDFUND_RETURN: 'tx-crowdfund',
  LOAN_DISBURSEMENT: 'tx-credit',
  LOAN_REPAYMENT: 'repay',
  ESCROW_HOLD: 'security',
  ESCROW_RELEASE: 'security',
  ESCROW_REFUND: 'security',
  FEE: 'info',
};

export function TransactionRow({ tx }: { tx: TransactionDTO }) {
  const incoming = tx.amount > 0;
  const status = STATUS_LABEL[tx.status];
  return (
    <View style={styles.row} accessible accessibilityLabel={`${tx.description}, ${incoming ? 'crédit' : 'débit'} ${Math.abs(tx.amount)} francs CFA, ${formatRelative(tx.createdAt)}`}>
      <View style={styles.icon}>
        <DalaIcon name={TX_ICON[tx.type]} size={28} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText weight="semibold" numberOfLines={1}>
          {tx.description}
        </AppText>
        <AppText variant="small" color={TEXT_ON_WHITE.muted}>
          {formatRelative(tx.createdAt)}
          {status ? ` · ${status}` : ''}
        </AppText>
      </View>
      <Amount value={tx.amount} sign weight="bold" variant="caption" color={incoming ? TEXT_ON_WHITE.green : COLORS.black} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm + 2 },
  icon: { width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center' },
});
