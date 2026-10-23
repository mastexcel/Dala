import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppText, Card, DalaIcon, Header, Screen } from '@/components/ui';
import { userApi } from '@/services/api';
import { USE_MOCKS } from '@/services/config';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const KEY = 'dala.notificationPrefs';
const PREFS = [
  { key: 'transactions', label: 'Opérations', body: 'Obligatoire : chaque opération est notifiée immédiatement.', locked: true },
  { key: 'savings', label: 'Épargne & tontines', body: 'Prélèvements automatiques, tours de tontine' },
  { key: 'invest', label: 'Investissements', body: 'Nouvelles émissions, échéances, coupons' },
  { key: 'crowdfund', label: 'Crowdfunding', body: 'Nouveaux projets validés, actualités des projets suivis' },
  { key: 'credit', label: 'Crédit', body: 'Rappels d’échéance' },
  { key: 'marketing', label: 'Offres & conseils', body: 'Astuces pour mieux épargner' },
] as const;

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ transactions: true, savings: true, invest: true, crowdfund: true, credit: true, marketing: false });
  const [push, setPush] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setPrefs(JSON.parse(v))).catch(() => undefined);
    Notifications.getPermissionsAsync().then((p) => setPush(p.granted)).catch(() => undefined);
  }, []);

  const toggle = (k: string, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next));
  };

  const enablePush = async () => {
    const p = await Notifications.requestPermissionsAsync();
    setPush(p.granted);
    if (p.granted && !USE_MOCKS) {
      const token = await Notifications.getDevicePushTokenAsync();
      await userApi.setPushToken(String(token.data));
    }
  };

  return (
    <Screen header={<Header title="Notifications" />}>
      <Card style={{ marginBottom: SPACING.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <DalaIcon name="notifications" size={40} />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">Notifications push</AppText>
            <AppText variant="small" color={TEXT_ON_WHITE.muted}>{push ? 'Activées sur cet appareil' : 'Désactivées'}</AppText>
          </View>
          <Switch value={push} onValueChange={(v) => {
              if (v) void enablePush();
            }} trackColor={{ true: COLORS.green }} accessibilityLabel="Notifications push" />
        </View>
      </Card>
      <Card padded={false}>
        {PREFS.map((p) => (
          <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: COLORS.lightGray }}>
            <View style={{ flex: 1 }}>
              <AppText weight="semibold">{p.label}</AppText>
              <AppText variant="small" color={TEXT_ON_WHITE.muted}>{p.body}</AppText>
            </View>
            <Switch value={prefs[p.key]} disabled={'locked' in p} onValueChange={(v) => toggle(p.key, v)} trackColor={{ true: COLORS.green }} accessibilityLabel={p.label} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
