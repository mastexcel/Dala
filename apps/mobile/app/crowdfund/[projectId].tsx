import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  CROWDFUND_MIN_INVESTMENT,
  LEGAL_NOTICE_CROWDFUND,
  WITHDRAWAL_PERIOD_HOURS,
  daysBetween,
  equityForInvestment,
  formatCompact,
  formatFCFA,
  formatPercent,
} from '@dala/shared';
import { AmountSlider, AppText, Badge, Button, Card, DalaIcon, ErrorState, Header, type DalaIconName, KeyValue, LegalNotice, Loading, ProgressBar, Screen, SectionTitle } from '@/components/ui';
import { ValidatedBadge } from '@/components/crowdfund/ValidatedBadge';
import { Confetti } from '@/components/charts/Confetti';
import { crowdfundApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { qk, useFinancialMutation, useProject, useSummary } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { SECTOR_COLOR, sectorLabel } from '@/utils/meta';

export default function ProjectDetail() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const q = useProject(projectId);
  const { width } = useWindowDimensions();
  const summary = useSummary();
  const [amount, setAmount] = useState(25_000);
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const strongAuth = useStrongAuth();
  const invest = useFinancialMutation(({ pin }: { pin?: string }) => crowdfundApi.invest(projectId, amount, pin), [qk.project(projectId), qk.cfPortfolio, ['projects']]);

  if (q.isLoading) return <Screen wallpaper="crowdfund" header={<Header title="Projet" />}><Loading /></Screen>;
  if (!q.data) return <Screen wallpaper="crowdfund" header={<Header title="Projet" />}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Screen>;
  const p = q.data;
  const ratio = p.fundingRaised / p.fundingGoal;
  const remaining = p.fundingGoal - p.fundingRaised;
  const maxTicket = Math.max(CROWDFUND_MIN_INVESTMENT, Math.min(remaining, summary.data?.main ?? 0, 5_000_000));
  const equity = equityForInvestment(amount, p.valuation);
  const days = Math.max(0, daysBetween(new Date(), new Date(p.deadline)));

  const submit = async () => {
    setError(undefined);
    try {
      const r = await strongAuth((pin) => invest.mutateAsync({ pin }), { amount });
      if (r) {
        track('crowdfund_investment', { sector: p.sector, amount: amountBucket(amount) });
        setDone(r.equityPct);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen wallpaper="crowdfund"
      padded={false}
      header={<Header title={p.name} />}
      footer={
        done === null ? (
          <Button title={`Investir ${formatFCFA(amount)}`} variant="secondary" disabled={!accepted || p.status !== 'ACTIVE'} loading={invest.isPending} onPress={submit} />
        ) : (
          <AppText weight="bold" align="center" color={TEXT_ON_WHITE.green}>
            ✓ Investissement enregistré — {formatPercent(done, 4)} du capital
          </AppText>
        )
      }
    >
      {done !== null ? <Confetti /> : null}
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {(p.galleryUrls.length ? p.galleryUrls : [p.imageUrl]).filter(Boolean).map((u) => (
          <Image key={u!} source={{ uri: u! }} style={[styles.hero, { width, backgroundColor: `${SECTOR_COLOR[p.sector]}33` }]} accessibilityLabel={`Photo du projet ${p.name}`} />
        ))}
      </ScrollView>
      <View style={styles.body}>
        <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' }}>
          <Badge label={sectorLabel(p.sector)} color={COLORS.white} background={SECTOR_COLOR[p.sector]} />
          <ValidatedBadge />
        </View>
        <AppText variant="h2" color={COLORS.navy}>
          {p.name}
        </AppText>
        <AppText color={COLORS.darkGray}>{p.description}</AppText>

        <Card style={{ gap: SPACING.sm, marginTop: SPACING.md }}>
          <ProgressBar value={ratio} color={COLORS.purple} height={10} label="Montant levé" />
          <View style={styles.between}>
            <AppText weight="bold" color={TEXT_ON_WHITE.purple}>
              {Math.round(ratio * 100)} % · {formatCompact(p.fundingRaised)} / {formatCompact(p.fundingGoal)} FCFA
            </AppText>
          </View>
          <View style={styles.between}>
            <Stat icon="investors" label="Investisseurs" value={String(p.investorCount)} />
            <Stat icon="schedule" label="Jours restants" value={String(days)} />
            <Stat icon="portfolio" label="Equity offerte" value={`${formatPercent(p.equityMin, 0)}–${formatPercent(p.equityMax, 0)}`} />
          </View>
        </Card>

        <SectionTitle title="Le pitch" icon="news" />
        <Card style={{ gap: SPACING.sm }}>
          <AppText weight="bold">Le problème</AppText>
          <AppText color={COLORS.darkGray}>{p.problem}</AppText>
          <AppText weight="bold">La solution</AppText>
          <AppText color={COLORS.darkGray}>{p.solution}</AppText>
          <AppText weight="bold">Marché cible</AppText>
          <AppText color={COLORS.darkGray}>{p.targetMarket}</AppText>
        </Card>

        <SectionTitle title="Informations financières" icon="bonds" />
        <Card>
          <KeyValue label="Objectif de levée" value={formatFCFA(p.fundingGoal)} />
          <KeyValue label="Déjà levé" value={formatFCFA(p.fundingRaised)} />
          <KeyValue label="Valorisation (post-money)" value={formatFCFA(p.valuation)} />
          <KeyValue label="Equity offerte" value={`${formatPercent(p.equityMin, 0)} à ${formatPercent(p.equityMax, 0)}`} />
          <KeyValue label="Ticket minimum" value={formatFCFA(CROWDFUND_MIN_INVESTMENT)} />
        </Card>

        <SectionTitle title="Équipe fondatrice" icon="investors" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
          {p.teamMembers.map((m) => (
            <Card key={m.name} style={styles.member}>
              <View style={styles.avatar}>
                <AppText variant="h3" weight="bold" color={COLORS.white}>
                  {m.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
                </AppText>
              </View>
              <AppText weight="semibold" align="center">{m.name}</AppText>
              <AppText variant="small" color={TEXT_ON_WHITE.muted} align="center">{m.role}</AppText>
            </Card>
          ))}
        </ScrollView>

        <SectionTitle title="Documents" icon="details" />
        <Card>
          {p.documents.map((d) => (
            <Pressable key={d.name} onPress={() => void Linking.openURL(d.url)} accessibilityRole="link" style={styles.doc}>
              <DalaIcon name={d.kind === 'VALIDATION' ? 'validated-projects' : 'details'} size={30} />
              <AppText style={{ flex: 1 }}>{d.name}</AppText>
            </Pressable>
          ))}
        </Card>

        <SectionTitle title="Investir" icon="portfolio" />
        <Card style={{ gap: SPACING.sm }}>
          <AmountSlider value={Math.min(amount, maxTicket)} onChange={setAmount} min={CROWDFUND_MIN_INVESTMENT} max={maxTicket} step={5_000} color={COLORS.purple} label="Votre ticket" />
          <KeyValue label="Part du capital obtenue" value={formatPercent(equity, 4)} strong color={TEXT_ON_WHITE.purple} />
          <KeyValue label="Frais" value="0 FCFA" />
          <View style={styles.accept}>
            <Switch value={accepted} onValueChange={setAccepted} trackColor={{ true: COLORS.purple }} accessibilityLabel="J'accepte les risques" />
            <AppText variant="caption" style={{ flex: 1 }}>
              Je comprends que je deviens actionnaire, que je peux perdre tout mon investissement et que mes parts sont peu liquides. Rétractation possible {WITHDRAWAL_PERIOD_HOURS} h.
            </AppText>
          </View>
        </Card>
        {error ? <AppText color={TEXT_ON_WHITE.red}>{error}</AppText> : null}
        <LegalNotice text={LEGAL_NOTICE_CROWDFUND} />
      </View>
    </Screen>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: DalaIconName }) {
  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 2 }}>
      <DalaIcon name={icon} size={30} />
      <AppText weight="bold">{value}</AppText>
      <AppText variant="small" color={TEXT_ON_WHITE.muted} align="center">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220 },
  body: { padding: SPACING.md, gap: SPACING.xs },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  member: { width: 150, alignItems: 'center', gap: 4 },
  avatar: { width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: COLORS.purple, alignItems: 'center', justifyContent: 'center' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  accept: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
});
