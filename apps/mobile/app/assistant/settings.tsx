import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Button, Card, Chip, Header, Input, Screen, SectionTitle } from '@/components/ui';
import { AI_PROVIDERS, verifyConnection, type AiProviderId, type AiSettings } from '@/services/ai';
import { isAssistantConnected, useAssistantStore } from '@/stores/assistant';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';
import { FEATURES } from '@/utils/features';

const PROVIDERS = Object.values(AI_PROVIDERS);

/** Connexion de l'assistant à l'API d'IA choisie par l'utilisateur. */
export default function AssistantSettings() {
  const store = useAssistantStore();
  const connected = isAssistantConnected(store);
  const [draft, setDraft] = useState<AiSettings>(store.settings);
  const [apiKey, setApiKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    void store.hydrate();
  }, []);
  useEffect(() => setDraft(store.settings), [store.hydrated]);

  const preset = AI_PROVIDERS[draft.provider];
  const set = (patch: Partial<AiSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const pickProvider = (provider: AiProviderId) => set({ provider, model: AI_PROVIDERS[provider].models[0]?.id ?? '', baseUrl: provider === 'compatible' ? draft.baseUrl : '' });
  // Une clé déjà enregistrée est conservée si le champ reste vide.
  const key = apiKey.trim() || (draft.provider === store.settings.provider ? store.apiKey : '');
  const canSave = !!draft.model.trim() && (draft.provider === 'compatible' ? !!draft.baseUrl.trim() : !!key);

  const save = async () => {
    setChecking(true);
    setMsg(undefined);
    try {
      await verifyConnection(draft, key);
      await store.connect(key, { ...draft, model: draft.model.trim(), baseUrl: draft.baseUrl.trim() });
      setApiKey('');
      setMsg({ ok: true, text: 'Assistant connecté.' });
      // Retour à l'assistant (et à la question préremplie éventuelle).
      if (router.canGoBack()) router.back();
      else router.replace('/assistant');
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Connexion impossible' });
    } finally {
      setChecking(false);
    }
  };

  const toggle = (patch: Partial<AiSettings>) => {
    set(patch);
    // Les préférences d'un assistant déjà connecté s'appliquent tout de suite.
    if (connected) void store.updateSettings(patch);
  };

  return (
    <Screen wallpaper="profile" header={<Header title="Connecter une IA" />}>
      <Card style={{ gap: SPACING.sm }}>
        <AppText weight="bold">Votre clé, sur votre appareil</AppText>
        <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
          La clé d'API est enregistrée dans le coffre sécurisé de votre téléphone. Elle n'est jamais envoyée aux serveurs DALA : vos questions partent directement de l'application vers le fournisseur choisi, qui vous facture selon son tarif.
        </AppText>
      </Card>

      <SectionTitle title="Fournisseur" icon="settings" />
      <View style={styles.chips}>
        {PROVIDERS.map((p) => (
          <Chip key={p.id} label={p.label} active={draft.provider === p.id} onPress={() => pickProvider(p.id)} />
        ))}
      </View>

      <Card style={{ marginTop: SPACING.md }}>
        {draft.provider === 'compatible' ? (
          <Input
            label="Adresse de l'API"
            value={draft.baseUrl}
            onChangeText={(baseUrl) => set({ baseUrl })}
            placeholder="https://api.mistral.ai/v1"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            hint="Mistral, Groq, OpenRouter, DeepSeek, Ollama… : adresse se terminant par /v1"
          />
        ) : null}
        <Input
          label={connected && draft.provider === store.settings.provider && store.apiKey ? 'Clé API (laisser vide pour garder la clé actuelle)' : 'Clé API'}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={preset.keyPlaceholder}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Clé API"
        />
        {preset.keyUrl ? (
          <AppText variant="small" weight="semibold" color={TEXT_ON_WHITE.blue} onPress={() => void Linking.openURL(preset.keyUrl!)} accessibilityRole="link" style={{ marginBottom: SPACING.md }}>
            Obtenir une clé chez {preset.label} →
          </AppText>
        ) : null}

        <AppText variant="caption" weight="semibold" color={COLORS.darkGray} style={{ marginBottom: SPACING.sm }}>
          Modèle
        </AppText>
        {preset.models.length ? (
          <View style={[styles.chips, { marginBottom: SPACING.sm }]}>
            {preset.models.map((m) => (
              <Chip key={m.id} label={m.label} active={draft.model === m.id} onPress={() => set({ model: m.id })} />
            ))}
          </View>
        ) : null}
        <Input value={draft.model} onChangeText={(model) => set({ model })} placeholder="Nom du modèle" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Nom du modèle" />

        <Button title={connected ? 'Vérifier et enregistrer' : 'Connecter'} variant="secondary" disabled={!canSave} loading={checking} onPress={save} />
        {msg ? (
          <AppText color={msg.ok ? TEXT_ON_WHITE.green : TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>
            {msg.text}
          </AppText>
        ) : null}
      </Card>

      {/* Mode « aide » : aucune donnée personnelle ni recherche web, réglages masqués. */}
      {FEATURES.assistantMode === 'help' ? null : (
        <>
          <SectionTitle title="Confidentialité" icon="security" />
          <Card padded={false}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold">Partager ma situation financière</AppText>
                <AppText variant="small" color={TEXT_ON_WHITE.muted}>
                  Soldes, placements et participations sont joints à vos questions pour des analyses adaptées. Les offres du marché sont toujours partagées.
                </AppText>
              </View>
              <Switch value={draft.shareFinancialData} onValueChange={(v) => toggle({ shareFinancialData: v })} trackColor={{ true: COLORS.green }} accessibilityLabel="Partager ma situation financière" />
            </View>
            {draft.provider === 'anthropic' ? (
              <View style={[styles.switchRow, styles.border]}>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold">Recherche web</AppText>
                  <AppText variant="small" color={TEXT_ON_WHITE.muted}>
                    Claude consulte l'actualité des marchés et cite ses sources.
                  </AppText>
                </View>
                <Switch value={draft.webSearch} onValueChange={(v) => toggle({ webSearch: v })} trackColor={{ true: COLORS.green }} accessibilityLabel="Recherche web" />
              </View>
            ) : null}
          </Card>
        </>
      )}

      {connected ? (
        <Button
          title="Déconnecter l'assistant"
          variant="outline"
          style={{ marginTop: SPACING.lg }}
          onPress={async () => {
            await store.disconnect();
            setDraft(useAssistantStore.getState().settings);
            setMsg({ ok: true, text: 'Clé supprimée de cet appareil.' });
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.lightGray },
});
