import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { LATEST_APK_URL, useAppUpdate } from '@/hooks/useAppUpdate';
import { COLORS, RADIUS, SPACING } from '@/theme';
import { AppText } from './AppText';
import { DalaIcon } from './DalaIcon';

/** Propose la nouvelle version : le téléchargement s'ouvre dans le navigateur, puis Android l'installe par-dessus. */
export function UpdateBanner() {
  const { available, latest } = useAppUpdate();
  if (!available) return null;
  return (
    <Pressable
      onPress={() => void Linking.openURL(latest?.url ?? LATEST_APK_URL)}
      accessibilityRole="button"
      accessibilityLabel="Mettre à jour l'application"
      style={({ pressed }) => [styles.box, pressed && { opacity: 0.85 }]}
    >
      <DalaIcon name="deposit" size={32} />
      <View style={{ flex: 1 }}>
        <AppText weight="bold" color={COLORS.white}>
          Nouvelle version disponible
        </AppText>
        <AppText variant="small" color={COLORS.lightGray}>
          Touchez pour télécharger la mise à jour, puis ouvrez le fichier pour l'installer. Vos données sont conservées.
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.navy, marginBottom: SPACING.md },
});
