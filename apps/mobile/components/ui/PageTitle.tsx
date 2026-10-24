import { StyleSheet, View } from 'react-native';
import { COLORS, SPACING } from '@/theme';
import { AppText } from './AppText';
import { Logo } from './Logo';

/** Grand titre des onglets, accompagné du logo DALA. */
export function PageTitle({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="h1" color={COLORS.navy} style={{ flex: 1 }}>
        {title}
      </AppText>
      <Logo variant="colorLight" width={72} />
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm } });
