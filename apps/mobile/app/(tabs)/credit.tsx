import { View } from 'react-native';
import { router } from 'expo-router';
import { LEGAL_NOTICE_CREDIT, LOAN_MAX, LOAN_MIN, formatFCFA } from '@dala/shared';
import { AppText, Button, Card, DalaIcon, EmptyState, ErrorState, LegalNotice, Loading, Screen, SectionTitle } from '@/components/ui';
import { ScoreGauge } from '@/components/charts/ScoreGauge';
import { LoanRow } from '@/components/credit/LoanRow';
import { useCredit } from '@/hooks/queries';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const TIPS = ['Épargnez chaque semaine, même un petit montant', 'Cotisez à l’heure dans vos tontines', 'Remboursez vos prêts avant l’échéance', 'Complétez votre KYC niveau 2'];

export default function Credit() {
  const q = useCredit();
  const c = q.data;
  const active = c?.loans.find((l) => l.status === 'DISBURSED' || l.status === 'OVERDUE' || l.status === 'PENDING');

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <AppText variant="h1" color={COLORS.navy}>
        Micro-crédit
      </AppText>
      {q.isLoading ? (
        <Loading />
      ) : !c ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Card style={{ backgroundColor: COLORS.navy, alignItems: 'center', marginTop: SPACING.md, gap: SPACING.sm, paddingVertical: SPACING.lg }}>
            <View style={{ position: 'absolute', left: SPACING.md, top: SPACING.md, backgroundColor: COLORS.white, borderRadius: 12, padding: 4 }}>
              <DalaIcon name="score" size={30} />
            </View>
            <ScoreGauge score={c.score} />
            <AppText variant="caption" color={COLORS.lightGray}>
              Montant éligible
            </AppText>
            <AppText variant="h1" serif color={COLORS.gold}>
              {formatFCFA(c.eligibleAmount)}
            </AppText>
            <AppText variant="small" color={COLORS.lightGray} align="center">
              Prêts instantanés de {formatFCFA(LOAN_MIN)} à {formatFCFA(LOAN_MAX)}, de 7 à 90 jours
            </AppText>
          </Card>

          {active ? (
            <Card onPress={() => router.push(`/credit/${active.id}`)} style={{ marginTop: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.orange, flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <DalaIcon name="schedule" size={36} />
              <View style={{ flex: 1 }}>
                <AppText weight="bold">Prêt en cours · {formatFCFA(active.totalDue - active.amountPaid)} restants</AppText>
                <AppText variant="small" color={TEXT_ON_WHITE.muted}>
                  Appuyez pour voir l'échéancier et rembourser
                </AppText>
              </View>
            </Card>
          ) : null}

          <View style={{ marginTop: SPACING.md }}>
            <Button
              title="Demander un prêt"
              icon={<DalaIcon name="request-loan" size={28} />}
              disabled={c.eligibleAmount === 0}
              onPress={() => router.push('/credit/request')}
            />
            {c.eligibleAmount === 0 ? (
              <AppText variant="small" color={TEXT_ON_WHITE.muted} align="center" style={{ marginTop: SPACING.xs }}>
                {active ? 'Remboursez votre prêt en cours pour en demander un nouveau.' : 'Votre score est encore trop bas : continuez à épargner régulièrement.'}
              </AppText>
            ) : null}
          </View>

          <SectionTitle title="Historique des emprunts" icon="my-loans" />
          {c.loans.length ? (
            c.loans.map((l) => <LoanRow key={l.id} loan={l} onPress={() => router.push(`/credit/${l.id}`)} />)
          ) : (
            <EmptyState icon={<DalaIcon name="my-loans" size={72} />} title="Aucun emprunt" body="Votre historique de prêts apparaîtra ici." />
          )}

          <SectionTitle title="Améliorer mon score" icon="performance" />
          <Card style={{ gap: SPACING.sm }}>
            {TIPS.map((t) => (
              <View key={t} style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
                <DalaIcon name="success" size={22} />
                <AppText variant="caption" style={{ flex: 1 }}>{t}</AppText>
              </View>
            ))}
          </Card>
        </>
      )}
      <LegalNotice text={LEGAL_NOTICE_CREDIT} />
    </Screen>
  );
}
