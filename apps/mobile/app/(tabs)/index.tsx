import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatFCFA, progressRatio } from '@dala/shared';
import { AppText, Card, DalaIcon, ErrorState, LegalNotice, Loading, Logo, SectionTitle, Screen, ResponsiveGrid } from '@/components/ui';
import { BalanceCard } from '@/components/home/BalanceCard';
import { QuickActions } from '@/components/home/QuickActions';
import { PillarRow } from '@/components/home/PillarRow';
import { HelpCards } from '@/components/home/HelpCards';
import { FEATURES } from '@/utils/features';
import { TransactionRow } from '@/components/home/TransactionRow';
import { useNotifications, useSummary, useTransactions } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { COLORS, PILLAR_COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

export default function Home() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const summary = useSummary();
  const tx = useTransactions('ALL', undefined, 5);
  const notifications = useNotifications();
  const unread = notifications.data?.unread ?? 0;

  const refresh = () => {
    void summary.refetch();
    void tx.refetch();
    void notifications.refetch();
  };

  return (
    <Screen wallpaper="home" refreshing={summary.isRefetching} onRefresh={refresh}>
      <View style={styles.header}>
        <View style={{ gap: 2 }}>
          <Logo variant="colorLight" width={96} />
          <AppText variant="h3" weight="bold" color={COLORS.navy} accessibilityRole="header">
            {t('home.hello', { name: user?.firstName ?? '' })}
          </AppText>
        </View>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Notifications, ${unread} non lues`}>
          <DalaIcon name="notifications" size={34} />
          {unread > 0 ? (
            <View style={styles.dot}>
              <AppText variant="small" weight="bold" color={COLORS.white} style={{ fontSize: 10, lineHeight: 12 }}>
                {unread}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      {summary.isLoading ? (
        <Loading />
      ) : summary.error && !summary.data ? (
        <ErrorState error={summary.error} onRetry={refresh} />
      ) : summary.data ? (
        <>
          <BalanceCard summary={summary.data} />
          <QuickActions />
          <ResponsiveGrid>
          <PillarRow
            icon="savings"
            color={PILLAR_COLORS.savings}
            title={t('home.savings')}
            amount={summary.data.savings + summary.data.vault}
            subtitle={`${Math.round(progressRatio(summary.data.savings, summary.data.savingsTarget) * 100)} % de vos objectifs`}
            progress={progressRatio(summary.data.savings, summary.data.savingsTarget)}
            onPress={() => router.push('/(tabs)/savings')}
          />
          {FEATURES.invest ? (
            <PillarRow
              icon="invest"
              color={PILLAR_COLORS.invest}
              title={t('home.invest')}
              amount={summary.data.investments}
              subtitle="Bons du Trésor · jusqu'à 6,5 %/an"
              onPress={() => router.push('/invest')}
            />
          ) : null}
          {FEATURES.crowdfund ? (
            <PillarRow
              icon="crowdfund"
              color={PILLAR_COLORS.crowdfund}
              title={t('home.crowdfund')}
              amount={summary.data.crowdfund}
              subtitle={t('home.activeProjects', { count: summary.data.crowdfundActiveProjects })}
              onPress={() => router.push('/(tabs)/crowdfund')}
            />
          ) : null}
          <PillarRow
            icon="credit"
            color={PILLAR_COLORS.credit}
            title={t('home.credit')}
            amount={summary.data.creditOutstanding}
            subtitle={summary.data.creditEligible > 0 ? t('home.eligible', { amount: formatFCFA(summary.data.creditEligible) }) : 'Prêt en cours'}
            onPress={() => router.push('/(tabs)/credit')}
          />
          </ResponsiveGrid>
          <HelpCards />
        </>
      ) : null}

      <SectionTitle
        title={t('home.recent')}
        action={
          <Pressable onPress={() => router.push('/transactions')} accessibilityRole="link">
            <AppText variant="caption" weight="bold" color={TEXT_ON_WHITE.blue}>
              {t('common.seeAll')}
            </AppText>
          </Pressable>
        }
      />
      <Card>
        {tx.data?.items.length ? (
          tx.data.items.map((item) => <TransactionRow key={item.id} tx={item} />)
        ) : (
          <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
            Aucune transaction pour le moment.
          </AppText>
        )}
      </Card>
      <LegalNotice />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  dot: { position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: RADIUS.full, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});
