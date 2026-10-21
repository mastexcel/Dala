import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { formatDate, formatFCFA, progressRatio } from '@dala/shared';
import { AppText, Button, Card, Chip, CircularProgress, Header, Input, KeyValue, LegalNotice, Loading, Screen } from '@/components/ui';
import { savingsApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { qk, useFinancialMutation, useGoals } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { FREQUENCY_LABEL } from '@/utils/meta';

const PRESETS = [5_000, 10_000, 25_000, 50_000];

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goals = useGoals();
  const goal = goals.data?.find((g) => g.id === id);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>();
  const strongAuth = useStrongAuth();
  const deposit = useFinancialMutation(({ value, pin }: { value: number; pin?: string }) => savingsApi.depositGoal(id, value, pin), [qk.goals]);

  if (!goal) return <Screen header={<Header title="Objectif" />}>{goals.isLoading ? <Loading /> : <AppText>Objectif introuvable</AppText>}</Screen>;

  const ratio = progressRatio(goal.currentAmount, goal.targetAmount);
  const value = Number(amount) || 0;

  const submit = async () => {
    setError(undefined);
    try {
      const r = await strongAuth((pin) => deposit.mutateAsync({ value, pin }), { amount: value });
      if (r) router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen header={<Header title={goal.name} />} footer={<Button title={`Épargner ${value ? formatFCFA(value) : ''}`} disabled={value < 100} loading={deposit.isPending} onPress={submit} />}>
      <View style={{ alignItems: 'center', marginVertical: SPACING.lg, gap: SPACING.sm }}>
        <CircularProgress value={ratio} size={150} stroke={14} color={ratio >= 1 ? COLORS.gold : COLORS.green}>
          <AppText variant="h2" serif>
            {Math.round(ratio * 100)}%
          </AppText>
        </CircularProgress>
        <AppText variant="h3" weight="bold">
          {formatFCFA(goal.currentAmount)}
        </AppText>
        <AppText color={TEXT_ON_WHITE.muted}>sur {formatFCFA(goal.targetAmount)}</AppText>
      </View>
      <Card>
        <KeyValue label="Reste à épargner" value={formatFCFA(Math.max(0, goal.targetAmount - goal.currentAmount))} />
        <KeyValue label="Échéance" value={goal.deadline ? formatDate(goal.deadline) : 'Sans date'} />
        <KeyValue label="Épargne automatique" value={goal.autoSave && goal.frequency && goal.autoAmount ? `${formatFCFA(goal.autoAmount)} · ${FREQUENCY_LABEL[goal.frequency]}` : 'Désactivée'} />
      </Card>
      <AppText variant="h4" weight="bold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
        Verser maintenant
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md }}>
        {PRESETS.map((p) => (
          <Chip key={p} label={formatFCFA(p)} active={value === p} onPress={() => setAmount(String(p))} color={COLORS.green} />
        ))}
      </View>
      <Input label="Montant" keyboardType="number-pad" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} suffix={<AppText weight="semibold">FCFA</AppText>} hint="Prélevé sur votre compte principal, sans frais." />
      {error ? <AppText color={TEXT_ON_WHITE.red}>{error}</AppText> : null}
      <LegalNotice />
    </Screen>
  );
}
