import { Stack } from 'expo-router';
import { COLORS } from '@/theme';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.navy } }} />;
}
