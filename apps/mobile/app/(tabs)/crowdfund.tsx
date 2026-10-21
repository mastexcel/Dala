import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Briefcase, RocketLaunch, SealCheck } from 'phosphor-react-native';
import { CROWDFUND_REVIEW_DAYS, CROWDFUND_VALIDATOR, LEGAL_NOTICE_CROWDFUND, PROJECT_SECTORS, formatFCFA, formatPercent, type ProjectSector } from '@dala/shared';
import { AppText, Badge, Button, Card, Chip, EmptyState, ErrorState, LegalNotice, Loading, Screen, SegmentedTabs } from '@/components/ui';
import { ProjectCard } from '@/components/crowdfund/ProjectCard';
import { useCrowdfundPortfolio, useProjects } from '@/hooks/queries';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { sectorLabel } from '@/utils/meta';

type Tab = 'explore' | 'portfolio' | 'submit';

const HOLDING_STATUS = {
  EN_COURS: { label: 'En cours', color: TEXT_ON_WHITE.blue },
  FINANCE: { label: 'Financé', color: TEXT_ON_WHITE.green },
  CLOTURE: { label: 'Clôturé', color: TEXT_ON_WHITE.muted },
};

export default function Crowdfund() {
  const [tab, setTab] = useState<Tab>('explore');
  const [sector, setSector] = useState<ProjectSector | undefined>();
  const projects = useProjects(sector);
  const portfolio = useCrowdfundPortfolio();

  return (
    <Screen onRefresh={() => [projects, portfolio].forEach((q) => void q.refetch())} refreshing={projects.isRefetching}>
      <AppText variant="h1" color={COLORS.navy}>
        Crowdfunding
      </AppText>
      <AppText color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.md }}>
        Devenez actionnaire des entreprises qui font l'Afrique de l'Ouest, dès 5 000 FCFA.
      </AppText>
      <SegmentedTabs<Tab>
        accent={COLORS.purple}
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'explore', label: 'Explorer' },
          { key: 'portfolio', label: 'Mon portfolio' },
          { key: 'submit', label: 'Soumettre' },
        ]}
      />

      {tab === 'explore' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Tous" active={!sector} onPress={() => setSector(undefined)} color={COLORS.purple} />
            {(Object.keys(PROJECT_SECTORS) as ProjectSector[])
              .filter((s) => s !== 'OTHER')
              .map((s) => (
                <Chip key={s} label={sectorLabel(s)} active={sector === s} onPress={() => setSector(s)} color={COLORS.purple} />
              ))}
          </ScrollView>
          {projects.isLoading ? (
            <Loading />
          ) : projects.error && !projects.data ? (
            <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
          ) : projects.data?.length ? (
            projects.data.map((p) => <ProjectCard key={p.id} project={p} onPress={() => router.push(`/crowdfund/${p.id}`)} />)
          ) : (
            <EmptyState icon={<RocketLaunch size={48} color={COLORS.purple} weight="duotone" />} title="Aucun projet dans ce secteur" body="Revenez bientôt : de nouveaux projets sont validés chaque mois." />
          )}
        </>
      ) : null}

      {tab === 'portfolio' ? (
        portfolio.isLoading ? (
          <Loading />
        ) : (
          <>
            <Card style={{ backgroundColor: COLORS.purple, marginBottom: SPACING.md }}>
              <AppText variant="caption" color={COLORS.white}>
                Total investi en capital
              </AppText>
              <AppText variant="h2" serif color={COLORS.white}>
                {formatFCFA(portfolio.data?.totalInvested ?? 0)}
              </AppText>
            </Card>
            {portfolio.data?.holdings.length ? (
              portfolio.data.holdings.map((h) => (
                <Card key={h.id} onPress={() => router.push(`/crowdfund/${h.projectId}`)} style={{ marginBottom: SPACING.sm, gap: 4 }}>
                  <View style={styles.between}>
                    <AppText weight="bold">{h.projectName}</AppText>
                    <Badge label={HOLDING_STATUS[h.status].label} color={HOLDING_STATUS[h.status].color} />
                  </View>
                  <AppText variant="small" color={TEXT_ON_WHITE.muted}>
                    {sectorLabel(h.sector)}
                  </AppText>
                  <View style={styles.between}>
                    <View>
                      <AppText variant="small" color={TEXT_ON_WHITE.muted}>Investi</AppText>
                      <AppText weight="semibold">{formatFCFA(h.amount)}</AppText>
                    </View>
                    <View>
                      <AppText variant="small" color={TEXT_ON_WHITE.muted}>Part du capital</AppText>
                      <AppText weight="semibold">{formatPercent(h.equityPct, 4)}</AppText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <AppText variant="small" color={TEXT_ON_WHITE.muted}>Valeur estimée</AppText>
                      <AppText weight="semibold" color={TEXT_ON_WHITE.purple}>{formatFCFA(h.estimatedValue)}</AppText>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <EmptyState icon={<Briefcase size={48} color={COLORS.purple} weight="duotone" />} title="Pas encore d'investissement" body="Explorez les projets validés et prenez vos premières parts." />
            )}
          </>
        )
      ) : null}

      {tab === 'submit' ? (
        <Card style={{ gap: SPACING.md }}>
          <SealCheck size={40} color={COLORS.purple} weight="duotone" />
          <AppText variant="h3" weight="bold">
            Vous portez un projet ?
          </AppText>
          <AppText color={COLORS.darkGray}>
            Levez des fonds en capital auprès de la communauté DALA. Chaque dossier est étudié par le comité {CROWDFUND_VALIDATOR}.
          </AppText>
          {['Infos entreprise', 'Pitch & chiffres', 'Documents', 'Soumission'].map((s, i) => (
            <View key={s} style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
              <Badge label={String(i + 1)} color={COLORS.white} background={COLORS.purple} />
              <AppText>{s}</AppText>
            </View>
          ))}
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            Délai moyen d'examen : {CROWDFUND_REVIEW_DAYS} jours ouvrés. Financement en capital (equity) uniquement.
          </AppText>
          <Button title="Soumettre mon projet" variant="secondary" onPress={() => router.push('/crowdfund/submit')} />
        </Card>
      ) : null}

      <LegalNotice text={LEGAL_NOTICE_CROWDFUND} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: SPACING.sm, paddingBottom: SPACING.md },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
});
