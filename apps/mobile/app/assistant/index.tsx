import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { GearSix, Trash } from 'phosphor-react-native';
import { AI_DISCLAIMER } from '@dala/shared';
import { ChatBubble, ChatComposer, ChatThread } from '@/components/chat';
import { AppText, Button, Card, Chip, DalaIcon, Header, Loading, Logo, Screen } from '@/components/ui';
import { AI_PROVIDERS, askAssistant, type ChatTurn } from '@/services/ai';
import { isAssistantConnected, useAssistantStore } from '@/stores/assistant';
import { track } from '@/services/monitoring';
import { FEATURES } from '@/utils/features';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

const HELP = FEATURES.assistantMode === 'help';

const SUGGESTIONS = HELP
  ? ['Comment déposer de l’argent ?', 'Comment fonctionne une tontine ?', 'Comment demander un prêt ?', 'Comment déposer une réclamation ?']
  : [
      'Analyse le marché des bons du Trésor UEMOA en ce moment',
      'Compare les projets de crowdfunding ouverts sur DALA',
      'Comment répartir 500 000 FCFA sur un an ?',
      'Quelle différence entre un FCP et un Sukuk ?',
    ]

const turn = (role: ChatTurn['role'], content: string, sources?: ChatTurn['sources']): ChatTurn => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  role,
  content,
  createdAt: new Date().toISOString(),
  sources,
});

/** Assistant IA : analyse du marché, opportunités (titres, crowdfunding) et discussion libre. */
export default function Assistant() {
  const store = useAssistantStore();
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void store.hydrate();
  }, []);

  const ask = async (text: string) => {
    setError(undefined);
    store.addTurn(turn('user', text));
    setThinking(true);
    try {
      const { settings, apiKey, turns } = useAssistantStore.getState();
      const reply = await askAssistant(settings, apiKey, turns);
      store.addTurn(turn('assistant', reply.content, reply.sources));
      track('assistant_reply', { provider: settings.provider });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réponse impossible');
    } finally {
      setThinking(false);
    }
  };

  const clear = () => {
    if (Platform.OS === 'web') return store.clearHistory();
    Alert.alert('Effacer la conversation', 'Supprimer l’historique de cet appareil ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: store.clearHistory },
    ]);
  };

  const actions = (
    <View style={styles.actions}>
      {store.turns.length ? (
        <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel="Effacer la conversation" hitSlop={10}>
          <Trash size={22} color={COLORS.navy} />
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.push('/assistant/settings')} accessibilityRole="button" accessibilityLabel="Réglages de l'assistant" hitSlop={10}>
        <GearSix size={24} color={COLORS.navy} />
      </Pressable>
      <Logo variant="colorLight" width={44} />
    </View>
  );

  if (!store.hydrated) {
    return (
      <Screen wallpaper="invest" header={<Header title="Assistant IA" />}>
        <Loading />
      </Screen>
    );
  }

  if (!isAssistantConnected(store)) {
    return (
      <Screen wallpaper="invest" header={<Header title="Assistant IA" />}>
        <Card style={{ gap: SPACING.md, alignItems: 'center' }}>
          <DalaIcon name="performance" size={64} />
          <AppText variant="h3" weight="bold" align="center">
            {HELP ? "Aide à l'utilisation" : 'Votre analyste personnel'}
          </AppText>
          <AppText align="center" color={TEXT_ON_WHITE.muted}>
            {HELP
              ? "Connectez l'IA de votre choix avec votre propre clé d'API pour obtenir de l'aide sur l'utilisation de DALA. Aucune donnée personnelle n'est transmise et l'assistant ne donne pas de conseil financier."
              : "Connectez l'IA de votre choix (Claude, OpenAI ou un fournisseur compatible) avec votre propre clé d'API pour analyser le marché, comparer les titres et les projets de crowdfunding en capital, et discuter de tout ce qui vous intéresse."}
          </AppText>
          <Button title="Connecter une IA" variant="secondary" onPress={() => router.push('/assistant/settings')} />
          <Button title="Parler plutôt à un conseiller" variant="outline" onPress={() => router.push('/advisor')} />
        </Card>
        <AppText variant="small" color={TEXT_ON_WHITE.muted} style={{ marginTop: SPACING.md }}>
          {AI_DISCLAIMER}
        </AppText>
      </Screen>
    );
  }

  const provider = AI_PROVIDERS[store.settings.provider];
  return (
    <Screen wallpaper="invest" scroll={false} header={<Header title="Assistant IA" right={actions} />}>
      <ChatThread
        top={
          <View style={styles.banner}>
            <AppText variant="small" color={TEXT_ON_WHITE.muted}>
              {provider.label} · {store.settings.model}. {AI_DISCLAIMER}
            </AppText>
          </View>
        }
        composer={
          <>
            {error ? (
              <AppText variant="small" color={TEXT_ON_WHITE.red} style={{ marginBottom: SPACING.xs }}>
                {error}
              </AppText>
            ) : null}
            <ChatComposer sending={thinking} onSend={ask} placeholder="Posez votre question…" initialText={prompt} />
          </>
        }
      >
        {!store.turns.length ? (
          <View style={{ gap: SPACING.sm }}>
            <ChatBubble
              mine={false}
              author="Assistant DALA"
              body={
                HELP
                  ? "Bonjour ! Je peux vous expliquer comment utiliser DALA : dépôts, épargne, tontines, crédit, réclamations. Ne partagez jamais votre code PIN ni vos codes OTP."
                  : "Bonjour ! Je peux analyser le marché de l'UEMOA, comparer les titres et les projets de crowdfunding disponibles sur DALA, ou discuter de tout autre sujet. Que souhaitez-vous savoir ?"
              }
            />
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} active={false} onPress={() => void ask(s)} />
              ))}
            </View>
          </View>
        ) : null}
        {store.turns.map((t) => (
          <ChatBubble key={t.id} mine={t.role === 'user'} body={t.content} author={t.role === 'assistant' ? 'Assistant DALA' : null} time={t.createdAt} markdown sources={t.sources} />
        ))}
        {thinking ? (
          <View style={styles.thinking} accessibilityLabel="L'assistant rédige sa réponse">
            <ActivityIndicator color={COLORS.gold} />
            <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
              L'assistant analyse…
            </AppText>
          </View>
        ) : null}
        {store.turns.length >= 2 && !thinking ? (
          <AppText variant="small" weight="semibold" color={TEXT_ON_WHITE.blue} onPress={() => router.push('/advisor')} accessibilityRole="link" style={{ marginTop: SPACING.sm }}>
            Besoin d'un avis personnalisé ? Échanger avec un conseiller DALA →
          </AppText>
        ) : null}
      </ChatThread>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  banner: { padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.9)', marginBottom: SPACING.xs },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm },
});
