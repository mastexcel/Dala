import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MagnifyingGlass } from 'phosphor-react-native';
import type { TransactionCategory, TransactionDTO } from '@dala/shared';
import { AppText, Button, Card, DalaIcon, EmptyState, Header, Input, Loading, Screen, type DalaIconName } from '@/components/ui';
import { TransactionRow } from '@/components/home/TransactionRow';
import { useTransactions } from '@/hooks/queries';
import { exportUrl } from '@/services/client';
import { USE_MOCKS } from '@/services/config';
import { useAuthStore } from '@/stores/auth';
import { COLORS, RADIUS, SHADOW, SPACING } from '@/theme';

const FILTERS: { key: TransactionCategory; label: string; icon: DalaIconName }[] = [
  { key: 'ALL', label: 'Tout', icon: 'tx-all' },
  { key: 'SAVINGS', label: 'Épargne', icon: 'tx-savings' },
  { key: 'INVEST', label: 'Investissement', icon: 'tx-invest' },
  { key: 'CROWDFUND', label: 'Crowdfund', icon: 'tx-crowdfund' },
  { key: 'CREDIT', label: 'Crédit', icon: 'tx-credit' },
  { key: 'TRANSFER', label: 'Transferts', icon: 'transfers' },
];

function toCsv(items: TransactionDTO[]) {
  const header = 'Date;Référence;Type;Libellé;Montant (FCFA);Statut';
  return [header, ...items.map((t) => [t.createdAt, t.reference ?? '', t.type, `"${t.description.replace(/"/g, '""')}"`, t.amount, t.status].join(';'))].join('\n');
}

export default function Transactions() {
  const [category, setCategory] = useState<TransactionCategory>('ALL');
  const [search, setSearch] = useState('');
  const q = useTransactions(category, search.trim() || undefined, 100);

  const exportFile = async (format: 'csv' | 'pdf') => {
    try {
      const target = `${FileSystem.cacheDirectory}dala-releve.${format}`;
      if (USE_MOCKS) {
        if (format === 'pdf') return Alert.alert('Export PDF', 'Le relevé PDF est généré par le serveur DALA. En mode démo, utilisez l’export CSV.');
        await FileSystem.writeAsStringAsync(target, `﻿${toCsv(q.data?.items ?? [])}`);
      } else {
        const token = useAuthStore.getState().accessToken;
        await FileSystem.downloadAsync(exportUrl('/transactions/export', { format, category }), target, { headers: { Authorization: `Bearer ${token}` } });
      }
      await Sharing.shareAsync(target, { mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv', dialogTitle: 'Relevé DALA' });
    } catch {
      Alert.alert('Export', "L'export a échoué. Réessayez.");
    }
  };

  return (
    <Screen scroll={false} header={<Header title="Transactions" />}>
      <Input
        placeholder="Rechercher une transaction"
        value={search}
        onChangeText={setSearch}
        prefix={<MagnifyingGlass size={18} color={COLORS.midGray} />}
        accessibilityLabel="Rechercher une transaction"
        returnKeyType="search"
      />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const active = category === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setCategory(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={f.label}
                style={[styles.filter, active && styles.filterActive]}
              >
                <DalaIcon name={f.icon} size={30} dimmed={!active} />
                <AppText variant="small" weight={active ? 'bold' : 'medium'} color={active ? COLORS.navy : COLORS.midGray}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.exports}>
        <Button title="CSV" variant="outline" fullWidth={false} style={{ flex: 1, minHeight: 40 }} icon={<DalaIcon name="deposit" size={20} />} onPress={() => void exportFile('csv')} />
        <Button title="PDF" variant="outline" fullWidth={false} style={{ flex: 1, minHeight: 40 }} icon={<DalaIcon name="details" size={20} />} onPress={() => void exportFile('pdf')} />
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <Card style={{ flex: 1, paddingVertical: 0 }}>
          <FlatList
            data={q.data?.items}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => <TransactionRow tx={item} />}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            refreshing={q.isRefetching}
            onRefresh={() => void q.refetch()}
            ListEmptyComponent={<EmptyState icon={<DalaIcon name="tx-all" size={64} />} title="Aucune transaction" body="Modifiez les filtres ou la recherche." />}
          />
        </Card>
      )}
      <AppText variant="small" align="center" color={COLORS.midGray} style={{ padding: SPACING.sm }}>
        Chaque opération vous est notifiée immédiatement.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  filter: { alignItems: 'center', gap: 2, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, minWidth: 72 },
  filterActive: { backgroundColor: COLORS.white, ...SHADOW.card },
  exports: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.lightGray },
});
