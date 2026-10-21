import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { COLORS, SPACING } from '@/theme';

/** Fond dégradé navy → navy clair des écrans d'authentification. */
export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={[COLORS.navy, '#1A2E5A']} style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.sm } });
