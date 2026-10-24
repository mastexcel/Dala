import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, DalaIcon, type DalaIconName } from '@/components/ui';
import { COLORS, RADIUS, SHADOW, SPACING, TEXT_ON_WHITE } from '@/theme';

const CARDS: { title: string; body: string; icon: DalaIconName; href: string }[] = [
  { title: 'Assistant IA', body: 'Analyse du marché et des opportunités', icon: 'performance', href: '/assistant' },
  { title: 'Un conseiller', body: "Échanger avec l'équipe commerciale", icon: 'investors', href: '/advisor' },
];

/** Accès rapide à l'assistant IA et à l'équipe commerciale. */
export function HelpCards() {
  return (
    <View style={styles.row}>
      {CARDS.map((c) => (
        <Pressable key={c.href} onPress={() => router.push(c.href as never)} accessibilityRole="button" accessibilityLabel={`${c.title} : ${c.body}`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
          <DalaIcon name={c.icon} size={36} />
          <AppText weight="bold">{c.title}</AppText>
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            {c.body}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  card: { flex: 1, gap: 4, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.white, ...SHADOW.card },
});
