import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MotiView } from 'moti';
import { ChartLineUp, Coins, HandCoins, PiggyBank, UsersThree, Vault } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { COLORS, RADIUS, SPACING } from '@/theme';

const SLIDES = [
  { key: 's1', color: COLORS.green, Main: Vault, Accent: Coins, Accent2: PiggyBank },
  { key: 's2', color: COLORS.blue, Main: ChartLineUp, Accent: Coins, Accent2: ChartLineUp },
  { key: 's3', color: COLORS.gold, Main: UsersThree, Accent: HandCoins, Accent2: Coins },
] as const;

export default function Onboarding() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);
  const complete = useAuthStore((s) => s.completeOnboarding);

  const finish = async () => {
    await complete();
    router.replace('/(auth)/register');
  };

  const next = () => {
    if (index < SLIDES.length - 1) list.current?.scrollToIndex({ index: index + 1 });
    else void finish();
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <Pressable onPress={finish} style={styles.skip} accessibilityRole="button">
        <AppText weight="semibold" color={COLORS.lightGray}>
          {t('onboarding.skip')}
        </AppText>
      </Pressable>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <View style={[styles.slide, { width }]}>
            <MotiView
              key={`${item.key}-${index === i}`}
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 14 }}
              style={[styles.illustration, { backgroundColor: `${item.color}26`, borderColor: `${item.color}66` }]}
            >
              <item.Main size={110} color={item.color} weight="duotone" />
              <View style={[styles.bubble, { top: 18, right: 10, backgroundColor: item.color }]}>
                <item.Accent size={26} color={COLORS.white} weight="fill" />
              </View>
              <View style={[styles.bubble, { bottom: 20, left: 6, backgroundColor: COLORS.gold }]}>
                <item.Accent2 size={22} color={COLORS.navy} weight="fill" />
              </View>
            </MotiView>
            <AppText variant="h1" color={COLORS.white} align="center">
              {t(`onboarding.${item.key}Title`)}
            </AppText>
            <AppText color={COLORS.lightGray} align="center" style={{ paddingHorizontal: SPACING.lg }}>
              {t(`onboarding.${item.key}Body`)}
            </AppText>
          </View>
        )}
      />
      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={`Étape ${index + 1} sur ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <MotiView key={s.key} animate={{ width: i === index ? 28 : 8, backgroundColor: i === index ? COLORS.gold : 'rgba(255,255,255,0.35)' }} style={styles.dot} />
          ))}
        </View>
        <Button title={index === SLIDES.length - 1 ? t('onboarding.start') : t('common.continue')} onPress={next} />
        <Pressable onPress={async () => { await complete(); router.replace('/(auth)/login'); }} accessibilityRole="button" style={{ padding: SPACING.md }}>
          <AppText align="center" color={COLORS.lightGray}>
            {t('auth.haveAccount')} <AppText weight="bold" color={COLORS.gold}>{t('auth.login')}</AppText>
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  skip: { alignSelf: 'flex-end', padding: SPACING.md },
  slide: { alignItems: 'center', justifyContent: 'center', gap: SPACING.lg, paddingHorizontal: SPACING.lg },
  illustration: { width: 240, height: 240, borderRadius: 120, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  bubble: { position: 'absolute', width: 52, height: 52, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: SPACING.lg, gap: SPACING.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: SPACING.sm },
  dot: { height: 8, borderRadius: 4 },
});
