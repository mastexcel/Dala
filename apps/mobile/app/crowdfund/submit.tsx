import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CROWDFUND_REVIEW_DAYS, CROWDFUND_VALIDATOR, PROJECT_SECTORS, formatFCFA, formatPercent, type ProjectSector } from '@dala/shared';
import { AppText, Button, Card, Chip, DalaIcon, Header, Input, KeyValue, LegalNotice, Screen } from '@/components/ui';
import { crowdfundApi, userApi, type SubmitProjectInput } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { sectorLabel } from '@/utils/meta';

const STEPS = ['Entreprise', 'Pitch & chiffres', 'Documents', 'Soumission'];
type Doc = SubmitProjectInput['documents'][number];
const REQUIRED_DOCS: { kind: Doc['kind']; label: string }[] = [
  { kind: 'BUSINESS_PLAN', label: 'Business plan' },
  { kind: 'PROJECTIONS', label: 'Projections financières' },
  { kind: 'OTHER', label: 'Statuts / RCCM' },
];

const num = (min: number, msg: string) => z.string().refine((v) => Number(v) >= min, msg);
const schema = z.object({
  name: z.string().trim().min(2, 'Nom requis'),
  targetMarket: z.string().trim().min(5, 'Décrivez votre marché'),
  founderName: z.string().trim().min(2, 'Nom requis'),
  founderRole: z.string().trim().min(2, 'Rôle requis'),
  description: z.string().trim().min(50, '50 caractères minimum'),
  problem: z.string().trim().min(20, '20 caractères minimum'),
  solution: z.string().trim().min(20, '20 caractères minimum'),
  fundingGoal: num(1_000_000, 'Minimum 1 000 000 FCFA'),
  valuation: num(5_000_000, 'Minimum 5 000 000 FCFA'),
});
type Form = z.infer<typeof schema>;
const STEP_FIELDS: (keyof Form)[][] = [['name', 'targetMarket', 'founderName', 'founderRole'], ['description', 'problem', 'solution', 'fundingGoal', 'valuation']];

