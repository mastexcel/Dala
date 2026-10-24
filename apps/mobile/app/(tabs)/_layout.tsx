import { StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DalaIcon, type DalaIconName } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { COLORS, FONTS, useSideGutter } from '@/theme';

/** Barre d'onglets claire : les icônes illustrées DALA sont conçues pour fond blanc. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.accessToken);
  const gutter = useSideGutter();
  if (!token) return <Redirect href="/(auth)/login" />;

  const icon =
    (name: DalaIconName) =>
    ({ focused }: { focused: boolean }) => (
      <View style={styles.iconWrap}>
        {focused ? <View style={styles.indicator} /> : null}
        <DalaIcon name={name} size={focused ? 30 : 26} dimmed={!focused} />
      </View>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.navy,
        tabBarInactiveTintColor: COLORS.midGray,
        tabBarStyle: [styles.bar, { paddingHorizontal: gutter }],
        tabBarLabelStyle: { fontFamily: FONTS.bodySemiBold, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="savings" options={{ title: t('tabs.savings'), tabBarIcon: icon('savings') }} />
      <Tabs.Screen name="crowdfund" options={{ title: t('tabs.crowdfund'), tabBarIcon: icon('crowdfund') }} />
      <Tabs.Screen name="credit" options={{ title: t('tabs.credit'), tabBarIcon: icon('credit') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('profile') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.white,
    borderTopWidth: 0,
    height: 70,
    paddingBottom: 10,
    paddingTop: 8,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', height: 34 },
  indicator: { position: 'absolute', top: -10, width: 28, height: 4, borderRadius: 2, backgroundColor: COLORS.gold },
});
