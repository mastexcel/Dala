import { StyleSheet, View } from 'react-native';
import { ArrowDown, ArrowUp } from 'phosphor-react-native';
import { formatRelative, type TransactionDTO } from '@dala/shared';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Amount } from '@/components/ui';
import { CATEGORY_COLOR, TX_CATEGORY } from '@/utils/meta';

const STATUS_LABEL = { PENDING: 'En attente', FAILED: 'Échouée', CANCELLED: 'Annulée', COMPLETED: '' } as const;

export function TransactionRow({ tx }: { tx: TransactionDTO }) {
  const incoming = tx.amount > 0;
  const color = CATEGORY_COLOR[TX_CATEGORY[tx.type]];
  const Icon = incoming ? ArrowDown : ArrowUp;
  const status = STATUS_LABEL[tx.status];
  return (
    <View style={styles.row} accessible accessibilityLabel={`${tx.description}, ${incoming ? 'crédit' : 'débit'} ${Math.abs(tx.amount)} francs CFA, ${formatRelative(tx.createdAt)}`}>
      <View style={[styles.icon, { backgroundColor: `${color}1A` }]}>
        <Icon size={18} color={color} weight="bold" />
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
  icon: { width: 40, height: 40, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
});
