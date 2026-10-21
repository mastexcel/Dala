import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { COLORS, RADIUS, SPACING } from '@/theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

const STYLES: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: COLORS.gold, fg: COLORS.navy },
  secondary: { bg: COLORS.navy, fg: COLORS.white },
  outline: { bg: 'transparent', fg: COLORS.navy, border: COLORS.navy },
  ghost: { bg: 'transparent', fg: COLORS.navy },
  danger: { bg: COLORS.red, fg: COLORS.white },
};

interface Props extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  /** Couleur du texte forcée (ex. bouton ghost sur fond sombre). */
  textColor?: string;
}

export function Button({ title, variant = 'primary', loading, disabled, icon, fullWidth = true, style, textColor, onPress, ...rest }: Props) {
  const s = STYLES[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: s.bg, borderColor: s.border ?? 'transparent', opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor ?? s.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText weight="bold" color={textColor ?? s.fg}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: RADIUS.md, borderWidth: 1.5, paddingHorizontal: SPACING.lg, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});
