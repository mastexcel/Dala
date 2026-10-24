import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { AppText, DalaIcon } from '@/components/ui';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

/** Ouvre l'assistant IA avec une question préremplie sur l'offre affichée. */
export function AskAiLink({ prompt, label = "Analyser avec l'assistant IA" }: { prompt: string; label?: string }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/assistant', params: { prompt } })} accessibilityRole="link" style={({ pressed }) => [styles.link, pressed && { opacity: 0.8 }]}>
      <DalaIcon name="performance" size={24} />
      <AppText variant="caption" weight="bold" color={TEXT_ON_WHITE.blue} style={{ flex: 1 }}>
        {label} →
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, marginVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray },
});
