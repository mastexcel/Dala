import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { TRUSTY, UEMOA_COUNTRIES, formatFCFA, toE164, type EscrowRole } from '@dala/shared';
import { AppText, Button, Card, Chip, Header, Input, KeyValue, PhoneInput, Screen, type Country } from '@/components/ui';
import { trustyApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const inspectionLabel = (h: number) => (h < 168 ? `${h} h` : '7 jours');

/** Proposer une transaction sécurisée à un autre utilisateur DALA. */
export default function NewEscrow() {
  const qc = useQueryClient();
  const [role, setRole] = useState<EscrowRole>('BUYER');
  const [country, setCountry] = useState<Country>(UEMOA_COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [deliveryDays, setDeliveryDays] = useState<number>(TRUSTY.defaultDeliveryDays);
  const [inspectionHours, setInspectionHours] = useState<number>(TRUSTY.defaultInspectionHours);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const value = Number(amount) || 0;
  const tooHigh = value > TRUSTY.maxAmount;
  const valid = value >= TRUSTY.minAmount && !tooHigh && title.trim().length >= 3 && phone.replace(/\D/g, '').length >= 8;

  const submit = async () => {
    setSending(true);
    setError(undefined);
    try {
      const e = await trustyApi.create({
        role,
        counterpartyPhone: toE164(country.dialCode, phone),
        title: title.trim(),
        description: description.trim() || undefined,
        amount: value,
        deliveryDays,
        inspectionHours,
      });
      track('trusty_proposed', { role, amount: amountBucket(value) });
      void qc.invalidateQueries({ queryKey: ['trusty'] });
      router.replace(`/trusty/${e.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      wallpaper="portfolio"
      header={<Header title="Nouvelle transaction" />}
      footer={<Button title="Envoyer la proposition" disabled={!valid} loading={sending} onPress={submit} />}
    >
      <AppText variant="caption" weight="semibold" color={COLORS.darkGray} style={{ marginBottom: SPACING.xs }}>Dans cette transaction…</AppText>
      <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
        <Chip label="J'achète" active={role === 'BUYER'} onPress={() => setRole('BUYER')} />
        <Chip label="Je vends" active={role === 'SELLER'} onPress={() => setRole('SELLER')} />
      </View>

      <PhoneInput
        label={role === 'BUYER' ? 'Numéro DALA du vendeur' : "Numéro DALA de l'acheteur"}
        country={country}
        onCountryChange={setCountry}
        value={phone}
        onChangeText={setPhone}
      />
      <Input label="Objet de la transaction" value={title} onChangeText={setTitle} maxLength={80} placeholder="Ex. : téléphone Tecno Spark 20, réparation de toiture…" />
      <Input label="Détails convenus (facultatif)" value={description} onChangeText={setDescription} maxLength={1_000} multiline placeholder="État, quantité, lieu de livraison, travaux prévus…" />
      <Input
        label="Montant"
        keyboardType="number-pad"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
        suffix={<AppText weight="semibold">FCFA</AppText>}
        error={tooHigh ? `Maximum ${formatFCFA(TRUSTY.maxAmount)} pendant la phase de test` : undefined}
      />

      <AppText variant="caption" weight="semibold" color={COLORS.darkGray} style={{ marginBottom: SPACING.xs }}>Délai de livraison après le blocage des fonds</AppText>
      <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.md }}>
        {TRUSTY.deliveryDaysOptions.map((d) => (
          <Chip key={d} label={`${d} j`} active={deliveryDays === d} onPress={() => setDeliveryDays(d)} />
        ))}
      </View>
      <AppText variant="caption" weight="semibold" color={COLORS.darkGray} style={{ marginBottom: SPACING.xs }}>Délai de vérification après la livraison</AppText>
      <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.md }}>
        {TRUSTY.inspectionHoursOptions.map((h) => (
          <Chip key={h} label={inspectionLabel(h)} active={inspectionHours === h} onPress={() => setInspectionHours(h)} />
        ))}
      </View>

      <Card style={{ gap: SPACING.xs }}>
        <KeyValue label="Montant bloqué par l'acheteur" value={formatFCFA(value)} strong />
        <KeyValue label="Frais Trusty" value="0 FCFA (phase de test)" />
        <KeyValue label="Versé au vendeur" value={formatFCFA(value)} />
        <AppText variant="small" color={TEXT_ON_WHITE.muted} style={{ marginTop: SPACING.xs }}>
          Rien n'est débité maintenant. {role === 'BUYER' ? 'Vous bloquerez les fonds' : "L'acheteur bloquera les fonds"} une fois les conditions acceptées. Sans livraison sous {deliveryDays} j, l'acheteur peut récupérer son argent ; après la livraison, il a {inspectionLabel(inspectionHours)} pour signaler un problème.
        </AppText>
      </Card>
      {error ? <AppText color={TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{error}</AppText> : null}
    </Screen>
  );
}
