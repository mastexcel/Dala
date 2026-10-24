import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ADVISOR_TOPICS, type AdvisorConversationDetail } from '@dala/shared';
import { ChatBubble, ChatComposer, ChatThread } from '@/components/chat';
import { AppText, ErrorState, Header, Loading, Screen } from '@/components/ui';
import { qk, useAdvisorConversation } from '@/hooks/queries';
import { advisorApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { SPACING, TEXT_ON_WHITE } from '@/theme';

/** Fil de discussion avec un conseiller de l'équipe commerciale. */
export default function AdvisorChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = useAdvisorConversation(id);
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const c = conversation.data;

  const send = async (text: string) => {
    setSending(true);
    setError(undefined);
    try {
      const m = await advisorApi.send(id, text);
      qc.setQueryData<AdvisorConversationDetail>(qk.conversation(id), (old) => (old ? { ...old, status: 'OPEN', messages: [...old.messages, m] } : old));
      void qc.invalidateQueries({ queryKey: qk.advisor });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen wallpaper="profile" scroll={false} header={<Header title={c ? ADVISOR_TOPICS[c.topic] : 'Conversation'} />}>
      {conversation.isLoading ? (
        <Loading />
      ) : !c ? (
        <ErrorState error={conversation.error} onRetry={() => void conversation.refetch()} />
      ) : (
        <ChatThread
          top={
            c.advisorName ? (
              <AppText variant="caption" align="center" color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.xs }}>
                Votre conseiller : {c.advisorName}
              </AppText>
            ) : null
          }
          composer={
            <>
              {error ? <AppText variant="small" color={TEXT_ON_WHITE.red}>{error}</AppText> : null}
              <ChatComposer sending={sending} onSend={send} placeholder={c.status === 'CLOSED' ? 'Écrire pour rouvrir la conversation…' : 'Votre message…'} />
            </>
          }
        >
          {c.messages.map((m) => (
            <ChatBubble key={m.id} mine={m.sender === 'USER'} system={m.sender === 'SYSTEM'} body={m.body} author={m.authorName} time={m.createdAt} />
          ))}
        </ChatThread>
      )}
    </Screen>
  );
}
