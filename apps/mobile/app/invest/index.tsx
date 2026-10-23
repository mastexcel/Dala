import { useState } from 'react';
import { FlatList, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LEGAL_NOTICE_INVEST, formatFCFA, formatPercent } from '@dala/shared';
import { AppText, Button, Card, DalaIcon, Header, LegalNotice, Loading, Screen, SectionTitle } from '@/components/ui';
import { LineChart } from '@/components/charts/LineChart';
import { BondCard } from '@/components/invest/BondCard';
import { FundRow } from '@/components/invest/FundRow';
import { useBonds, useFunds, usePortfolio } from '@/hooks/queries';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

export default function Invest() {
  const { width } = useWindowDimensions();
  const [halal, setHalal] = useState(false);
  const portfolio = usePortfolio();
  const bonds = useBonds(halal);
  const funds = useFunds(halal);
  const p = portfolio.data;

  return (
    <Screen wallpaper="invest"
      header={<Header title="Investissement" />}
      onRefresh={() => [portfolio, bonds, funds].forEach((q) => void q.refetch())}
      refreshing={portfolio.isRefetching}
      footer={<Button title="Investir" icon={<DalaIcon name="add" size={24} />} onPress={() => router.push(`/invest/${bonds.data?.[0]?.id ?? 'bt-ci-364'}`)} />}
    >
      <Card style={{ backgroundColor: COLORS.navy, gap: 4 }}>
        <View style={styles.cardIcon}>
          <DalaIcon name="performance" size={34} />
        </View>
        <AppText variant="caption" color={COLORS.lightGray}>
          Valeur du portefeuille
        </AppText>
        {portfolio.isLoading ? (
          <Loading />
        ) : (
          <>
            <AppText variant="h1" serif color={COLORS.white}>
              {formatFCFA(p?.totalValue ?? 0)}
            </AppText>
            <AppText variant="caption" weight="semibold" color="#5EE6B5">
              {formatFCFA(p?.ytdReturn ?? 0, { sign: true })} · {formatPercent(p?.ytdReturnPct ?? 0, 2)} depuis le début de l'année
            </AppText>
            <View style={{ marginTop: SPACING.md }}>
              <LineChart data={p?.history.map((h) => h.value) ?? []} width={width - SPACING.md * 4} color={COLORS.gold} />
            </View>
            <AppText variant="small" color={COLORS.lightGray}>
              30 derniers jours
            </AppText>
          </>
        )}
      </Card>

      <View style={styles.halal}>
        <DalaIcon name="sukuk" size={40} />
        <View style={{ flex: 1 }}>
          <AppText weight="bold">Finance islamique uniquement</AppText>
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            Sukuk et fonds certifiés conformes
          </AppText>
        </View>
        <Switch value={halal} onValueChange={setHalal} trackColor={{ true: COLORS.green }} accessibilityLabel="Afficher uniquement les placements Halal" />
      </View>

      <SectionTitle title="Bons du Trésor UEMOA" icon="bonds" />
      {bonds.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={bonds.data}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => <BondCard bond={item} onPress={() => router.push(`/invest/${item.id}`)} />}
          contentContainerStyle={{ paddingVertical: SPACING.sm }}
        />
      )}

      <SectionTitle title="Fonds communs de placement" icon="fcp" />
      {funds.data?.map((f) => <FundRow key={f.id} fund={f} onPress={() => router.push({ pathname: '/invest/flow', params: { instrumentId: f.id } })} />)}

      {p?.investments.length ? (
        <>
          <SectionTitle title="Mes placements" icon="portfolio" />
          <Card>
            {p.investments.map((i) => (
              <View key={i.id} style={styles.position}>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold">{i.instrumentName}</AppText>
                  <AppText variant="small" color={TEXT_ON_WHITE.muted}>
                    {formatPercent(i.rate, 2)} / an{i.isHalal ? ' · Halal ✓' : ''}
                  </AppText>
                </View>
                <AppText weight="bold">{formatFCFA(i.amount)}</AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}
      <LegalNotice text={LEGAL_NOTICE_INVEST} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardIcon: { position: 'absolute', right: SPACING.md, top: SPACING.md, backgroundColor: COLORS.white, borderRadius: 12, padding: 6 },
  halal: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.lg },
  position: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lightGray },
});
