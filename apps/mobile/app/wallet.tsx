import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import {
  CI_MOBILE_MONEY,
  UEMOA_COUNTRIES,
  detectCiOperator,
  formatFCFA,
  operatorMatchesPhone,
  toE164,
  type PaymentRequestDTO,
} from '@dala/shared';
import { AppText, Badge, Button, Card, Chip, DalaIcon, Header, Input, LegalNotice, PhoneInput, Screen, SegmentedTabs, type Country } from '@/components/ui';
import { accountApi, paymentRequestApi, type MobileMoneyProvider } from '@/services/api';
import { USE_MOCKS } from '@/services/config';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { useFinancialMutation, useMe, useSummary } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { isProviderEnabled } from '@/utils/features';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

type Mode = 'deposit' | 'send' | 'request' | 'withdraw';
type Destination = 'dala' | 'mobile';

/** Opérateurs ouverts (Wave reste fermé tant que son statut n'est pas vérifié). */
const PROVIDERS = CI_MOBILE_MONEY.filter((p) => isProviderEnabled(p.id));

const STATUS_LABEL: Record<PaymentRequestDTO['status'], { label: string; color: string }> = {
  OPEN: { label: 'En attente', color: TEXT_ON_WHITE.blue },
  PENDING: { label: 'Paiement en cours', color: TEXT_ON_WHITE.orange },
  PAID: { label: 'Payée', color: TEXT_ON_WHITE.green },
  CANCELLED: { label: 'Annulée', color: COLORS.darkGray },
  EXPIRED: { label: 'Expirée', color: COLORS.darkGray },
};

