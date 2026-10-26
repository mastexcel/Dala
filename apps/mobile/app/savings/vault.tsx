import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { VAULT_OPTIONS, addMonths, formatDate, formatFCFA, formatPercent, TEST_PHASE } from '@dala/shared';
import { AppText, AmountSlider, Button, Card, DalaIcon, Header, KeyValue, LegalNotice, Screen } from '@/components/ui';
import { savingsApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { qk, useFinancialMutation, useSummary } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

export default function VaultScreen() {
  const summary = useSummary();
  const max = Math.max(5_000, Math.floor((summary.data?.main ?? 0) / 5_000) * 5_000);
  const [amount, setAmount] = useState(Math.min(50_000, max));
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const [error, setError] = useState<string>();
  const strongAuth = useStrongAuth();
  const create = useFinancialMutation(({ pin }: { pin?: string }) => savingsApi.createVault(amount, months, pin), [qk.vaults]);
  const rate = VAULT_OPTIONS.find((o) => o.months === months)!.rate;
  const interest = Math.round((amount * rate * months) / 12);
  const unlock = addMonths(new Date(), months);

  const submit = async () => {
    setError(undefined);
    try {
      const r = await strongAuth((pin) => create.mutateAsync({ pin }), { amount, title: `Bloquer ${formatFCFA(amount)}` });
      if (r) {
        track('vault_created', { months, amount: amountBucket(amount) });
        router.back();
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen wallpaper="savings" header={<Header title="Coffre-fort" />} footer={<Button title={`Bloquer ${formatFCFA(amount)}`} icon={<DalaIcon name="vault" size={24} />} onPress={submit} loading={create.isPending} disabled={amount < 5_000 || amount > (summary.data?.main ?? 0)} />}>
      <View style={{ alignItems: 'center', marginBottom: SPACING.sm }}>
        <DalaIcon name="vault" size={88} />
      </View>
      <AppText color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.md }}>
        Mettez votre argent à l'abri des tentations : il reste bloqué pendant la durée choisie et revient automatiquement à l'échéance.
        {TEST_PHASE.vaultInterest ? '' : " Pendant la phase de test, le coffre-fort n'est pas rémunéré : seul un établissement agréé peut rémunérer l'épargne."}
      </AppText>
      <Card>
        <AmountSlider value={amount} onChange={setAmount} min={5_000} max={max} step={5_000} label="Montant à bloquer" />
        <AppText variant="small" color={TEXT_ON_WHITE.muted}>
          Disponible : {formatFCFA(summary.data?.main ?? 0)}
        </AppText>
      </Card>
      <AppText variant="h4" weight="bold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
        Durée de blocage
      </AppText>
      <View style={styles.options}>
        {VAULT_OPTIONS.map((o) => {
          const active = o.months === months;
          return (
            <Pressable key={o.months} onPress={() => setMonths(o.months)} accessibilityRole="radio" accessibilityState={{ checked: active }} style={[styles.option, active && styles.optionActive]}>
              <AppText weight="bold" color={active ? COLORS.navy : COLORS.darkGray}>
                {o.months} mois
              </AppText>
              {o.rate > 0 ? (
                <>
                  <AppText variant="h3" serif color={active ? COLORS.navy : TEXT_ON_WHITE.gold}>
                    {formatPercent(o.rate)}
                  </AppText>
                  <AppText variant="small" color={active ? COLORS.navy : TEXT_ON_WHITE.muted}>
                    par an
                  </AppText>
                </>
              ) : (
                <AppText variant="small" color={active ? COLORS.navy : TEXT_ON_WHITE.muted}>
                  Sans rémunération
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
      <Card style={{ marginTop: SPACING.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
          <DalaIcon name="interest" size={28} />
          <AppText weight="bold">Récapitulatif</AppText>
        </View>
        {rate > 0 ? <KeyValue label="Intérêts estimés" value={`+${formatFCFA(interest)}`} color={TEXT_ON_WHITE.green} /> : null}
        <KeyValue label="Montant à l'échéance" value={formatFCFA(amount + interest)} strong />
        <KeyValue label="Date de déblocage" value={formatDate(unlock)} />
        <KeyValue label="Frais" value="Aucun" />
      </Card>
      {error ? <AppText color={TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{error}</AppText> : null}
      <LegalNotice text="Aucun retrait anticipé n'est possible avant la date de déblocage. Intérêts calculés prorata temporis (base 365 jours)." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', gap: SPACING.sm },
  option: { flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.lightGray, backgroundColor: COLORS.surface },
  optionActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}26` },
});
