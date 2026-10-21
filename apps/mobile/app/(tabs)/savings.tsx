import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LockKey, Plus, Target, UsersThree } from 'phosphor-react-native';
import { formatFCFA, VAULT_OPTIONS, formatPercent } from '@dala/shared';
import { AppText, Button, Card, EmptyState, ErrorState, LegalNotice, Loading, SegmentedTabs, Screen } from '@/components/ui';
import { GoalCard } from '@/components/savings/GoalCard';
import { TontineCard } from '@/components/savings/TontineCard';
import { VaultCard } from '@/components/savings/VaultCard';
import { useGoals, useSummary, useTontines, useVaults } from '@/hooks/queries';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

type Tab = 'goals' | 'tontines' | 'vault';

export default function Savings() {
  const [tab, setTab] = useState<Tab>('goals');
  const summary = useSummary();
  const goals = useGoals();
  const tontines = useTontines();
  const vaults = useVaults();

  return (
    <Screen onRefresh={() => [goals, tontines, vaults, summary].forEach((q) => void q.refetch())} refreshing={goals.isRefetching}>
      <AppText variant="h1" color={COLORS.navy}>
        Épargne
      </AppText>
      <Card style={styles.total}>
        <AppText variant="caption" color={COLORS.lightGray}>
          Total épargné
        </AppText>
        <AppText variant="h2" serif color={COLORS.white}>
          {formatFCFA((summary.data?.savings ?? 0) + (summary.data?.vault ?? 0))}
        </AppText>
        <AppText variant="small" color={COLORS.lightGray}>
          dont {formatFCFA(summary.data?.vault ?? 0)} au coffre-fort
        </AppText>
      </Card>

      <SegmentedTabs<Tab>
        accent={COLORS.green}
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'goals', label: 'Objectifs' },
          { key: 'tontines', label: 'Tontines' },
          { key: 'vault', label: 'Coffre-fort' },
        ]}
      />

      {tab === 'goals' ? (
        goals.isLoading ? (
          <Loading />
        ) : goals.error && !goals.data ? (
          <ErrorState error={goals.error} onRetry={() => void goals.refetch()} />
        ) : (
          <>
            {goals.data?.length ? (
              goals.data.map((g) => <GoalCard key={g.id} goal={g} onPress={() => router.push(`/savings/goal/${g.id}`)} />)
            ) : (
              <EmptyState icon={<Target size={48} color={COLORS.green} weight="duotone" />} title="Aucun objectif" body="Mariage, études, commerce… donnez un but à votre épargne." />
            )}
            <Button title="Nouvel objectif" variant="secondary" icon={<Plus size={18} color={COLORS.white} weight="bold" />} onPress={() => router.push('/savings/create-goal')} />
          </>
        )
      ) : null}

      {tab === 'tontines' ? (
        tontines.isLoading ? (
          <Loading />
        ) : (
          <>
            {tontines.data?.length ? (
              tontines.data.map((t) => <TontineCard key={t.id} tontine={t} onPress={() => router.push(`/savings/tontine/${t.id}`)} />)
            ) : (
              <EmptyState icon={<UsersThree size={48} color={COLORS.green} weight="duotone" />} title="Aucune tontine" body="Cotisez à plusieurs, en toute transparence : chaque tour est tracé." />
            )}
            <AppText variant="small" color={TEXT_ON_WHITE.muted} style={{ marginTop: SPACING.sm }}>
              Les cotisations sont cantonnées sur un compte dédié jusqu'au versement au bénéficiaire du tour.
            </AppText>
          </>
        )
      ) : null}

      {tab === 'vault' ? (
        vaults.isLoading ? (
          <Loading />
        ) : (
          <>
            <Card style={{ marginBottom: SPACING.md, gap: SPACING.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <LockKey size={22} color={COLORS.gold} weight="duotone" />
                <AppText weight="bold">Bloquez, gagnez plus</AppText>
              </View>
              <View style={styles.rates}>
                {VAULT_OPTIONS.map((o) => (
                  <View key={o.months} style={styles.rate}>
                    <AppText variant="h3" serif color={TEXT_ON_WHITE.gold}>
                      {formatPercent(o.rate)}
                    </AppText>
                    <AppText variant="small" color={TEXT_ON_WHITE.muted}>
                      {o.months} mois
                    </AppText>
                  </View>
                ))}
              </View>
            </Card>
            {vaults.data?.vaults.map((v) => <VaultCard key={v.id} vault={v} />)}
            <Button title="Créer un coffre-fort" icon={<LockKey size={18} color={COLORS.navy} weight="bold" />} onPress={() => router.push('/savings/vault')} />
          </>
        )
      ) : null}

      <LegalNotice text="Épargne rémunérée selon les conditions tarifaires en vigueur. Les fonds du coffre-fort ne sont pas disponibles avant la date de déblocage." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { backgroundColor: COLORS.green, marginVertical: SPACING.md, gap: 2 },
  rates: { flexDirection: 'row', justifyContent: 'space-between' },
  rate: { alignItems: 'center', flex: 1 },
});
