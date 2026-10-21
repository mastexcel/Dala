import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { BellSimple } from 'phosphor-react-native';
import { formatRelative } from '@dala/shared';
import { AppText, Card, EmptyState, Header, Loading, Screen } from '@/components/ui';
import { qk, useNotifications } from '@/hooks/queries';
import { notificationApi } from '@/services/api';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

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
    <Screen header={<Header title="Notifications" />} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading />
      ) : q.data?.items.length ? (
        q.data.items.map((n) => (
          <Card key={n.id} style={styles.card}>
            {!n.isRead ? <View style={styles.dot} accessibilityLabel="Non lue" /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <AppText weight="bold">{n.title}</AppText>
              <AppText variant="caption" color={COLORS.darkGray}>{n.body}</AppText>
              <AppText variant="small" color={TEXT_ON_WHITE.muted}>{formatRelative(n.createdAt)}</AppText>
            </View>
          </Card>
        ))
      ) : (
        <EmptyState icon={<BellSimple size={48} color={COLORS.gold} weight="duotone" />} title="Aucune notification" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  dot: { width: 10, height: 10, borderRadius: RADIUS.full, backgroundColor: COLORS.gold, marginTop: 6 },
});
