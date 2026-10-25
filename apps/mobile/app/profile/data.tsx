import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useQueryClient } from '@tanstack/react-query';
import { DATA_RETENTION_POLICY, RETENTION_YEARS_AFTER_CLOSURE } from '@dala/shared';
import { AppText, Button, Card, DalaIcon, Header, Screen, SectionTitle } from '@/components/ui';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { userApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

/** Droits des utilisateurs : export des données, politique de conservation, clôture du compte. */
export default function MyData() {
  const strongAuth = useStrongAuth();
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const exportData = async () => {
    setExporting(true);
    setMsg(undefined);
    try {
      const data = JSON.stringify(await userApi.exportData(), null, 2);
      const name = `dala-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const target = `${FileSystem.cacheDirectory}${name}`;
        await FileSystem.writeAsStringAsync(target, data);
        await Sharing.shareAsync(target, { mimeType: 'application/json', dialogTitle: 'Mes données DALA' });
      }
      setMsg({ ok: true, text: 'Export prêt.' });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  };

  const close = async () => {
    setClosing(true);
    setMsg(undefined);
    try {
      const done = await strongAuth((pin) => userApi.close(pin!), { always: true, title: 'Clôturer mon compte' });
      if (!done) return;
      await logout();
      qc.clear();
      router.replace('/(auth)/login');
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setClosing(false);
    }
  };

  const confirmClose = () => {
    const text = `Votre accès sera fermé. Vos données seront conservées ${RETENTION_YEARS_AFTER_CLOSURE} ans, comme l'exige la réglementation, puis anonymisées.`;
    if (Platform.OS === 'web') {
      if (window.confirm(text)) void close();
      return;
    }
    Alert.alert('Clôturer mon compte ?', text, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Clôturer', style: 'destructive', onPress: () => void close() },
    ]);
  };

  return (
    <Screen wallpaper="profile" header={<Header title="Mes données" />}>
      <Card style={{ gap: SPACING.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <DalaIcon name="details" size={32} />
          <AppText weight="bold">Exporter mes données</AppText>
        </View>
        <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
          Profil, comptes, opérations, épargne, prêts, notifications et échanges avec le support, dans un fichier lisible (JSON).
        </AppText>
        <Button title="Télécharger mes données" variant="secondary" loading={exporting} onPress={exportData} />
      </Card>

      <SectionTitle title="Conservation des données" icon="security" />
      <Card style={{ gap: SPACING.xs }}>
        {DATA_RETENTION_POLICY.map((line) => (
          <AppText key={line} variant="caption" color={COLORS.darkGray}>
            • {line}
          </AppText>
        ))}
        <AppText variant="caption" color={COLORS.darkGray}>
          • Pour faire rectifier une information, écrivez au support (Profil › Support / FAQ).
        </AppText>
      </Card>

      <SectionTitle title="Clôturer mon compte" icon="close" />
      <Card style={{ gap: SPACING.sm }}>
        <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
          Retirez d'abord vos fonds et remboursez un éventuel prêt. Une tontine en cours doit être terminée. Le code PIN vous sera demandé.
        </AppText>
        <Button title="Clôturer mon compte" variant="outline" loading={closing} onPress={confirmClose} />
      </Card>
      {msg ? (
        <AppText color={msg.ok ? TEXT_ON_WHITE.green : TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>
          {msg.text}
        </AppText>
      ) : null}
    </Screen>
  );
}
