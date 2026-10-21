import { Image, StyleSheet, View } from 'react-native';
import { CalendarBlank, Diamond, Users } from 'phosphor-react-native';
import { daysBetween, formatCompact, formatPercent, type ProjectDTO } from '@dala/shared';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Badge, Button, Card, ProgressBar } from '@/components/ui';
import { SECTOR_COLOR, sectorLabel } from '@/utils/meta';
import { ValidatedBadge } from './ValidatedBadge';

export function ProjectCard({ project, onPress }: { project: ProjectDTO; onPress: () => void }) {
  const ratio = project.fundingRaised / project.fundingGoal;
  const days = Math.max(0, daysBetween(new Date(), new Date(project.deadline)));
  return (
    <Card padded={false} onPress={onPress} style={styles.card} accessibilityLabel={`${project.name}, ${Math.round(ratio * 100)} % levés, ${days} jours restants`}>
      <View>
        {project.imageUrl ? <Image source={{ uri: project.imageUrl }} style={[styles.image, { backgroundColor: `${SECTOR_COLOR[project.sector]}33` }]} accessibilityIgnoresInvertColors /> : <View style={[styles.image, { backgroundColor: COLORS.purple }]} />}
        <View style={styles.sector}>
          <Badge label={sectorLabel(project.sector)} color={COLORS.white} background={SECTOR_COLOR[project.sector]} />
        </View>
      </View>
      <View style={styles.body}>
        <AppText variant="h4" weight="bold">
          {project.name}
        </AppText>
        <AppText variant="caption" color={TEXT_ON_WHITE.muted} numberOfLines={2}>
          {project.tagline}
        </AppText>
        <ValidatedBadge />
        <View style={{ gap: 4, marginTop: SPACING.xs }}>
          <ProgressBar value={ratio} color={COLORS.purple} label="Montant levé" />
          <View style={styles.between}>
            <AppText variant="caption" weight="bold" color={TEXT_ON_WHITE.purple}>
              {Math.round(ratio * 100)}%
            </AppText>
            <AppText variant="caption" weight="semibold">
              {formatCompact(project.fundingRaised)} / {formatCompact(project.fundingGoal)} FCFA
            </AppText>
          </View>
        </View>
        <View style={styles.meta}>
          <Meta icon={<Users size={16} color={COLORS.midGray} />} text={`${project.investorCount} investisseurs`} />
          <Meta icon={<CalendarBlank size={16} color={COLORS.midGray} />} text={`${days} jours restants`} />
          <Meta icon={<Diamond size={16} color={COLORS.midGray} />} text={`Equity : ${formatPercent(project.equityMin, 0)}–${formatPercent(project.equityMax, 0)}`} />
        </View>
        <Button title="Investir" variant="secondary" onPress={onPress} />
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <AppText variant="small" color={TEXT_ON_WHITE.muted}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.md, overflow: 'hidden' },
  image: { width: '100%', height: 150, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg },
  sector: { position: 'absolute', top: SPACING.sm, left: SPACING.sm },
  body: { padding: SPACING.md, gap: SPACING.xs },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { gap: 4, marginVertical: SPACING.sm },
});
