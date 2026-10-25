import { StyleSheet, View } from 'react-native';
import { TEST_PHASE_NOTICE } from '@dala/shared';
import { USE_MOCKS } from '@/services/config';
import { COLORS, SPACING } from '@/theme';
import { AppText } from './AppText';

/** Bandeau permanent, en tête de chaque écran : statut de phase de test au sein du LIF-BCEAO. */
export function TestPhaseBanner() {
  return (
    <View style={styles.bar} accessibilityRole="text" accessibilityLabel={TEST_PHASE_NOTICE}>
      <AppText variant="small" weight="bold" color={COLORS.navy} align="center" numberOfLines={2}>
        {TEST_PHASE_NOTICE}
        {USE_MOCKS ? ' · Démonstration' : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: COLORS.gold, paddingHorizontal: SPACING.md, paddingVertical: 4 },
});
