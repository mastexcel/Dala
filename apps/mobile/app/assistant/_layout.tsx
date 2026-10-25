import { Redirect, Stack } from 'expo-router';
import { FEATURES } from '@/utils/features';

/** Module fermé pendant la phase de test : tout lien direct ramène à l'accueil. */
export default function Layout() {
  if (!FEATURES.assistant) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
