import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LEGAL_NOTICE_INVEST, formatDate, formatFCFA, formatPercent, simulateBond } from '@dala/shared';
import { AmountSlider, AppText, Badge, Button, Card, DalaIcon, ErrorState, Header, KeyValue, LegalNotice, Loading, Screen, SectionTitle } from '@/components/ui';
import { useBond } from '@/hooks/queries';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { countryFlag, countryName } from '@/utils/meta';

export default function BondDetail() {
  const { bondId } = useLocalSearchParams<{ bondId: string }>();
  const q = useBond(bondId);
  const [amount, setAmount] = useState(100_000);

  if (q.isLoading) return <Screen header={<Header title="Bon du Trésor" />}><Loading /></Screen>;
  if (!q.data) return <Screen header={<Header title="Bon du Trésor" />}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Screen>;
  const b = q.data;
  const sim = simulateBond(Math.max(amount, b.minAmount), b.rate, b.maturityDays);
  const maturity = new Date(Date.now() + b.maturityDays * 86_400_000);

  return (
    <Screen
      header={<Header title={b.type === 'SUKUK' ? 'Sukuk' : 'Bon du Trésor'} />}
      footer={<Button title={`Investir ${formatFCFA(sim.amount)}`} onPress={() => router.push({ pathname: '/invest/flow', params: { instrumentId: b.id, amount: String(sim.amount) } })} />}
    >
      <View style={{ alignItems: 'center', gap: SPACING.xs, marginVertical: SPACING.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <DalaIcon name={b.isHalal ? 'sukuk' : 'bonds'} size={64} />
          <AppText style={{ fontSize: 48, lineHeight: 56 }}>{countryFlag(b.issuerCountry)}</AppText>
        </View>
        <AppText variant="h3" weight="bold" align="center">
          {b.issuerName}
        </AppText>
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <Badge label={countryName(b.issuerCountry)} color={TEXT_ON_WHITE.blue} />
          {b.isHalal ? <Badge label="Halal ✓" color={TEXT_ON_WHITE.green} /> : null}
        </View>
        <AppText variant="h1" serif color={COLORS.blue} style={{ fontSize: 40, lineHeight: 48 }}>
          {formatPercent(b.rate, 2)}
        </AppText>
        <AppText color={TEXT_ON_WHITE.muted}>taux annuel · {b.maturityDays} jours</AppText>
      </View>
      <AppText color={COLORS.darkGray}>{b.description}</AppText>

      <SectionTitle title="Simulation de rendement" icon="simulation" />
      <Card style={{ gap: SPACING.sm }}>
        <AmountSlider value={amount} onChange={setAmount} min={b.minAmount} max={2_000_000} step={5_000} color={COLORS.blue} label="Montant investi" />
        <KeyValue label="Intérêts à l'échéance" value={`+${formatFCFA(sim.interest)}`} color={TEXT_ON_WHITE.green} />
        <KeyValue label="Vous recevrez" value={formatFCFA(sim.total)} strong />
        <KeyValue label="Date d'échéance" value={formatDate(maturity)} />
      </Card>

      <SectionTitle title="Caractéristiques" icon="details" />
      <Card>
        <KeyValue label="Émetteur" value={b.issuerName} />
        <KeyValue label="Type" value={b.type === 'SUKUK' ? 'Sukuk (finance islamique)' : 'Bon assimilable du Trésor'} />
        <KeyValue label="Date d'émission" value={formatDate(b.issueDate)} />
        <KeyValue label="Clôture des souscriptions" value={formatDate(b.closingDate)} />
        <KeyValue label="Montant minimum" value={formatFCFA(b.minAmount)} />
        <KeyValue label="Frais de souscription" value="0 FCFA" />
        <KeyValue label="Convention de calcul" value="Exact / 360" />
      </Card>
      <LegalNotice text={LEGAL_NOTICE_INVEST} extra="Titres publics émis via UMOA-Titres. Le remboursement du capital dépend de la signature de l'État émetteur." />
    </Screen>
  );
}
