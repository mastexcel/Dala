import { StyleSheet, View } from 'react-native';
import { Heart, GraduationCap, Storefront, Target, House, Car, Airplane } from 'phosphor-react-native';
import { formatDate, formatFCFA, progressRatio, type SavingsGoalDTO } from '@dala/shared';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Card, CircularProgress } from '@/components/ui';
import { FREQUENCY_LABEL } from '@/utils/meta';

export const GOAL_ICONS = { heart: Heart, graduation: GraduationCap, storefront: Storefront, target: Target, house: House, car: Car, airplane: Airplane } as const;

export function GoalCard({ goal, onPress }: { goal: SavingsGoalDTO; onPress?: () => void }) {
  const ratio = progressRatio(goal.currentAmount, goal.targetAmount);
  const Icon = GOAL_ICONS[goal.icon as keyof typeof GOAL_ICONS] ?? Target;
  return (
    <Card onPress={onPress} style={styles.card} accessibilityLabel={`${goal.name}, ${Math.round(ratio * 100)} % atteint`}>
      <CircularProgress value={ratio} size={68} color={ratio >= 1 ? COLORS.gold : COLORS.green}>
        <AppText variant="small" weight="bold">
          {Math.round(ratio * 100)}%
        </AppText>
      </CircularProgress>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.title}>
          <Icon size={18} color={COLORS.green} weight="duotone" />
          <AppText weight="bold" numberOfLines={1} style={{ flex: 1 }}>
            {goal.name}
          </AppText>
        </View>
        <AppText variant="caption" weight="semibold">
          {formatFCFA(goal.currentAmount)} <AppText variant="caption" color={TEXT_ON_WHITE.muted}>/ {formatFCFA(goal.targetAmount)}</AppText>
        </AppText>
        <AppText variant="small" color={TEXT_ON_WHITE.muted}>
          {goal.autoSave && goal.frequency && goal.autoAmount
            ? `Auto : ${formatFCFA(goal.autoAmount)} · ${FREQUENCY_LABEL[goal.frequency].toLowerCase()}`
            : 'Épargne manuelle'}
          {goal.deadline ? ` · ${formatDate(goal.deadline)}` : ''}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
