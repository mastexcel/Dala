import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppText, Button, Header, Input, LegalNotice, Screen } from '@/components/ui';
import { useMe, qk } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { userApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { SPACING, TEXT_ON_WHITE } from '@/theme';

export default function Personal() {
  const me = useMe();
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const strongAuth = useStrongAuth();
  const [firstName, setFirstName] = useState(me.data?.firstName ?? '');
  const [lastName, setLastName] = useState(me.data?.lastName ?? '');
  const [email, setEmail] = useState(me.data?.email ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setMsg(undefined);
    try {
      // Modification des données personnelles : authentification forte obligatoire (Art. 84).
      const u = await strongAuth((pin) => userApi.update({ firstName, lastName, email: email || undefined }, pin!), { always: true, title: 'Confirmer la modification' });
      if (u) {
        setUser(u);
        await qc.invalidateQueries({ queryKey: qk.me });
        setMsg({ ok: true, text: 'Informations mises à jour.' });
      }
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen header={<Header title="Informations personnelles" />} footer={<Button title="Enregistrer" onPress={save} loading={saving} />}>
      <Input label="Prénom" value={firstName} onChangeText={setFirstName} />
      <Input label="Nom" value={lastName} onChangeText={setLastName} />
      <Input label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Téléphone" value={me.data?.phone ?? ''} editable={false} hint="Pour changer de numéro, contactez le support." />
      {msg ? <AppText color={msg.ok ? TEXT_ON_WHITE.green : TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{msg.text}</AppText> : null}
      <LegalNotice text="Vos données sont traitées conformément à la réglementation sur la protection des données personnelles. Vous disposez d'un droit d'accès et de rectification." />
    </Screen>
  );
}
