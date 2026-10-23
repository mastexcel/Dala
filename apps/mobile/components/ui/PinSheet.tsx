import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Backspace } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useStrongAuthStore } from '@/stores/strongAuth';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText } from './AppText';
import { DalaIcon } from './DalaIcon';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** Feuille de saisie du PIN pour l'authentification forte, montée une fois à la racine. */
export function PinSheet() {
  const request = useStrongAuthStore((s) => s.request);
  const close = useStrongAuthStore((s) => s.close);
  const [pin, setPin] = useState('');

  useEffect(() => setPin(''), [request]);

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      const value = pin;
      setTimeout(() => close(value), 120);
    }
  }, [pin, close]);

  const press = (k: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (k === 'del') setPin((p) => p.slice(0, -1));
    else if (k && pin.length < PIN_LENGTH) setPin((p) => p + k);
  };

  return (
    <Modal visible={!!request} transparent animationType="slide" onRequestClose={() => close(null)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.icon}>
            <DalaIcon name="security" size={40} />
          </View>
          <AppText variant="h4" weight="bold" align="center">
            {request?.title}
          </AppText>
          <AppText variant="caption" align="center" color={TEXT_ON_WHITE.muted}>
            {request?.subtitle}
          </AppText>
          <View style={styles.dots} accessibilityLabel={`${pin.length} chiffres saisis sur ${PIN_LENGTH}`}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
            ))}
          </View>
          <View style={styles.pad}>
            {KEYS.map((k, i) => (
              <Pressable
                key={i}
                disabled={!k}
                onPress={() => press(k)}
                accessibilityRole="button"
                accessibilityLabel={k === 'del' ? 'Effacer' : k}
                style={({ pressed }) => [styles.key, pressed && k ? { backgroundColor: COLORS.lightGray } : null]}
              >
                {k === 'del' ? <Backspace size={26} color={COLORS.navy} /> : <AppText variant="h3" weight="semibold">{k}</AppText>}
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => close(null)} accessibilityRole="button" style={{ padding: SPACING.md }}>
            <AppText weight="semibold" align="center" color={TEXT_ON_WHITE.muted}>
              Annuler
            </AppText>
          </Pressable>
          <AppText variant="small" align="center" color={TEXT_ON_WHITE.muted}>
            Authentification forte — Instruction BCEAO N°001-01-2024, art. 84
          </AppText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xl },
  icon: { alignSelf: 'center', backgroundColor: COLORS.offWhite, padding: SPACING.sm, borderRadius: RADIUS.full },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.md, marginVertical: SPACING.md },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.navy },
  dotFilled: { backgroundColor: COLORS.navy },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  key: { width: '33.33%', height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md },
});
