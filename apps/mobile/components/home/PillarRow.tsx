import { StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText, Amount, Card, ProgressBar } from '@/components/ui';

interface Props {
  icon: ReactNode;
  color: string;
  title: string;
  amount: number;
  subtitle: string;
  progress?: number;
  onPress: () => void;
}

export function PillarRow({ icon, color, title, amount, subtitle, progress, onPress }: Props) {
  return (
    <Card onPress={onPress} style={styles.card} accessibilityLabel={`${title} : ${amount} francs CFA. ${subtitle}`}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${color}1A` }]}>{icon}</View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.between}>
            <AppText weight="semibold">{title}</AppText>
            <Amount value={amount} maskable weight="bold" />
          </View>
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            {subtitle}
          </AppText>
        </View>
        <CaretRight size={16} color={COLORS.midGray} />
      </View>
      {progress !== undefined ? (
        <View style={{ marginTop: SPACING.sm }}>
          <ProgressBar value={progress} color={color} label={`${title} : ${Math.round(progress * 100)} % de l'objectif`} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
  icon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
});
