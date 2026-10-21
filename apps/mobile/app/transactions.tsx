import { useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { DownloadSimple, MagnifyingGlass } from 'phosphor-react-native';
import type { TransactionCategory, TransactionDTO } from '@dala/shared';
import { AppText, Button, Card, Chip, EmptyState, Header, Input, Loading, Screen } from '@/components/ui';
import { TransactionRow } from '@/components/home/TransactionRow';
import { useTransactions } from '@/hooks/queries';
import { exportUrl } from '@/services/client';
import { USE_MOCKS } from '@/services/config';
import { useAuthStore } from '@/stores/auth';
import { COLORS, SPACING } from '@/theme';

const FILTERS: { key: TransactionCategory; label: string }[] = [
  { key: 'ALL', label: 'Tout' },
  { key: 'SAVINGS', label: 'Épargne' },
  { key: 'INVEST', label: 'Investissement' },
  { key: 'CROWDFUND', label: 'Crowdfund' },
  { key: 'CREDIT', label: 'Crédit' },
  { key: 'TRANSFER', label: 'Transferts' },
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
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={category === f.key} onPress={() => setCategory(f.key)} />
          ))}
        </ScrollView>
      </View>
      <View style={styles.exports}>
        <Button title="CSV" variant="outline" fullWidth={false} style={{ flex: 1, minHeight: 40 }} icon={<DownloadSimple size={16} color={COLORS.navy} />} onPress={() => void exportFile('csv')} />
        <Button title="PDF" variant="outline" fullWidth={false} style={{ flex: 1, minHeight: 40 }} icon={<DownloadSimple size={16} color={COLORS.navy} />} onPress={() => void exportFile('pdf')} />
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
            ListEmptyComponent={<EmptyState title="Aucune transaction" body="Modifiez les filtres ou la recherche." />}
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
  exports: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.lightGray },
});
