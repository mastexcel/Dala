import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ADVISOR_HOURS, ADVISOR_TOPICS, type AdvisorTopic } from '@dala/shared';
import { AppText, Badge, Button, Card, Chip, DalaIcon, EmptyState, Header, Input, Loading, Screen, SectionTitle } from '@/components/ui';
import { qk, useAdvisorConversations } from '@/hooks/queries';
import { advisorApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { track } from '@/services/monitoring';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const TOPIC_KEYS = Object.keys(ADVISOR_TOPICS) as AdvisorTopic[];

const when = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/** Liste des échanges avec l'équipe commerciale et ouverture d'une nouvelle demande. */
export default function AdvisorInbox() {
  const conversations = useAdvisorConversations();
  const qc = useQueryClient();
  const [topic, setTopic] = useState<AdvisorTopic>('INVEST');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const start = async () => {
    setSending(true);
    setError(undefined);
    try {
      const c = await advisorApi.start(topic, message.trim());
      setMessage('');
      track('advisor_contacted', { topic });
      qc.setQueryData(qk.conversation(c.id), c);
      void qc.invalidateQueries({ queryKey: qk.advisor });
      router.push(`/advisor/${c.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen wallpaper="profile" header={<Header title="Équipe commerciale" />} refreshing={conversations.isRefetching} onRefresh={() => void conversations.refetch()}>
      <Card style={{ gap: SPACING.sm }}>
        <View style={styles.row}>
          <DalaIcon name="investors" size={40} />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">Parlez à un conseiller DALA</AppText>
            <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
              Placements, crowdfunding, épargne, crédit ou levée de fonds : nos conseillers vous répondent {ADVISOR_HOURS}.
            </AppText>
          </View>
        </View>
        <AppText variant="caption" weight="semibold" color={COLORS.darkGray}>
          Sujet
        </AppText>
        <View style={styles.chips}>
          {TOPIC_KEYS.map((k) => (
            <Chip key={k} label={ADVISOR_TOPICS[k]} active={topic === k} onPress={() => setTopic(k)} />
          ))}
        </View>
        <Input label="Votre message" value={message} onChangeText={setMessage} multiline maxLength={4000} placeholder="Bonjour, je souhaite…" style={{ minHeight: 90, textAlignVertical: 'top' }} />
        <Button title="Envoyer à l'équipe" variant="secondary" disabled={message.trim().length < 2} loading={sending} onPress={start} />
        {error ? <AppText color={TEXT_ON_WHITE.red}>{error}</AppText> : null}
      </Card>

      <SectionTitle title="Mes échanges" icon="news" />
      {conversations.isLoading ? (
        <Loading />
      ) : !conversations.data?.length ? (
        <EmptyState icon={<DalaIcon name="news" size={48} />} title="Aucun échange" body="Vos conversations avec l'équipe commerciale apparaîtront ici." />
      ) : (
        <Card padded={false}>
          {conversations.data.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/advisor/${c.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${c.subject}${c.unread ? `, ${c.unread} non lu` : ''}`}
              style={({ pressed }) => [styles.item, i < conversations.data.length - 1 && styles.border, pressed && { backgroundColor: COLORS.offWhite }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.row}>
                  <AppText weight="bold" style={{ flex: 1 }} numberOfLines={1}>
                    {c.subject}
                  </AppText>
                  <AppText variant="small" color={TEXT_ON_WHITE.muted}>
                    {when(c.lastMessageAt)}
                  </AppText>
                </View>
                <AppText variant="caption" color={TEXT_ON_WHITE.muted} numberOfLines={2}>
                  {c.lastMessage}
                </AppText>
                <View style={[styles.row, { gap: SPACING.xs }]}>
                  {c.status === 'CLOSED' ? <Badge label="Clôturée" color={COLORS.darkGray} background={COLORS.lightGray} /> : null}
                  {c.advisorName ? (
                    <AppText variant="small" color={TEXT_ON_WHITE.blue} numberOfLines={1} style={{ flex: 1 }}>
                      {c.advisorName}
                    </AppText>
                  ) : null}
                </View>
              </View>
              {c.unread ? <Badge label={String(c.unread)} color={COLORS.navy} background={COLORS.gold} /> : null}
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lightGray },
});
