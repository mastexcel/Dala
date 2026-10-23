import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Crown } from 'phosphor-react-native';
import { formatDate, formatFCFA } from '@dala/shared';
import { AppText, Badge, Button, Card, DalaIcon, ErrorState, Header, KeyValue, LegalNotice, Loading, ProgressBar, Screen } from '@/components/ui';
import { savingsApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { qk, useFinancialMutation, useTontine } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { FREQUENCY_LABEL } from '@/utils/meta';

export default function TontineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useTontine(id);
  const strongAuth = useStrongAuth();
  const [error, setError] = useState<string>();
  const contribute = useFinancialMutation((pin: string) => savingsApi.contribute(id, pin), [qk.tontines]);

  if (q.isLoading) return <Screen wallpaper="savings" header={<Header title="Tontine" />}><Loading /></Screen>;
  if (!q.data) return <Screen wallpaper="savings" header={<Header title="Tontine" />}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Screen>;
  const t = q.data;
  const me = t.members.find((m) => m.position === t.myPosition);
  const beneficiary = t.members.find((m) => m.position === t.currentCycle);
  // Cagnotte d'un tour : cotisation × nombre de membres.
  const pot = t.amount * t.members.length;

  const pay = async () => {
    setError(undefined);
    try {
      await strongAuth((pin) => contribute.mutateAsync(pin!), { amount: t.amount, always: true, title: `Cotiser ${formatFCFA(t.amount)}` });
      track('tontine_contribution', { frequency: t.frequency });
      void q.refetch();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen wallpaper="savings"
      header={<Header title="Tontine" />}
      footer={
        t.status === 'ACTIVE' ? (
          <Button title={me?.hasPaid ? 'Cotisation versée ✓' : `Cotiser maintenant · ${formatFCFA(t.amount)}`} disabled={me?.hasPaid} loading={contribute.isPending} onPress={pay} />
        ) : undefined
      }
    >
      <AppText variant="h2" color={COLORS.navy}>
        {t.name}
      </AppText>
      <Card style={{ marginVertical: SPACING.md, gap: SPACING.sm, backgroundColor: COLORS.navy }}>
        <AppText variant="caption" color={COLORS.lightGray}>
          Prochain bénéficiaire · tour {t.currentCycle}/{t.totalCycles}
        </AppText>
        <View style={styles.row}>
          <Crown size={24} color={COLORS.gold} weight="duotone" />
          <AppText variant="h3" weight="bold" color={COLORS.white}>
            {beneficiary?.name ?? '—'}
          </AppText>
        </View>
        <AppText variant="h2" serif color={COLORS.gold}>
          {formatFCFA(pot)}
        </AppText>
        <ProgressBar value={t.members.filter((m) => m.hasPaid).length / t.members.length} color={COLORS.gold} track="rgba(255,255,255,0.2)" label="Cotisations reçues ce tour" />
        <AppText variant="small" color={COLORS.lightGray}>
          {t.members.filter((m) => m.hasPaid).length}/{t.members.length} cotisations reçues · prochaine échéance le {formatDate(t.nextContributionDate)}
        </AppText>
      </Card>
      <Card>
        <KeyValue label="Cotisation" value={`${formatFCFA(t.amount)} · ${FREQUENCY_LABEL[t.frequency]}`} />
        <KeyValue label="Ma position" value={`n°${t.myPosition}${me?.hasReceived ? ' · déjà perçu' : ''}`} />
        <KeyValue label="Statut" value={t.status === 'ACTIVE' ? 'Active' : t.status === 'PENDING' ? 'En attente de membres' : 'Terminée'} />
      </Card>

      <View style={[styles.row, { marginTop: SPACING.lg, marginBottom: SPACING.sm }]}>
        <DalaIcon name="tontines" size={28} />
        <AppText variant="h4" weight="bold" color={COLORS.navy}>
          Membres ({t.members.length}/{t.maxMembers})
        </AppText>
      </View>
      <Card>
        {t.members.map((m) => (
          <View key={m.id} style={[styles.row, styles.member]}>
            <View style={styles.avatar}>
              <AppText weight="bold" color={COLORS.white}>
                {m.name.slice(0, 1)}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="semibold">
                {m.name}
                {m.position === t.myPosition ? ' (vous)' : ''}
              </AppText>
              <AppText variant="small" color={TEXT_ON_WHITE.muted}>
                Tour n°{m.position}
              </AppText>
            </View>
            {m.hasReceived ? (
              <Badge label="A perçu" color={TEXT_ON_WHITE.gold} />
            ) : m.hasPaid ? (
              <DalaIcon name="success" size={26} label="A cotisé" />
            ) : (
              <DalaIcon name="pending" size={26} label="En attente" />
            )}
          </View>
        ))}
      </Card>

      <View style={[styles.row, { marginTop: SPACING.lg, marginBottom: SPACING.sm }]}>
        <DalaIcon name="contribution" size={28} />
        <AppText variant="h4" weight="bold" color={COLORS.navy}>
          Historique des tours
        </AppText>
      </View>
      <Card>
        {t.members
          .filter((m) => m.hasReceived)
          .map((m) => (
            <KeyValue key={m.id} label={`Tour ${m.position} · ${m.name}`} value={formatFCFA(pot)} color={TEXT_ON_WHITE.green} />
          ))}
        {!t.members.some((m) => m.hasReceived) ? <AppText variant="caption" color={TEXT_ON_WHITE.muted}>Aucun tour versé pour l'instant.</AppText> : null}
      </Card>
      {error ? <AppText color={TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{error}</AppText> : null}
      <LegalNotice text="Les cotisations sont conservées sur un compte de cantonnement jusqu'au versement au bénéficiaire du tour." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  member: { paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lightGray },
  avatar: { width: 38, height: 38, borderRadius: RADIUS.full, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
});
