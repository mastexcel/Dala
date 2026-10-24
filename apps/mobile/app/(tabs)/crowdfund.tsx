import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CROWDFUND_REVIEW_DAYS, CROWDFUND_VALIDATOR, LEGAL_NOTICE_CROWDFUND, PROJECT_SECTORS, formatFCFA, formatPercent, type ProjectSector } from '@dala/shared';
import { AppText, Badge, Button, Card, Chip, DalaIcon, EmptyState, ErrorState, LegalNotice, Loading, Screen, SegmentedTabs, PageTitle, ResponsiveGrid } from '@/components/ui';
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
    <Screen wallpaper="crowdfund" onRefresh={() => [projects, portfolio].forEach((q) => void q.refetch())} refreshing={projects.isRefetching}>
      <PageTitle title="Crowdfunding" />
      <AppText color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.md }}>
        Devenez actionnaire des entreprises qui font l'Afrique de l'Ouest, dès 5 000 FCFA.
      </AppText>
      <SegmentedTabs<Tab>
        accent={COLORS.purple}
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'explore', label: 'Explorer', icon: 'explore' },
          { key: 'portfolio', label: 'Mon portfolio', icon: 'portfolio' },
          { key: 'submit', label: 'Soumettre', icon: 'submit-project' },
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
            <ResponsiveGrid gap={SPACING.md}>{projects.data.map((p) => <ProjectCard key={p.id} project={p} onPress={() => router.push(`/crowdfund/${p.id}`)} />)}</ResponsiveGrid>
          ) : (
            <EmptyState icon={<DalaIcon name="explore" size={72} />} title="Aucun projet dans ce secteur" body="Revenez bientôt : de nouveaux projets sont validés chaque mois." />
          )}
        </>
      ) : null}

      {tab === 'portfolio' ? (
        portfolio.isLoading ? (
          <Loading />
        ) : (
          <>
            <Card style={{ backgroundColor: COLORS.purple, marginBottom: SPACING.md }}>
              <View style={styles.cardIcon}>
                <DalaIcon name="portfolio" size={36} />
              </View>
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
              <EmptyState icon={<DalaIcon name="portfolio" size={72} />} title="Pas encore d'investissement" body="Explorez les projets validés et prenez vos premières parts." />
            )}
          </>
        )
      ) : null}

      {tab === 'submit' ? (
        <Card style={{ gap: SPACING.md }}>
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            <DalaIcon name="submit-project" size={56} />
            <DalaIcon name="validated-projects" size={56} />
          </View>
          <AppText variant="h3" weight="bold">
            Vous portez un projet ?
          </AppText>
          <AppText color={COLORS.darkGray}>
            Levez des fonds en capital auprès de la communauté DALA. Chaque dossier est étudié par le comité {CROWDFUND_VALIDATOR}.
          </AppText>
          {(
            [
              ['Infos entreprise', 'user'],
              ['Pitch & chiffres', 'performance'],
              ['Documents', 'details'],
              ['Soumission', 'validated-projects'],
            ] as const
          ).map(([s, icon], i) => (
            <View key={s} style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
              <DalaIcon name={icon} size={28} />
              <AppText>
                {i + 1}. {s}
              </AppText>
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
  cardIcon: { position: 'absolute', right: SPACING.md, top: SPACING.md, backgroundColor: COLORS.white, borderRadius: 12, padding: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
});
