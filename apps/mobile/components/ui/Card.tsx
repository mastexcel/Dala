import { Pressable, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, SHADOW, SPACING } from '@/theme';

interface Props extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
}

export function Card({ onPress, padded = true, style, children, accessibilityLabel, ...rest }: Props) {
  const content = [styles.card, padded && styles.padded, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [content, pressed && { opacity: 0.9 }]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={content} accessibilityLabel={accessibilityLabel} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, ...SHADOW.surface },
  padded: { padding: SPACING.md },
});