export default function SubmitProject() {
  const [step, setStep] = useState(0);
  const [sector, setSector] = useState<ProjectSector>('AGRITECH');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const { control, trigger, getValues, watch, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', targetMarket: '', founderName: '', founderRole: 'Fondateur·rice & CEO', description: '', problem: '', solution: '', fundingGoal: '', valuation: '' },
  });
  const [goal, valuation] = watch(['fundingGoal', 'valuation']);
  const equity = Number(goal) && Number(valuation) ? Number(goal) / Number(valuation) : 0;

  const pickDoc = async (kind: Doc['kind'], label: string) => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (r.canceled) return;
    const file = r.assets[0];
    const { uploadUrl, path } = await userApi.uploadUrl(file.name);
    if (!uploadUrl.startsWith('sandbox://')) {
      const blob = await (await fetch(file.uri)).blob();
      await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': file.mimeType ?? 'application/octet-stream' } });
    }
    setDocs((d) => [...d.filter((x) => x.kind !== kind), { kind, name: `${label} — ${file.name}`, url: path }]);
  };

  const next = async () => {
    setError(undefined);
    if (step < 2 && !(await trigger(STEP_FIELDS[step]))) return;
    if (step === 1 && equity > 0.49) {
      setError("L'equity cédée ne peut pas dépasser 49 % : augmentez la valorisation ou réduisez l'objectif.");
      return;
    }
    if (step === 2 && docs.length < REQUIRED_DOCS.length) {
      setError('Ajoutez les trois documents requis.');
      return;
    }
    if (step < 3) return setStep(step + 1);
    try {
      const v = getValues();
      await crowdfundApi.submit({
        name: v.name,
        sector,
        description: v.description,
        problem: v.problem,
        solution: v.solution,
        targetMarket: v.targetMarket,
        fundingGoal: Number(v.fundingGoal),
        valuation: Number(v.valuation),
        equityMin: Math.max(0.01, Math.round(equity * 100) / 100),
        equityMax: Math.min(0.49, Math.max(0.01, Math.round(equity * 1.5 * 100) / 100)),
        deadline: new Date(Date.now() + 60 * 86_400_000).toISOString(),
        documents: docs,
        teamMembers: [{ name: v.founderName, role: v.founderRole }],
      });
      track('project_submitted', { sector });
      setSubmitted(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (submitted) {
    return (
      <Screen wallpaper="crowdfund" header={<Header title="Projet soumis" />}>
        <View style={{ alignItems: 'center', gap: SPACING.md, marginTop: SPACING.xl }}>
          <DalaIcon name="validated-projects" size={110} />
          <AppText variant="h2" align="center">Merci !</AppText>
          <AppText align="center" color={COLORS.darkGray}>
            Votre projet sera examiné par le comité {CROWDFUND_VALIDATOR}. Délai moyen : {CROWDFUND_REVIEW_DAYS} jours ouvrés.
          </AppText>
          <Button title="Retour au crowdfunding" variant="secondary" onPress={() => router.replace('/(tabs)/crowdfund')} />
        </View>
      </Screen>
    );
  }

  const field = (name: keyof Form, label: string, opts: { multiline?: boolean; numeric?: boolean; placeholder?: string } = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <Input
          label={label}
          value={f.value}
          placeholder={opts.placeholder}
          onChangeText={(t) => f.onChange(opts.numeric ? t.replace(/\D/g, '') : t)}
          keyboardType={opts.numeric ? 'number-pad' : 'default'}
          multiline={opts.multiline}
          style={opts.multiline ? { minHeight: 90, textAlignVertical: 'top' } : undefined}
          error={fieldState.error?.message}
          suffix={opts.numeric ? <AppText weight="semibold">FCFA</AppText> : undefined}
        />
      )}
    />
  );

  return (
    <Screen wallpaper="crowdfund"
      header={<Header title="Soumettre un projet" onBack={step ? () => setStep(step - 1) : undefined} />}
      footer={<Button title={step === 3 ? 'Soumettre au comité' : 'Continuer'} variant="secondary" onPress={next} loading={formState.isSubmitting} />}
    >
      <View style={styles.stepper} accessibilityLabel={`Étape ${step + 1} sur 4 : ${STEPS[step]}`}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, gap: 4 }}>
            <View style={[styles.bar, { backgroundColor: i <= step ? COLORS.purple : COLORS.lightGray }]} />
            <AppText variant="small" weight={i === step ? 'bold' : 'regular'} color={i === step ? TEXT_ON_WHITE.purple : TEXT_ON_WHITE.muted}>
              {i + 1}. {s}
            </AppText>
          </View>
        ))}
      </View>

      {step === 0 ? (
        <>
          {field('name', "Nom de l'entreprise")}
          <AppText variant="caption" weight="semibold" color={COLORS.darkGray} style={{ marginBottom: SPACING.xs }}>
            Secteur
          </AppText>
          <View style={styles.chips}>
            {(Object.keys(PROJECT_SECTORS) as ProjectSector[]).map((s) => (
              <Chip key={s} label={sectorLabel(s)} active={sector === s} onPress={() => setSector(s)} color={COLORS.purple} />
            ))}
          </View>
          {field('targetMarket', 'Marché cible', { placeholder: 'Ex. commerçantes du marché d’Adjamé' })}
          {field('founderName', 'Fondateur·rice principal·e')}
          {field('founderRole', 'Rôle')}
        </>
      ) : null}

      {step === 1 ? (
        <>
          {field('description', 'Description du projet', { multiline: true })}
          {field('problem', 'Le problème', { multiline: true })}
          {field('solution', 'Votre solution', { multiline: true })}
          {field('fundingGoal', 'Montant recherché', { numeric: true })}
          {field('valuation', 'Valorisation post-money', { numeric: true })}
          {equity ? (
            <AppText variant="caption" weight="semibold" color={equity > 0.49 ? TEXT_ON_WHITE.red : TEXT_ON_WHITE.purple}>
              Equity cédée si l'objectif est atteint : {formatPercent(equity)}
            </AppText>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <AppText color={COLORS.darkGray} style={{ marginBottom: SPACING.md }}>
            Formats acceptés : PDF ou image. Ces documents seront transmis au comité {CROWDFUND_VALIDATOR}.
          </AppText>
          {REQUIRED_DOCS.map((d) => {
            const doc = docs.find((x) => x.kind === d.kind);
            return (
              <Card key={d.kind} onPress={() => void pickDoc(d.kind, d.label).catch((e) => setError(errorMessage(e)))} style={{ marginBottom: SPACING.sm }} accessibilityLabel={`Ajouter ${d.label}`}>
                <View style={styles.row}>
                  <DalaIcon name={doc ? 'success' : 'submit-project'} size={34} />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">{d.label}</AppText>
                    <AppText variant="small" color={TEXT_ON_WHITE.muted} numberOfLines={1}>
                      {doc ? doc.name : 'Appuyez pour ajouter'}
                    </AppText>
                  </View>
                  {doc ? (
                    <Pressable onPress={() => setDocs((x) => x.filter((y) => y.kind !== d.kind))} accessibilityRole="button" accessibilityLabel="Retirer">
                      <DalaIcon name="delete" size={28} />
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <View style={{ alignItems: 'center', marginBottom: SPACING.md }}>
            <DalaIcon name="validated-projects" size={80} />
          </View>
          <Card>
            <KeyValue label="Entreprise" value={getValues('name')} />
            <KeyValue label="Secteur" value={sectorLabel(sector)} />
            <KeyValue label="Montant recherché" value={formatFCFA(Number(goal))} />
            <KeyValue label="Valorisation" value={formatFCFA(Number(valuation))} />
            <KeyValue label="Equity cédée" value={formatPercent(equity)} />
            <KeyValue label="Documents" value={`${docs.length} fichiers`} />
            <KeyValue label="Type de financement" value="Capital (equity)" />
          </Card>
          <AppText color={COLORS.darkGray} style={{ marginTop: SPACING.md }}>
            Votre projet sera examiné par le comité {CROWDFUND_VALIDATOR}. Délai moyen : {CROWDFUND_REVIEW_DAYS} jours ouvrés.
          </AppText>
        </>
      ) : null}

      {error ? <AppText color={TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{error}</AppText> : null}
      <LegalNotice text="DALA Finance ne propose que du financement en capital : ni prêt participatif, ni don." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.lg },
  bar: { height: 4, borderRadius: RADIUS.full },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
});
