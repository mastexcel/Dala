import { StyleSheet, View } from 'react-native';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText } from './AppText';

export function KeyValue({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color={TEXT_ON_WHITE.muted} style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant={strong ? 'body' : 'caption'} weight={strong ? 'bold' : 'semibold'} color={color ?? COLORS.black}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lightGray, gap: SPACING.md },
});
