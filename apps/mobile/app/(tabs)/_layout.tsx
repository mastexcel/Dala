import { Redirect, Tabs } from 'expo-router';
import { House, Lightning, PiggyBank, UserCircle, UsersThree } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { COLORS, FONTS } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Redirect href="/(auth)/login" />;

  const icon =
    (Icon: typeof House) =>
    ({ color, focused }: { color: string; focused: boolean }) => <Icon size={26} color={color} weight={focused ? 'duotone' : 'regular'} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.65)',
        tabBarStyle: { backgroundColor: COLORS.navy, borderTopWidth: 0, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: FONTS.bodySemiBold, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon(House) }} />
      <Tabs.Screen name="savings" options={{ title: t('tabs.savings'), tabBarIcon: icon(PiggyBank) }} />
      <Tabs.Screen name="crowdfund" options={{ title: t('tabs.crowdfund'), tabBarIcon: icon(UsersThree) }} />
      <Tabs.Screen name="credit" options={{ title: t('tabs.credit'), tabBarIcon: icon(Lightning) }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon(UserCircle) }} />
    </Tabs>
  );
}
