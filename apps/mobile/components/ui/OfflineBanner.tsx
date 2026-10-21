import { StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { WifiSlash } from 'phosphor-react-native';
import { COLORS, SPACING } from '@/theme';
import { AppText } from './AppText';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  if (!offline) return null;
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <WifiSlash size={16} color={COLORS.navy} />
      <AppText variant="small" weight="semibold" color={COLORS.navy}>
        Hors ligne — données de la dernière synchronisation
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gold, paddingVertical: 6 },
});
