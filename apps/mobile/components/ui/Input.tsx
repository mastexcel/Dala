import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { COLORS, FONTS, RADIUS, SIZES, SPACING, TEXT_ON_WHITE } from '@/theme';
import { AppText } from './AppText';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  dark?: boolean;
}

export const Input = forwardRef<TextInput, Props>(function Input({ label, error, hint, prefix, suffix, dark, style, ...rest }, ref) {
  const fg = dark ? COLORS.white : COLORS.black;
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="caption" weight="semibold" color={dark ? COLORS.lightGray : COLORS.darkGray} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : COLORS.white, borderColor: error ? COLORS.red : dark ? 'rgba(255,255,255,0.2)' : COLORS.lightGray },
        ]}
      >
        {prefix}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={dark ? 'rgba(255,255,255,0.5)' : COLORS.midGray}
          maxFontSizeMultiplier={1.5}
          style={[styles.input, { color: fg }, style]}
          {...rest}
        />
        {suffix}
      </View>
      {error ? (
        <AppText variant="small" color={dark ? '#FF8A80' : TEXT_ON_WHITE.red} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small" color={dark ? COLORS.lightGray : TEXT_ON_WHITE.muted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: SPACING.xs, marginBottom: SPACING.md },
  label: { marginBottom: 2 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: 52, gap: SPACING.sm },
  input: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: SIZES.body, paddingVertical: SPACING.sm },
});
