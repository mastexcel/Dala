import { StyleSheet, View } from 'react-native';
import { LEGAL_NOTICE } from '@dala/shared';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText } from './AppText';
import { DalaIcon } from './DalaIcon';

/** Mentions légales BCEAO affichées sur chaque écran financier. */
export function LegalNotice({ text, extra }: { text?: string; extra?: string }) {
  return (
    <View style={styles.box} accessibilityRole="text">
      <DalaIcon name="info" size={20} />
      <View style={{ flex: 1, gap: 4 }}>
        {text ? (
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            {text}
          </AppText>
        ) : null}
        {extra ? (
          <AppText variant="small" color={TEXT_ON_WHITE.muted}>
            {extra}
          </AppText>
        ) : null}
        <AppText variant="small" color={TEXT_ON_WHITE.muted}>
          {LEGAL_NOTICE}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, backgroundColor: COLORS.lightGray, borderRadius: RADIUS.md, marginTop: SPACING.lg },
});
