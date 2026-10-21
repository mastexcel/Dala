import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Fingerprint, LockKey, ShieldCheck } from 'phosphor-react-native';
import { STRONG_AUTH_THRESHOLD, formatFCFA } from '@dala/shared';
import { AppText, Button, Card, Header, Input, KeyValue, LegalNotice, ProgressBar, Screen, SectionTitle } from '@/components/ui';
import { qk, useLimits } from '@/hooks/queries';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { userApi } from '@/services/api';
import { request } from '@/services/client';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

export default function Security() {
  const bio = useBiometrics();
  const { biometricEnabled, setBiometric } = useAuthStore();
  const limits = useLimits();
  const qc = useQueryClient();
  const strongAuth = useStrongAuth();
  const [limit, setLimit] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const toggleBio = async (v: boolean) => {
    if (v && !(await bio.authenticate('Activer la biométrie'))) return;
    await setBiometric(v);
  };

  const saveLimit = async () => {
    setMsg(undefined);
    try {
      const r = await strongAuth((pin) => userApi.setLimit(limit ? Number(limit) : null, pin!), { always: true, title: 'Modifier mon plafond' });
      if (r !== null) {
        await qc.invalidateQueries({ queryKey: qk.limits });
        setMsg({ ok: true, text: 'Plafond mis à jour.' });
      }
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  };

  const changePin = async () => {
    setMsg(undefined);
    try {
      await request('/users/me/pin', { method: 'PUT', body: { currentPin, newPin } });
      setCurrentPin('');
      setNewPin('');
      setMsg({ ok: true, text: 'Code PIN modifié.' });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  };

  const l = limits.data;
  return (
    <Screen header={<Header title="Sécurité" />}>
      <Card style={{ gap: SPACING.sm }}>
        <View style={styles.row}>
          <ShieldCheck size={26} color={COLORS.green} weight="duotone" />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">Double authentification active</AppText>
            <AppText variant="small" color={TEXT_ON_WHITE.muted}>
              Connexion : code SMS + PIN, ou biométrie sur cet appareil. Opérations de plus de {formatFCFA(STRONG_AUTH_THRESHOLD)} : confirmation par PIN.
            </AppText>
          </View>
        </View>
      </Card>

      <SectionTitle title="Biométrie" />
      <Card>
        <View style={styles.row}>
          <Fingerprint size={24} color={COLORS.navy} weight="duotone" />
          <View style={{ flex: 1 }}>
            <AppText weight="semibold">Déverrouiller avec {bio.label}</AppText>
            <AppText variant="small" color={TEXT_ON_WHITE.muted}>
              {bio.available ? 'Votre empreinte ne quitte jamais votre téléphone.' : 'Aucune biométrie configurée sur cet appareil.'}
            </AppText>
          </View>
          <Switch value={biometricEnabled} onValueChange={(v) => void toggleBio(v)} disabled={!bio.available} trackColor={{ true: COLORS.green }} accessibilityLabel="Activer la biométrie" />
        </View>
      </Card>

      <SectionTitle title="Plafonds" />
      <Card style={{ gap: SPACING.sm }}>
        {l ? (
          <>
            <KeyValue label="Plafond réglementaire (KYC)" value={l.regulatoryMonthlyLimit ? `${formatFCFA(l.regulatoryMonthlyLimit)} / mois` : 'Illimité'} />
            <KeyValue label="Utilisé ce mois" value={formatFCFA(l.usedThisMonth)} />
            {l.regulatoryMonthlyLimit ? <ProgressBar value={l.usedThisMonth / l.regulatoryMonthlyLimit} color={COLORS.blue} label="Plafond utilisé" /> : null}
            <KeyValue label="Mon plafond personnel" value={l.customMonthlyLimit ? formatFCFA(l.customMonthlyLimit) : 'Aucun'} />
          </>
        ) : null}
        <Input label="Nouveau plafond personnel" keyboardType="number-pad" value={limit} onChangeText={(t) => setLimit(t.replace(/\D/g, ''))} hint="Laissez vide pour supprimer votre plafond personnel." suffix={<AppText weight="semibold">FCFA</AppText>} />
        <Button title="Enregistrer le plafond" variant="outline" onPress={saveLimit} />
      </Card>

      <SectionTitle title="Code PIN" />
      <Card>
        <Input label="PIN actuel" secureTextEntry keyboardType="number-pad" maxLength={6} value={currentPin} onChangeText={setCurrentPin} />
        <Input label="Nouveau PIN" secureTextEntry keyboardType="number-pad" maxLength={6} value={newPin} onChangeText={setNewPin} />
        <Button title="Changer mon PIN" variant="outline" icon={<LockKey size={18} color={COLORS.navy} />} disabled={currentPin.length < 4 || newPin.length < 4} onPress={changePin} />
      </Card>
      {msg ? <AppText color={msg.ok ? TEXT_ON_WHITE.green : TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{msg.text}</AppText> : null}
      <LegalNotice text="Ne communiquez jamais votre PIN ni vos codes SMS, même à un agent DALA." />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md } });
