import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { errorMessage } from '@/services/errors';
import { AppText } from './AppText';
import { Button } from './Button';

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLabel={label}>
      <ActivityIndicator color={COLORS.gold} size="large" />
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <AppText align="center" color={TEXT_ON_WHITE.red}>
        {errorMessage(error)}
      </AppText>
      {onRetry ? <Button title="Réessayer" variant="outline" onPress={onRetry} fullWidth={false} /> : null}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.center}>
      {icon}
      <AppText variant="h4" weight="bold" align="center">
        {title}
      </AppText>
      {body ? (
        <AppText variant="caption" color={TEXT_ON_WHITE.muted} align="center">
          {body}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="h4" weight="bold" color={COLORS.navy} accessibilityRole="header">
        {title}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: SPACING.xl, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.lg, marginBottom: SPACING.sm },
});
