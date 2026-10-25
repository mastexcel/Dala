import { StyleSheet, View } from 'react-native';
import { DEMO_NOTICE, TEST_PHASE_NOTICE } from '@dala/shared';
import { USE_MOCKS } from '@/services/config';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText } from './AppText';

/** Statut réglementaire de l'application, affiché bien en vue (splash, connexion, profil, mentions légales). */
export function TestPhaseNotice({ dark }: { dark?: boolean }) {
  return (
    <View
      style={[styles.box, dark ? styles.dark : styles.light]}
      accessibilityRole="text"
      accessibilityLabel={USE_MOCKS ? `${TEST_PHASE_NOTICE}. ${DEMO_NOTICE}` : TEST_PHASE_NOTICE}
    >
      <AppText variant="small" weight="bold" align="center" color={dark ? COLORS.gold : TEXT_ON_WHITE.gold}>
        {TEST_PHASE_NOTICE}
      </AppText>
      {USE_MOCKS ? (
        <AppText variant="small" align="center" color={dark ? COLORS.lightGray : TEXT_ON_WHITE.muted}>
          {DEMO_NOTICE}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'center', maxWidth: 480, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, gap: 2 },
  light: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: COLORS.gold },
  dark: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(212,160,23,0.6)' },
});