/** Choix de l'opérateur, avec rappel du préfixe ivoirien de chacun. */
function ProviderPicker({ value, onChange }: { value: MobileMoneyProvider; onChange: (p: MobileMoneyProvider) => void }) {
  return (
    <View style={styles.providers}>
      {PROVIDERS.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onChange(p.id)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === p.id }}
          aria-checked={value === p.id}
          accessibilityLabel={p.name}
          style={[styles.provider, value === p.id && { borderColor: COLORS.navy }]}
        >
          <View style={[styles.providerDot, { backgroundColor: p.color }]} />
          <View>
            <AppText variant="caption" weight="semibold">{p.name}</AppText>
            {p.prefix ? <AppText variant="small" color={TEXT_ON_WHITE.muted}>Numéros en {p.prefix}</AppText> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export default function Wallet() {
  // Pré-remplissage possible depuis le scanner : /wallet?mode=send&dest=mobile&to=+225…&amount=…&operator=…
  const params = useLocalSearchParams<{ mode?: Mode; dest?: Destination; to?: string; amount?: string; operator?: MobileMoneyProvider }>();
  const prefillCountry = params.to ? UEMOA_COUNTRIES.find((c) => params.to!.startsWith(c.dialCode)) : undefined;
  const [mode, setMode] = useState<Mode>(params.mode && ['deposit', 'send', 'request', 'withdraw'].includes(params.mode) ? params.mode : 'deposit');
  const [destination, setDestination] = useState<Destination>(params.dest === 'dala' ? 'dala' : 'mobile');
  const [provider, setProvider] = useState<MobileMoneyProvider>(params.operator && isProviderEnabled(params.operator) ? params.operator : 'ORANGE_MONEY');
  const [amount, setAmount] = useState(params.amount && /^\d+$/.test(params.amount) ? params.amount : '');
  const [note, setNote] = useState('');
  const [country, setCountry] = useState<Country>(prefillCountry ?? UEMOA_COUNTRIES[0]);
  const [phone, setPhone] = useState(prefillCountry ? params.to!.slice(prefillCountry.dialCode.length) : '');
  /** Affiche mon QR DALA personnel (pour recevoir d'un autre utilisateur DALA). */
  const [showMyQr, setShowMyQr] = useState(false);
  /** Numéro mobile money pour recharger ou retirer (par défaut, celui du compte). */
  const [ownPhone, setOwnPhone] = useState('');
  const [created, setCreated] = useState<PaymentRequestDTO>();
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<string>();
  const summary = useSummary();
  const me = useMe();
  const qc = useQueryClient();
  const strongAuth = useStrongAuth();
  const value = Number(amount) || 0;

  const ci = UEMOA_COUNTRIES[0];
  const recipient = toE164(country.dialCode, phone);
  const ownNumber = ownPhone ? toE164(ci.dialCode, ownPhone) : me.data?.phone;
  const target = mode === 'send' ? recipient : ownNumber;
  // Le préfixe ivoirien indique l'opérateur : on le sélectionne automatiquement.
  useEffect(() => {
    const detected = target ? detectCiOperator(target) : null;
    if (detected && isProviderEnabled(detected)) setProvider(detected);
  }, [target]);
  const mismatch =
    !!target && target.startsWith('+225') && target.replace(/\D/g, '').length === 13 && !operatorMatchesPhone(provider, target)
      ? `Ce numéro n'est pas un numéro ${PROVIDERS.find((p) => p.id === provider)?.name}.`
      : undefined;

  const requests = useQuery({ queryKey: ['payment-requests'], queryFn: paymentRequestApi.list, enabled: mode === 'request', refetchInterval: 10_000 });

  const deposit = useFinancialMutation(() => accountApi.deposit(provider, value, ownPhone ? ownNumber : undefined));
  const withdraw = useFinancialMutation((pin?: string) => accountApi.withdraw(provider, value, pin, ownPhone ? ownNumber : undefined));
  const sendDala = useFinancialMutation((pin?: string) => accountApi.transfer(recipient, value, pin, note || undefined));
  const sendMobile = useFinancialMutation((pin?: string) => accountApi.sendMobileMoney(provider, recipient, value, pin, note || undefined));
  const createRequest = useFinancialMutation(() => paymentRequestApi.create(value, note || undefined), [['payment-requests']]);
  const pending = deposit.isPending || withdraw.isPending || sendDala.isPending || sendMobile.isPending || createRequest.isPending;
  const providerName = PROVIDERS.find((p) => p.id === provider)?.name ?? '';

  const succeed = (message: string) => {
    track('wallet_operation', { mode, provider: mode === 'send' && destination === 'dala' ? 'dala' : provider, amount: amountBucket(value) });
    setDone(message);
  };

  const submit = async () => {
    setError(undefined);
    try {
      if (mode === 'deposit') {
        await deposit.mutateAsync(undefined);
        succeed(`${formatFCFA(value)} déposés depuis ${providerName}.`);
      } else if (mode === 'withdraw') {
        if (await strongAuth((pin) => withdraw.mutateAsync(pin), { amount: value })) succeed(`${formatFCFA(value)} envoyés vers votre compte ${providerName}.`);
      } else if (mode === 'send' && destination === 'mobile') {
        if (await strongAuth((pin) => sendMobile.mutateAsync(pin), { amount: value })) succeed(`${formatFCFA(value)} envoyés vers le ${providerName} du ${recipient}.`);
      } else if (mode === 'send') {
        if (await strongAuth((pin) => sendDala.mutateAsync(pin), { amount: value })) succeed(`${formatFCFA(value)} envoyés.`);
      } else if (mode === 'request') {
        setCreated(await createRequest.mutateAsync(undefined));
        track('wallet_operation', { mode, provider: 'link', amount: amountBucket(value) });
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const shareRequest = (r: PaymentRequestDTO) =>
    void Share.share({
      message: `Bonjour, voici ma demande de paiement de ${formatFCFA(r.amount)}${r.note ? ` (${r.note})` : ''}. Payez avec Orange Money, MTN MoMo ou Moov Money : ${r.url}`,
    });

  /** Mode démo : pas de serveur pour ouvrir le lien, on simule le payeur. */
  const simulatePayment = async (r: PaymentRequestDTO) => {
    await paymentRequestApi.pay(r.code, 'ORANGE_MONEY', '+2250708091011');
    void qc.invalidateQueries({ queryKey: ['payment-requests'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
    setCreated(undefined);
  };

  if (done) {
    return (
      <Screen wallpaper="portfolio" header={<Header title="Opération réussie" />}>
        <View style={{ alignItems: 'center', gap: SPACING.md, marginTop: SPACING.xl }}>
          <DalaIcon name="success" size={100} />
          <AppText variant="h3" weight="bold" align="center">{done}</AppText>
          <AppText color={TEXT_ON_WHITE.muted} align="center">Une notification de confirmation vous a été envoyée.</AppText>
          <Button title="Retour à l'accueil" onPress={() => router.replace('/(tabs)')} />
        </View>
      </Screen>
    );
  }

  const canSubmit =
    value >= 100 &&
    !mismatch &&
    (mode !== 'send' || phone.replace(/\D/g, '').length >= 8) &&
    (mode !== 'request' || !created);

  return (
    <Screen
      wallpaper="portfolio"
      header={<Header title="Portefeuille" />}
      footer={!(mode === 'request' && (created || showMyQr)) ? <Button title={mode === 'request' ? 'Créer le lien de paiement' : 'Valider'} disabled={!canSubmit} loading={pending} onPress={submit} /> : undefined}
    >
      <SegmentedTabs<Mode>
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(undefined);
          setCreated(undefined);
          setShowMyQr(false);
        }}
        tabs={[
          { key: 'deposit', label: 'Recharger', icon: 'deposit' },
          { key: 'send', label: 'Envoyer', icon: 'send' },
          { key: 'request', label: 'Demander', icon: 'receive' },
          { key: 'withdraw', label: 'Retirer', icon: 'withdraw' },
        ]}
      />
      <AppText variant="caption" color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.md }}>
        Solde disponible : {formatFCFA(summary.data?.main ?? 0)}
      </AppText>

      {mode === 'request' && showMyQr && me.data?.phone ? (
        <Card style={{ alignItems: 'center', gap: SPACING.md }}>
          <AppText weight="bold" align="center">Mon QR DALA</AppText>
          <View style={styles.qr} accessibilityLabel="Mon QR code DALA">
            <QRCode value={`dala:pay?to=${encodeURIComponent(me.data.phone)}`} size={200} color={COLORS.navy} backgroundColor={COLORS.white} />
          </View>
          <AppText variant="caption" color={TEXT_ON_WHITE.muted} align="center">
            Un utilisateur DALA scanne ce code pour vous envoyer de l'argent, sans saisir votre numéro. Pour être payé depuis Orange Money, MTN MoMo ou Moov Money, créez plutôt un lien de paiement.
          </AppText>
          <Button title="Créer un lien de paiement" variant="ghost" onPress={() => setShowMyQr(false)} />
        </Card>
      ) : mode === 'request' && created ? (
        <Card style={{ alignItems: 'center', gap: SPACING.md }}>
          <AppText weight="bold" align="center">Demande de {formatFCFA(created.amount)} créée</AppText>
          <View style={styles.qr} accessibilityLabel="QR code de la demande de paiement">
            <QRCode value={created.url} size={200} color={COLORS.navy} backgroundColor={COLORS.white} />
          </View>
          <AppText variant="small" color={TEXT_ON_WHITE.blue} align="center" selectable>
            {created.url}
          </AppText>
          <AppText variant="caption" color={TEXT_ON_WHITE.muted} align="center">
            Envoyez ce lien ou montrez ce QR code : la personne paie depuis son Orange Money, MTN MoMo ou Moov Money, sans compte DALA. L'argent arrive sur votre solde. Valable 72 h.
          </AppText>
          <Button title="Partager le lien" onPress={() => shareRequest(created)} />
          {USE_MOCKS ? <Button title="Simuler le paiement (démo)" variant="outline" onPress={() => void simulatePayment(created)} /> : null}
          <Button title="Nouvelle demande" variant="ghost" onPress={() => setCreated(undefined)} />
        </Card>
      ) : (
        <>
          {mode === 'send' ? (
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: 'wrap' }}>
              <Chip label="Vers un mobile money" active={destination === 'mobile'} onPress={() => setDestination('mobile')} />
              <Chip label="Vers un compte DALA" active={destination === 'dala'} onPress={() => setDestination('dala')} />
              <Chip label="Scanner un QR" active={false} onPress={() => router.push('/scan')} />
            </View>
          ) : null}

          {mode === 'request' ? (
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: 'wrap' }}>
              <Chip label="Lien de paiement" active onPress={() => undefined} />
              <Chip label="Mon QR DALA" active={false} onPress={() => setShowMyQr(true)} />
            </View>
          ) : null}

          {mode === 'send' ? (
            <PhoneInput
              label={destination === 'dala' ? 'Numéro DALA du destinataire' : 'Numéro mobile money du destinataire'}
              country={country}
              onCountryChange={setCountry}
              value={phone}
              onChangeText={setPhone}
            />
          ) : null}

          {mode === 'deposit' || mode === 'withdraw' ? (
            <PhoneInput
              label={mode === 'deposit' ? 'Numéro mobile money à débiter' : 'Numéro mobile money à créditer'}
              country={ci}
              onCountryChange={() => undefined}
              value={ownPhone}
              onChangeText={setOwnPhone}
              placeholder={me.data?.phone ? `${me.data.phone.slice(4)} (mon numéro)` : undefined}
            />
          ) : null}

          {mode !== 'request' && !(mode === 'send' && destination === 'dala') ? (
            <>
              <AppText variant="caption" weight="semibold" color={COLORS.darkGray} style={{ marginBottom: SPACING.xs }}>Opérateur</AppText>
              <ProviderPicker value={provider} onChange={setProvider} />
              {mismatch ? <AppText variant="small" color={TEXT_ON_WHITE.red} style={{ marginBottom: SPACING.sm }}>{mismatch}</AppText> : null}
            </>
          ) : null}

          <Input label="Montant" keyboardType="number-pad" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} suffix={<AppText weight="semibold">FCFA</AppText>} />
          <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' }}>
            {[5_000, 10_000, 25_000, 50_000].map((v) => (
              <Chip key={v} label={formatFCFA(v)} active={value === v} onPress={() => setAmount(String(v))} />
            ))}
          </View>
          {mode === 'send' || mode === 'request' ? (
            <Input label="Motif (facultatif)" value={note} onChangeText={setNote} maxLength={140} style={{ marginTop: SPACING.md }} />
          ) : null}

          <Card style={{ marginTop: SPACING.md }}>
            <AppText variant="caption" color={COLORS.darkGray}>
              {mode === 'deposit'
                ? "Frais DALA : 0 FCFA. Les frais éventuels de votre opérateur s'appliquent. Vous recevrez une demande de confirmation sur votre téléphone."
                : mode === 'withdraw'
                  ? 'Frais DALA : 0 FCFA. Confirmation par PIN au-delà de 50 000 FCFA.'
                  : mode === 'request'
                    ? 'Créez un lien de paiement à partager : votre client, un proche ou un commerçant paie depuis son mobile money, quel que soit son opérateur.'
                    : destination === 'mobile'
                      ? `Envoi vers ${PROVIDERS.map((p) => p.name).join(', ')}. Frais DALA : 0 FCFA. KYC niveau 2 requis, PIN au-delà de 50 000 FCFA.`
                      : 'Transfert gratuit et instantané entre comptes DALA. KYC niveau 2 requis.'}
            </AppText>
          </Card>

          {mode === 'request' && requests.data?.length ? (
            <View style={{ marginTop: SPACING.lg, gap: SPACING.sm }}>
              <AppText weight="bold">Mes demandes</AppText>
              {requests.data.map((r) => (
                <Card key={r.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                    <AppText weight="bold" style={{ flex: 1 }}>{formatFCFA(r.amount)}{r.note ? ` · ${r.note}` : ''}</AppText>
                    <Badge label={STATUS_LABEL[r.status].label} color={STATUS_LABEL[r.status].color} />
                  </View>
                  {r.status === 'OPEN' ? (
                    <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                      <AppText variant="small" weight="bold" color={TEXT_ON_WHITE.blue} onPress={() => setCreated(r)} accessibilityRole="link">Afficher le QR</AppText>
                      <AppText variant="small" weight="bold" color={TEXT_ON_WHITE.blue} onPress={() => shareRequest(r)} accessibilityRole="link">Partager</AppText>
                      <AppText
                        variant="small"
                        weight="bold"
                        color={TEXT_ON_WHITE.red}
                        onPress={() => void paymentRequestApi.cancel(r.id).then(() => qc.invalidateQueries({ queryKey: ['payment-requests'] }))}
                        accessibilityRole="button"
                      >
                        Annuler
                      </AppText>
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}
        </>
      )}
      {error ? <AppText color={TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{error}</AppText> : null}
      <LegalNotice />
    </Screen>
  );
}

const styles = StyleSheet.create({
  providers: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  provider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 2, borderColor: COLORS.lightGray, backgroundColor: COLORS.white, width: '48%' },
  providerDot: { width: 14, height: 14, borderRadius: 7 },
  qr: { padding: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.md },
});
