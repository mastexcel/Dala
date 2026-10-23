import { useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { LEGAL_NOTICE_INVEST, WITHDRAWAL_PERIOD_HOURS, formatDate, formatFCFA, formatPercent, simulateBond } from '@dala/shared';
import { AppText, Button, Card, DalaIcon, Header, Input, KeyValue, LegalNotice, Loading, Screen } from '@/components/ui';
import { Confetti } from '@/components/charts/Confetti';
import { investApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { qk, useBonds, useFinancialMutation, useFunds, useSummary } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

type Step = 'amount' | 'confirm' | 'success';

/** Parcours : Montant → Confirmation (récapitulatif + conditions) → Succès (confettis dorés). */
export default function InvestFlow() {
  const params = useLocalSearchParams<{ instrumentId: string; amount?: string }>();
  const bonds = useBonds();
  const funds = useFunds();
  const summary = useSummary();
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(params.amount ?? '');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string>();
  const strongAuth = useStrongAuth();
  const invest = useFinancialMutation(({ value, pin }: { value: number; pin?: string }) => investApi.invest(params.instrumentId, value, pin), [qk.portfolio]);

  const inst = useMemo(() => {
    const b = bonds.data?.find((x) => x.id === params.instrumentId);
    if (b) return { name: `${b.type === 'SUKUK' ? 'Sukuk' : 'Bon du Trésor'} ${b.issuerCountry} ${b.maturityDays} j`, rate: b.rate, min: b.minAmount, days: b.maturityDays, isBond: true, fees: 0 };
    const f = funds.data?.find((x) => x.id === params.instrumentId);
    if (f) return { name: f.name, rate: f.ytdPerformance, min: f.minAmount, days: 365, isBond: false, fees: f.fees };
    return null;
  }, [bonds.data, funds.data, params.instrumentId]);

  if (!inst) return <Screen header={<Header title="Investir" />}><Loading /></Screen>;
  const value = Number(amount) || 0;
  const available = summary.data?.main ?? 0;
  const sim = simulateBond(value, inst.rate, inst.days);
  const amountError = value && value < inst.min ? `Minimum ${formatFCFA(inst.min)}` : value > available ? 'Solde insuffisant' : undefined;

  const confirm = async () => {
    setError(undefined);
    try {
      const r = await strongAuth((pin) => invest.mutateAsync({ value, pin }), { amount: value });
      if (r) {
        track('investment_made', { instrument: params.instrumentId, kind: inst.isBond ? 'bond' : 'fund', amount: amountBucket(value) });
        setStep('success');
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (step === 'success') {
    return (
      <Screen scroll={false} background={COLORS.navy} dark edges={['top', 'bottom']}>
        <Confetti />
        <View style={styles.success}>
          <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
            <View style={styles.successIcon}>
              <DalaIcon name="success" size={96} />
            </View>
          </MotiView>
          <AppText variant="h1" color={COLORS.white} align="center">
            Investissement réussi !
          </AppText>
          <AppText color={COLORS.lightGray} align="center">
            {formatFCFA(value)} placés sur {inst.name}. Vous pouvez vous rétracter gratuitement pendant {WITHDRAWAL_PERIOD_HOURS} h.
          </AppText>
          <Button title="Voir mon portefeuille" onPress={() => router.replace('/invest')} />
          <Button title="Retour à l'accueil" variant="ghost" textColor={COLORS.white} onPress={() => router.replace('/(tabs)')} />
        </View>
      </Screen>
    );
  }

  if (step === 'confirm') {
    return (
      <Screen header={<Header title="Récapitulatif" onBack={() => setStep('amount')} />} footer={<Button title="Confirmer l'investissement" disabled={!accepted} loading={invest.isPending} onPress={confirm} />}>
        <Card>
          <View style={{ alignItems: 'center', marginBottom: SPACING.sm }}>
            <DalaIcon name="details" size={56} />
          </View>
          <KeyValue label="Produit" value={inst.name} />
          <KeyValue label="Montant investi" value={formatFCFA(value)} strong />
          <KeyValue label={inst.isBond ? 'Taux annuel' : 'Performance depuis janv. (indicative)'} value={formatPercent(inst.rate, 2)} />
          {inst.isBond ? <KeyValue label="Intérêts estimés" value={`+${formatFCFA(sim.interest)}`} color={TEXT_ON_WHITE.green} /> : null}
          <KeyValue label="Échéance" value={formatDate(new Date(Date.now() + inst.days * 86_400_000))} />
          <KeyValue label="Frais de souscription" value="0 FCFA" />
          {inst.fees ? <KeyValue label="Frais de gestion annuels" value={formatPercent(inst.fees, 2)} /> : null}
          <KeyValue label="Débité de" value="Compte principal DALA" />
        </Card>
        <View style={styles.accept}>
          <Switch value={accepted} onValueChange={setAccepted} trackColor={{ true: COLORS.green }} accessibilityLabel="J'accepte les conditions" />
          <AppText variant="caption" style={{ flex: 1 }}>
            J'ai pris connaissance des caractéristiques du produit, des frais et du risque de perte en capital. Je dispose d'un droit de rétractation de {WITHDRAWAL_PERIOD_HOURS} h.
          </AppText>
        </View>
        {error ? <AppText color={TEXT_ON_WHITE.red}>{error}</AppText> : null}
        <LegalNotice text={LEGAL_NOTICE_INVEST} />
      </Screen>
    );
  }

  return (
    <Screen header={<Header title="Investir" />} footer={<Button title="Continuer" disabled={!value || !!amountError} onPress={() => setStep('confirm')} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <DalaIcon name={inst.isBond ? 'bonds' : 'fcp'} size={40} />
        <AppText variant="h3" weight="bold" style={{ flex: 1 }}>
          {inst.name}
        </AppText>
      </View>
      <AppText color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.lg }}>
        {formatPercent(inst.rate, 2)} / an · minimum {formatFCFA(inst.min)}
      </AppText>
      <Input
        label="Montant à investir"
        keyboardType="number-pad"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
        error={amountError}
        hint={`Disponible : ${formatFCFA(available)}`}
        suffix={<AppText weight="semibold">FCFA</AppText>}
        autoFocus
      />
      {value >= inst.min && inst.isBond ? (
        <Card>
          <KeyValue label="Intérêts estimés" value={`+${formatFCFA(sim.interest)}`} color={TEXT_ON_WHITE.green} />
          <KeyValue label="Total à l'échéance" value={formatFCFA(sim.total)} strong />
        </Card>
      ) : null}
      <LegalNotice text={LEGAL_NOTICE_INVEST} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.lg, padding: SPACING.lg },
  successIcon: { backgroundColor: COLORS.white, borderRadius: 72, padding: 12 },
  accept: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', marginVertical: SPACING.lg },
});
