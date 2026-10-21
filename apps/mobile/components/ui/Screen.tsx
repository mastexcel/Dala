import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { COLORS, SPACING } from '@/theme';
import { OfflineBanner } from './OfflineBanner';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  background?: string;
  dark?: boolean;
  padded?: boolean;
  edges?: Edge[];
  header?: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}

export function Screen({ children, scroll = true, background = COLORS.offWhite, dark, padded = true, edges = ['top'], header, footer, refreshing, onRefresh, contentStyle }: Props) {
  const inner = [padded && styles.padded, contentStyle];
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: background }]} edges={edges}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <OfflineBanner />
      {header}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[inner, { paddingBottom: SPACING.xxl }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  footer: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.lightGray, backgroundColor: COLORS.white },
});
