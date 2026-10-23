import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LEGAL_NOTICE_CREDIT, formatDate, formatFCFA, formatPercent } from '@dala/shared';
import { AppText, Badge, Button, Card, Chip, DalaIcon, ErrorState, Header, Input, KeyValue, LegalNotice, Loading, ProgressBar, Screen, SectionTitle } from '@/components/ui';
import { loanApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { qk, useFinancialMutation, useLoan } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { LOAN_STATUS_LABEL } from '@/utils/meta';

export default function LoanDetail() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const q = useLoan(loanId);
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string>();
  const strongAuth = useStrongAuth();
  const repay = useFinancialMutation(({ value, pin }: { value: number; pin?: string }) => loanApi.repay(loanId, value, pin), [qk.loan(loanId), qk.credit]);

  if (q.isLoading) return <Screen header={<Header title="Détail du prêt" />}><Loading /></Screen>;
  if (!q.data) return <Screen header={<Header title="Détail du prêt" />}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Screen>;
  const l = q.data;
  const remaining = l.totalDue - l.amountPaid;
  const canRepay = l.status === 'DISBURSED' || l.status === 'OVERDUE';
  const value = mode === 'full' ? remaining : Math.min(Number(partial) || 0, remaining);
  const st = LOAN_STATUS_LABEL[l.status];

  const submit = async () => {
    setError(undefined);
    try {
      await strongAuth((pin) => repay.mutateAsync({ value, pin }), { amount: value, title: `Rembourser ${formatFCFA(value)}` });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen
      header={<Header title="Détail du prêt" />}
      footer={canRepay ? <Button title={`Rembourser ${formatFCFA(value)}`} disabled={value < 100} loading={repay.isPending} onPress={submit} /> : undefined}
    >
      <Card style={{ backgroundColor: COLORS.navy, gap: SPACING.sm }}>
        <View style={styles.between}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <View style={{ backgroundColor: COLORS.white, borderRadius: 10, padding: 3 }}>
              <DalaIcon name="status" size={24} />
            </View>
            <AppText variant="caption" color={COLORS.lightGray}>Reste à rembourser</AppText>
          </View>
          <Badge label={st.label} color={COLORS.white} background={st.color} />
        </View>
        <AppText variant="h1" serif color={COLORS.white}>{formatFCFA(remaining)}</AppText>
        <ProgressBar value={l.amountPaid / l.totalDue} color={COLORS.gold} track="rgba(255,255,255,0.2)" label="Part remboursée" />
        {canRepay ? (
          <AppText variant="h4" weight="bold" color={l.daysLeft < 0 ? '#FF8A80' : COLORS.gold}>
            {l.daysLeft >= 0 ? `${l.daysLeft} jours restants` : `En retard de ${-l.daysLeft} jours`}
          </AppText>
        ) : null}
      </Card>

      <Card style={{ marginTop: SPACING.md }}>
        <KeyValue label="Montant emprunté" value={formatFCFA(l.amount)} />
        <KeyValue label="Taux annuel" value={formatPercent(l.interestRate)} />
        <KeyValue label="Frais" value={formatFCFA(l.fees)} />
        <KeyValue label="Total dû" value={formatFCFA(l.totalDue)} strong />
        <KeyValue label="Déjà remboursé" value={formatFCFA(l.amountPaid)} color={TEXT_ON_WHITE.green} />
        <KeyValue label="Échéance finale" value={formatDate(l.dueDate)} />
      </Card>

      <SectionTitle title="Échéancier" icon="schedule" />
      <Card>
        <View style={[styles.row, styles.head]}>
          <AppText variant="small" weight="bold" style={{ width: 30 }}>N°</AppText>
          <AppText variant="small" weight="bold" style={{ flex: 1 }}>Date</AppText>
          <AppText variant="small" weight="bold" style={{ flex: 1, textAlign: 'right' }}>Montant</AppText>
          <View style={{ width: 32 }} />
        </View>
        {l.schedule.map((s) => (
          <View key={s.index} style={styles.row} accessible accessibilityLabel={`Échéance ${s.index}, ${formatDate(s.dueDate)}, ${s.amount} francs CFA, ${s.paid ? 'payée' : 'à payer'}`}>
            <AppText variant="caption" style={{ width: 30 }}>{s.index}</AppText>
            <AppText variant="caption" style={{ flex: 1 }}>{formatDate(s.dueDate)}</AppText>
            <AppText variant="caption" weight="semibold" style={{ flex: 1, textAlign: 'right' }}>{formatFCFA(s.amount)}</AppText>
            <View style={{ width: 32, alignItems: 'flex-end' }}>
              <DalaIcon name={s.paid ? 'success' : 'pending'} size={24} />
            </View>
          </View>
        ))}
      </Card>

      {canRepay ? (
        <>
          <SectionTitle title="Rembourser" icon="repay" />
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
            <Chip label="Totalité" active={mode === 'full'} onPress={() => setMode('full')} color={COLORS.orange} />
            <Chip label="Montant partiel" active={mode === 'partial'} onPress={() => setMode('partial')} color={COLORS.orange} />
          </View>
          {mode === 'partial' ? (
            <Input label="Montant" keyboardType="number-pad" value={partial} onChangeText={(t) => setPartial(t.replace(/\D/g, ''))} suffix={<AppText weight="semibold">FCFA</AppText>} hint={`Maximum ${formatFCFA(remaining)}`} />
          ) : null}
        </>
      ) : null}
      {error ? <AppText color={TEXT_ON_WHITE.red}>{error}</AppText> : null}
      <LegalNotice text={LEGAL_NOTICE_CREDIT} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lightGray },
  head: { borderBottomWidth: 1 },
});
