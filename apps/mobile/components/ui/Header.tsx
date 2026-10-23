import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { COLORS, SPACING } from '@/theme';
import { AppText } from './AppText';
import { DalaIcon } from './DalaIcon';

interface Props {
  title: string;
  right?: ReactNode;
  light?: boolean;
  onBack?: () => void;
}

export function Header({ title, right, light, onBack }: Props) {
  const color = light ? COLORS.white : COLORS.navy;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour"
        hitSlop={12}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')))}
        style={styles.side}
      >
        {light ? <ArrowLeft size={24} color={color} /> : <DalaIcon name="back" size={32} />}
      </Pressable>
      <AppText variant="h4" weight="bold" color={color} numberOfLines={1} style={styles.title} accessibilityRole="header">
        {title}
      </AppText>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, minHeight: 52 },
  side: { width: 40 },
  title: { flex: 1, textAlign: 'center' },
});
