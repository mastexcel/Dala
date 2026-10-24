import 'react-native-gesture-handler';
import '@/i18n';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PERSISTED_KEYS, persister, queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/auth';
import { PinSheet } from '@/components/ui';
import { useRealtime } from '@/hooks/useRealtime';
import { useOrientationPolicy } from '@/hooks/useOrientationPolicy';
import { COLORS } from '@/theme';
import { initMonitoring, withMonitoring } from '@/services/monitoring';

void SplashScreen.preventAutoHideAsync();
initMonitoring();

function Realtime() {
  useRealtime();
  return null;
}

function RootLayout() {
  useOrientationPolicy();
  const [fontsLoaded] = useFonts({
    'DMSerifDisplay-Regular': DMSerifDisplay_400Regular,
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
  });
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded && hydrated) void SplashScreen.hideAsync();
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 7 * 24 * 60 * 60_000,
            dehydrateOptions: { shouldDehydrateQuery: (q) => PERSISTED_KEYS.includes(String(q.queryKey[0])) && q.state.status === 'success' },
          }}
        >
          <Realtime />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.offWhite }, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          </Stack>
          <PinSheet />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default withMonitoring(RootLayout);
