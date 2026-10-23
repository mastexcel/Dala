import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { COLORS, SPACING } from '@/theme';
import { WALLPAPER_IMAGE, WALLPAPERS } from './wallpapers';

/** Fond des écrans de connexion et d'inscription (wallpaper « auth », thème clair). */
export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <ImageBackground source={WALLPAPERS.auth} resizeMode="cover" style={{ flex: 1, overflow: 'hidden', backgroundColor: COLORS.white }} imageStyle={WALLPAPER_IMAGE} accessibilityIgnoresInvertColors>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.sm } });
