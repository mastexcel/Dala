import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { formatRelative } from '@dala/shared';
import { AppText, Card, DalaIcon, EmptyState, Header, Loading, Screen, type DalaIconName } from '@/components/ui';
import { qk, useNotifications } from '@/hooks/queries';
import { notificationApi } from '@/services/api';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

const TYPE_ICON: Record<string, DalaIconName> = {
  TRANSACTION: 'transfers',
  SAVINGS: 'tx-savings',
  INVEST: 'tx-invest',
  CROWDFUND: 'tx-crowdfund',
  CREDIT: 'tx-credit',
  SECURITY: 'security',
  KYC: 'kyc',
  SYSTEM: 'info',
};

export default function NotificationsScreen() {
  const q = useNotifications();
  const qc = useQueryClient();

  useEffect(() => {
    if (q.data?.unread) {
      notificationApi
        .readAll()
        .then(() => qc.invalidateQueries({ queryKey: qk.notifications }))
        .catch(() => undefined);
    }
  }, [q.data?.unread, qc]);

  return (
    <Screen wallpaper="notifications" header={<Header title="Notifications" />} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading />
      ) : q.data?.items.length ? (
        q.data.items.map((n) => (
          <Card key={n.id} style={styles.card}>
            <View>
              <DalaIcon name={TYPE_ICON[n.type] ?? 'notifications'} size={36} />
              {!n.isRead ? <View style={styles.dot} accessibilityLabel="Non lue" /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText weight="bold">{n.title}</AppText>
              <AppText variant="caption" color={COLORS.darkGray}>{n.body}</AppText>
              <AppText variant="small" color={TEXT_ON_WHITE.muted}>{formatRelative(n.createdAt)}</AppText>
            </View>
          </Card>
        ))
      ) : (
        <EmptyState icon={<DalaIcon name="notifications" size={72} />} title="Aucune notification" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  dot: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: RADIUS.full, backgroundColor: COLORS.red, borderWidth: 2, borderColor: COLORS.white },
});
