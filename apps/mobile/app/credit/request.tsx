import { useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { CheckCircle, HourglassMedium, XCircle } from 'phosphor-react-native';
import {
  LEGAL_NOTICE_CREDIT,
  LOAN_DURATIONS,
  LOAN_MIN,
  LOAN_STEP,
  formatDate,
  formatFCFA,
  formatPercent,
  quoteLoan,
  type LoanDecision,
} from '@dala/shared';
import { AmountSlider, AppText, Button, Card, Chip, Header, KeyValue, LegalNotice, Loading, Screen } from '@/components/ui';
import { Confetti } from '@/components/charts/Confetti';
import { loanApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { qk, useCredit, useFinancialMutation } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const RESULT: Record<LoanDecision, { title: string; body: string; color: string; Icon: typeof CheckCircle }> = {
  APPROVED: { title: 'Prêt approuvé !', body: 'Les fonds ont été crédités sur votre compte principal.', color: COLORS.gold, Icon: CheckCircle },
  MANUAL_REVIEW: { title: 'Vérification en cours', body: 'Un conseiller examine votre demande. Réponse sous 24 h.', color: COLORS.blue, Icon: HourglassMedium },
  REJECTED: { title: 'Demande non retenue', body: 'Votre score ne permet pas ce montant aujourd’hui. Épargnez régulièrement pour l’améliorer.', color: COLORS.red, Icon: XCircle },
};

export default function LoanRequest() {
  const credit = useCredit();
  const eligible = credit.data?.eligibleAmount ?? 0;
  const [amount, setAmount] = useState(Math.min(50_000, Math.max(LOAN_MIN, eligible)));
  const [duration, setDuration] = useState<number>(30);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string>();
  const [scoring, setScoring] = useState(false);
  const [decision, setDecision] = useState<LoanDecision | null>(null);
  const strongAuth = useStrongAuth();
  const submitLoan = useFinancialMutation(({ pin }: { pin?: string }) => loanApi.request(amount, duration, pin), [qk.credit]);

  // Devis calculé localement avec la même fonction que le serveur (transparence immédiate).
  const quote = useMemo(() => (credit.data ? quoteLoan(amount, duration, credit.data.score) : null), [amount, duration, credit.data]);
  if (!credit.data || !quote) return <Screen header={<Header title="Demander un prêt" />}><Loading /></Screen>;

  const submit = async () => {
    setError(undefined);
    setScoring(true);
    try {
      const r = await strongAuth((pin) => submitLoan.mutateAsync({ pin }), { amount });
      if (r) setDecision(r.decision);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setScoring(false);
    }
  };

  if (decision) {
    const r = RESULT[decision];
    return (
      <Screen scroll={false} background={COLORS.navy} dark edges={['top', 'bottom']}>
        {decision === 'APPROVED' ? <Confetti /> : null}
        <View style={styles.result}>
          <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
            <r.Icon size={96} color={r.color} weight="duotone" />
          </MotiView>
          <AppText variant="h1" color={COLORS.white} align="center">{r.title}</AppText>
          <AppText color={COLORS.lightGray} align="center">{r.body}</AppText>
          {decision === 'APPROVED' ? (
            <AppText variant="h3" weight="bold" color={COLORS.gold}>
              {formatFCFA(amount)} · à rembourser {formatFCFA(quote.totalDue)} le {formatDate(quote.dueDate)}
            </AppText>
          ) : null}
          <Button title="Terminé" onPress={() => router.replace('/(tabs)/credit')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={<Header title="Demander un prêt" />}
      footer={<Button title={scoring ? 'Analyse de votre profil…' : 'Soumettre la demande'} disabled={!accepted || amount > eligible} loading={scoring} onPress={submit} />}
    >
      <Card>
        <AmountSlider value={amount} onChange={setAmount} min={LOAN_MIN} max={Math.max(LOAN_MIN, eligible)} step={LOAN_STEP} color={COLORS.orange} label="Montant souhaité" />
      </Card>
      <AppText variant="h4" weight="bold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
        Durée
      </AppText>
      <View style={styles.chips}>
        {LOAN_DURATIONS.map((d) => (
          <Chip key={d} label={`${d} j`} active={duration === d} onPress={() => setDuration(d)} color={COLORS.orange} />
        ))}
      </View>

      <Card style={{ marginTop: SPACING.lg }}>
        <KeyValue label="Montant emprunté" value={formatFCFA(quote.amount)} />
        <KeyValue label={`Intérêts (${formatPercent(quote.annualRate)} / an)`} value={formatFCFA(quote.interest)} />
        <KeyValue label="Frais de dossier" value={formatFCFA(quote.fees)} />
        <KeyValue label="Total à rembourser" value={formatFCFA(quote.totalDue)} strong />
        <KeyValue label="Date d'échéance" value={formatDate(quote.dueDate)} />
        <KeyValue label="TAEG" value={formatPercent(quote.taeg, 2)} strong color={TEXT_ON_WHITE.orange} />
      </Card>
      <AppText variant="small" color={TEXT_ON_WHITE.muted} style={{ marginTop: SPACING.xs }}>
        TAEG calculé selon la méthode BCEAO, inférieur au taux d'usure en vigueur. Aucune pénalité en cas de remboursement anticipé.
      </AppText>

      <View style={styles.accept}>
        <Switch value={accepted} onValueChange={setAccepted} trackColor={{ true: COLORS.orange }} accessibilityLabel="J'accepte les conditions du prêt" />
        <AppText variant="caption" style={{ flex: 1 }}>
          J'ai pris connaissance du coût total du crédit et de l'échéancier, et j'autorise DALA à analyser mon historique pour évaluer ma demande.
        </AppText>
      </View>
      {error ? <AppText color={TEXT_ON_WHITE.red}>{error}</AppText> : null}
      <LegalNotice text={LEGAL_NOTICE_CREDIT} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  accept: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', marginVertical: SPACING.lg },
  result: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.lg, padding: SPACING.lg },
});
