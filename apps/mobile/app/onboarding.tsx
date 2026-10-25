import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { AppText, Button, DalaIcon, Logo, TestPhaseNotice, type DalaIconName } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { COLORS, MAX_FORM_WIDTH, RADIUS, SPACING, centeredColumn } from '@/theme';

const SLIDES: { key: string; color: string; main: DalaIconName; accent: DalaIconName; accent2: DalaIconName }[] = [
  { key: 's1', color: COLORS.green, main: 'savings', accent: 'vault', accent2: 'goals' },
  { key: 's2', color: COLORS.blue, main: 'invest', accent: 'bonds', accent2: 'sukuk' },
  { key: 's3', color: COLORS.gold, main: 'crowdfund', accent: 'request-loan', accent2: 'validated-projects' },
];

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
      <View style={styles.top}>
        <Logo variant="whiteFine" width={96} />
        <Pressable onPress={finish} style={styles.skip} accessibilityRole="button">
          <AppText weight="semibold" color={COLORS.lightGray}>
            {t('onboarding.skip')}
          </AppText>
        </Pressable>
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <View style={[styles.slide, { width, paddingHorizontal: Math.max(SPACING.lg, (width - MAX_FORM_WIDTH) / 2) }]}>
            <MotiView
              key={`${item.key}-${index === i}`}
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 14 }}
              style={[styles.illustration, { borderColor: item.color }]}
            >
              <DalaIcon name={item.main} size={130} />
              <View style={[styles.bubble, { top: 10, right: 0, borderColor: item.color }]}>
                <DalaIcon name={item.accent} size={44} />
              </View>
              <View style={[styles.bubble, { bottom: 12, left: 0, borderColor: COLORS.gold }]}>
                <DalaIcon name={item.accent2} size={44} />
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
        <TestPhaseNotice dark />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: SPACING.md },
  skip: { padding: SPACING.md },
  slide: { alignItems: 'center', justifyContent: 'center', gap: SPACING.lg },
  illustration: { width: 240, height: 240, borderRadius: 120, borderWidth: 6, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  bubble: { position: 'absolute', width: 68, height: 68, borderRadius: RADIUS.full, borderWidth: 3, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: SPACING.lg, gap: SPACING.md, ...centeredColumn(MAX_FORM_WIDTH) },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: SPACING.sm },
  dot: { height: 8, borderRadius: 4 },
});
