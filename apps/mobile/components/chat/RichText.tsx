import { Text, View } from 'react-native';
import { COLORS, FONTS, SPACING } from '@/theme';
import { AppText } from '@/components/ui';

/** Gras `**…**` à l'intérieur d'une ligne. */
function inline(text: string, color: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <Text key={i} style={{ fontFamily: FONTS.bodyBold, color }}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    ),
  );
}

/** Rendu léger du Markdown renvoyé par l'IA : titres, listes, gras et paragraphes. */
export function RichText({ text, color = COLORS.black }: { text: string; color?: string }) {
  const blocks = text.replace(/\r/g, '').split('\n');
  return (
    <View style={{ gap: SPACING.xs }}>
      {blocks.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        const heading = line.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
          return (
            <AppText key={i} weight="bold" color={color} style={{ marginTop: i ? SPACING.xs : 0 }}>
              {inline(heading[1], color)}
            </AppText>
          );
        }
        const bullet = line.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/);
        if (bullet) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: SPACING.xs, paddingLeft: line.startsWith(' ') ? SPACING.md : 0 }}>
              <AppText color={color}>{bullet[1] ? `${bullet[1]}.` : '•'}</AppText>
              <AppText color={color} style={{ flex: 1 }}>
                {inline(bullet[2], color)}
              </AppText>
            </View>
          );
        }
        return (
          <AppText key={i} color={color}>
            {inline(line, color)}
          </AppText>
        );
      })}
    </View>
  );
}
