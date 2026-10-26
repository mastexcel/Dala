import { Linking, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { RichText } from './RichText';

interface Props {
  mine: boolean;
  body: string;
  author?: string | null;
  time?: string;
  /** Message système (accusé de réception, clôture). */
  system?: boolean;
  markdown?: boolean;
  sources?: { title: string; url: string }[];
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function ChatBubble({ mine, body, author, time, system, markdown, sources }: Props) {
  if (system) {
    return (
      <View style={styles.system} accessibilityRole="text">
        <AppText variant="small" align="center" color={TEXT_ON_WHITE.muted}>
          {body}
        </AppText>
      </View>
    );
  }
  const color = mine ? COLORS.white : COLORS.black;
  return (
    <View style={[styles.row, mine ? styles.right : styles.left]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]} accessibilityLabel={`${mine ? 'Vous' : author ?? 'Réponse'} : ${body}`}>
        {author && !mine ? (
          <AppText variant="small" weight="bold" color={TEXT_ON_WHITE.blue}>
            {author}
          </AppText>
        ) : null}
        {markdown && !mine ? <RichText text={body} color={color} /> : <AppText color={color}>{body}</AppText>}
        {sources?.length ? (
          <View style={styles.sources}>
            <AppText variant="small" weight="semibold" color={TEXT_ON_WHITE.muted}>
              Sources
            </AppText>
            {sources.slice(0, 5).map((s) => (
              <AppText key={s.url} variant="small" color={TEXT_ON_WHITE.blue} numberOfLines={1} onPress={() => void Linking.openURL(s.url)} accessibilityRole="link">
                {s.title}
              </AppText>
            ))}
          </View>
        ) : null}
        {time ? (
          <AppText variant="small" color={mine ? 'rgba(255,255,255,0.75)' : TEXT_ON_WHITE.muted} align="right">
            {hhmm(time)}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: SPACING.xs },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '86%', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg, gap: 4 },
  mine: { backgroundColor: COLORS.navy, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.lightGray },
  system: { alignSelf: 'center', maxWidth: '90%', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, marginVertical: SPACING.sm, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.full },
  sources: { marginTop: SPACING.xs, paddingTop: SPACING.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.lightGray, gap: 2 },
});
