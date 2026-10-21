import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '@/theme';
import { AppText } from './AppText';

interface Props {
  length: number;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  dark?: boolean;
  label: string;
  autoFocus?: boolean;
}

/** Saisie de code (OTP / PIN) en cases ; un TextInput caché gère le clavier et l'autofill SMS. */
export function CodeInput({ length, value, onChange, secure, dark, label, autoFocus }: Props) {
  const ref = useRef<TextInput>(null);
  const fg = dark ? COLORS.white : COLORS.navy;
  return (
    <View style={{ gap: SPACING.xs, marginBottom: SPACING.md }}>
      <AppText variant="caption" weight="semibold" color={dark ? COLORS.lightGray : COLORS.darkGray}>
        {label}
      </AppText>
      <Pressable onPress={() => ref.current?.focus()} style={styles.row} accessibilityLabel={`${label}, ${value.length} chiffres sur ${length}`}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i];
          const active = i === value.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                { borderColor: active ? COLORS.gold : dark ? 'rgba(255,255,255,0.25)' : COLORS.lightGray, backgroundColor: dark ? 'rgba(255,255,255,0.08)' : COLORS.white },
              ]}
            >
              <AppText variant="h3" weight="bold" color={fg}>
                {char ? (secure ? '•' : char) : ''}
              </AppText>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType={secure ? 'password' : 'oneTimeCode'}
        autoComplete={secure ? 'off' : 'sms-otp'}
        maxLength={length}
        autoFocus={autoFocus}
        style={styles.hidden}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center' },
  box: { flex: 1, maxWidth: 52, height: 56, borderWidth: 1.5, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1, fontFamily: FONTS.body },
});
