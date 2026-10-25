import { ImageBackground, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { COLORS, SPACING, centeredColumn, useLayoutMode } from '@/theme';
import { OfflineBanner } from './OfflineBanner';
import { TestPhaseBanner } from './TestPhaseBanner';
import { WALLPAPER_IMAGE, WALLPAPERS, type WallpaperName } from './wallpapers';
import { ContentVeil } from './ContentVeil';

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
  /** Fond d'écran de la section (fixe, ne défile pas avec le contenu). */
  wallpaper?: WallpaperName;
}

export function Screen({ children, scroll = true, background = COLORS.offWhite, dark, padded = true, edges = ['top'], header, footer, refreshing, onRefresh, contentStyle, wallpaper }: Props) {
  const inner = [padded && styles.padded, contentStyle];
  const { contentMax } = useLayoutMode();
  // Colonne centrée : pleine largeur sur téléphone, plafonnée sur tablette et ordinateur.
  const COLUMN = centeredColumn(contentMax);
  const [containerWidth, setContainerWidth] = useState<number>();
  const screen = (
    <SafeAreaView style={[styles.flex, { backgroundColor: wallpaper ? 'transparent' : background }]} edges={edges}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <TestPhaseBanner />
      <OfflineBanner />
      {header ? <View style={COLUMN}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[COLUMN, inner, { paddingBottom: SPACING.xxl }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, COLUMN, inner]}>{children}</View>
      )}
      {footer ? (
        <View style={styles.footer}>
          <View style={COLUMN}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
  if (!wallpaper) return screen;
  return (
    <ImageBackground source={WALLPAPERS[wallpaper]} resizeMode="cover" style={[styles.flex, styles.clip, { backgroundColor: background }]} imageStyle={WALLPAPER_IMAGE} accessibilityIgnoresInvertColors onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <ContentVeil max={contentMax} containerWidth={containerWidth} />
      {screen}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clip: { overflow: 'hidden' },
  padded: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  footer: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.lightGray, backgroundColor: COLORS.white },
});
