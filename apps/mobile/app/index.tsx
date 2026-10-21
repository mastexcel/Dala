import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MotiView } from 'moti';
import { APP_SLOGAN } from '@dala/shared';
import { AppText, Logo } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { COLORS, SPACING } from '@/theme';

/** Splash animé : logo fade-in + slide-up, puis cercle doré qui s'étend ; redirection après 2,5 s. */
export default function Splash() {
  const { width, height } = useWindowDimensions();
  const onboarded = useAuthStore((s) => s.onboarded);
  const diameter = Math.hypot(width, height) * 1.1;

  useEffect(() => {
    const t = setTimeout(() => router.replace(onboarded ? '/(auth)/login' : '/onboarding'), 2500);
    return () => clearTimeout(t);
  }, [onboarded]);

  return (
    <View style={styles.root} accessibilityLabel={`DALA Finance. ${APP_SLOGAN}`}>
      <StatusBar style="light" />
      <MotiView
        from={{ scale: 0, opacity: 0.9 }}
        animate={{ scale: 1, opacity: 0.12 }}
        transition={{ type: 'timing', duration: 1100, delay: 1100 }}
        style={[styles.circle, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}
      />
      <MotiView from={{ opacity: 0, translateY: 40 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 900 }}>
        <Logo width={Math.min(280, width * 0.7)} />
      </MotiView>
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 700, delay: 700 }}>
        <AppText variant="h4" serif color={COLORS.gold} align="center" style={{ marginTop: SPACING.lg }}>
          {APP_SLOGAN}
        </AppText>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  circle: { position: 'absolute', backgroundColor: COLORS.gold },
});
