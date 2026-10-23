import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { formatFCFA, savingsInstallments, type Frequency } from '@dala/shared';
import { AppText, Button, Card, Chip, DalaIcon, Header, Input, LegalNotice, Screen } from '@/components/ui';
import { GOAL_ICONS } from '@/components/savings/GoalCard';
import { savingsApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { qk } from '@/hooks/queries';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { FREQUENCY_LABEL } from '@/utils/meta';

const DEADLINES = [
  { label: '3 mois', months: 3 },
  { label: '6 mois', months: 6 },
  { label: '1 an', months: 12 },
  { label: '2 ans', months: 24 },
  { label: 'Sans date', months: 0 },
];

const schema = z
  .object({
    name: z.string().trim().min(2, 'Nommez votre objectif'),
    target: z.string().refine((v) => Number(v) >= 1_000, 'Minimum 1 000 FCFA'),
    autoSave: z.boolean(),
    autoAmount: z.string().optional(),
  })
  .refine((v) => !v.autoSave || Number(v.autoAmount) >= 100, { path: ['autoAmount'], message: 'Minimum 100 FCFA' });

type Form = z.infer<typeof schema>;

export default function CreateGoal() {
  const qc = useQueryClient();
  const [icon, setIcon] = useState<keyof typeof GOAL_ICONS>('target');
  const [months, setMonths] = useState(6);
  const [frequency, setFrequency] = useState<Frequency>('WEEKLY');
  const [error, setError] = useState<string>();
  const { control, handleSubmit, watch, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: '', target: '', autoSave: true, autoAmount: '' } });
  const [target, autoAmount, autoSave] = watch(['target', 'autoAmount', 'autoSave']);
  const installments = savingsInstallments(Number(target) || 0, Number(autoAmount) || 0);

  const submit = handleSubmit(async (v) => {
    setError(undefined);
    try {
      const deadline = months ? new Date(Date.now() + months * 30 * 86_400_000).toISOString() : undefined;
      await savingsApi.createGoal({
        name: v.name,
        targetAmount: Number(v.target),
        deadline,
        autoSave: v.autoSave,
        frequency: v.autoSave ? frequency : undefined,
        autoAmount: v.autoSave ? Number(v.autoAmount) : undefined,
        icon,
      });
      await qc.invalidateQueries({ queryKey: qk.goals });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen header={<Header title="Nouvel objectif" />} footer={<Button title="Créer l'objectif" onPress={submit} loading={formState.isSubmitting} />}>
      <AppText variant="caption" weight="semibold" color={COLORS.darkGray} style={{ marginBottom: SPACING.xs }}>
        Icône
      </AppText>
      <View style={styles.icons}>
        {(Object.keys(GOAL_ICONS) as (keyof typeof GOAL_ICONS)[]).map((k) => {
          const Icon = GOAL_ICONS[k];
          const active = k === icon;
          return (
            <Pressable key={k} onPress={() => setIcon(k)} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={k} style={[styles.icon, active && { backgroundColor: COLORS.green }]}>
              <Icon size={24} color={active ? COLORS.white : COLORS.green} weight="duotone" />
            </Pressable>
          );
        })}
      </View>
      <Controller control={control} name="name" render={({ field, fieldState }) => <Input label="Nom de l'objectif" placeholder="Ex. Mariage, études, commerce…" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <Controller control={control} name="target" render={({ field, fieldState }) => <Input label="Montant cible" keyboardType="number-pad" value={field.value} onChangeText={(t) => field.onChange(t.replace(/\D/g, ''))} error={fieldState.error?.message} suffix={<AppText weight="semibold">FCFA</AppText>} />} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.xs }}>
        <DalaIcon name="schedule" size={22} />
        <AppText variant="caption" weight="semibold" color={COLORS.darkGray}>
          Échéance
        </AppText>
      </View>
      <View style={styles.chips}>
        {DEADLINES.map((d) => (
          <Chip key={d.label} label={d.label} active={months === d.months} onPress={() => setMonths(d.months)} color={COLORS.green} />
        ))}
      </View>

      <Card style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
        <Controller
          control={control}
          name="autoSave"
          render={({ field }) => (
            <View style={styles.switchRow}>
              <DalaIcon name="autosave" size={36} />
              <View style={{ flex: 1 }}>
                <AppText weight="bold">Épargne automatique</AppText>
                <AppText variant="small" color={TEXT_ON_WHITE.muted}>
                  Prélèvement programmé depuis votre compte principal
                </AppText>
              </View>
              <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: COLORS.green }} accessibilityLabel="Épargne automatique" />
            </View>
          )}
        />
        {autoSave ? (
          <>
            <View style={styles.chips}>
              {(['DAILY', 'WEEKLY', 'MONTHLY'] as Frequency[]).map((f) => (
                <Chip key={f} label={FREQUENCY_LABEL[f]} active={frequency === f} onPress={() => setFrequency(f)} color={COLORS.green} />
              ))}
            </View>
            <Controller control={control} name="autoAmount" render={({ field, fieldState }) => <Input label="Montant par prélèvement" keyboardType="number-pad" value={field.value} onChangeText={(t) => field.onChange(t.replace(/\D/g, ''))} error={fieldState.error?.message} suffix={<AppText weight="semibold">FCFA</AppText>} />} />
            {Number.isFinite(installments) && installments > 0 ? (
              <AppText variant="caption" color={TEXT_ON_WHITE.green} weight="semibold">
                Objectif atteint en {installments} prélèvements de {formatFCFA(Number(autoAmount))}.
              </AppText>
            ) : null}
          </>
        ) : null}
      </Card>
      {error ? <AppText color={TEXT_ON_WHITE.red}>{error}</AppText> : null}
      <LegalNotice text="Vous pouvez suspendre ou modifier l'épargne automatique à tout moment, sans frais." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  icon: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: `${COLORS.green}1A`, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
});
