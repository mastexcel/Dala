import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { UEMOA_COUNTRIES, formatFCFA, toE164 } from '@dala/shared';
import { AppText, Button, Card, Chip, DalaIcon, Header, Input, LegalNotice, PhoneInput, Screen, SegmentedTabs, type Country } from '@/components/ui';
import { accountApi, type MobileMoneyProvider } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { useFinancialMutation, useSummary } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

type Mode = 'deposit' | 'send' | 'withdraw' | 'scan';

const PROVIDERS: { id: MobileMoneyProvider; name: string; color: string }[] = [
  { id: 'ORANGE_MONEY', name: 'Orange Money', color: '#FF7900' },
  { id: 'MTN_MOMO', name: 'MTN MoMo', color: '#FFCB05' },
  { id: 'WAVE', name: 'Wave', color: '#1DC8F1' },
  { id: 'MOOV_MONEY', name: 'Moov Money', color: '#0057A8' },
];

/** QR de paiement DALA : "dala:pay?to=+2250707000000&amount=5000" */
function parseQr(data: string): { phone: string; amount?: number } | null {
  const m = data.match(/^dala:pay\?(.+)$/);
  if (!m) return null;
  const p = new URLSearchParams(m[1]);
  const to = p.get('to');
  return to ? { phone: to, amount: p.get('amount') ? Number(p.get('amount')) : undefined } : null;
}

export default function Wallet() {
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(params.mode ?? 'deposit');
  const [provider, setProvider] = useState<MobileMoneyProvider>('ORANGE_MONEY');
  const [amount, setAmount] = useState('');
  const [country, setCountry] = useState<Country>(UEMOA_COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<string>();
  const [permission, requestPermission] = useCameraPermissions();
  const summary = useSummary();
  const strongAuth = useStrongAuth();
  const value = Number(amount) || 0;

  const deposit = useFinancialMutation(() => accountApi.deposit(provider, value));
  const withdraw = useFinancialMutation((pin?: string) => accountApi.withdraw(provider, value, pin));
  const send = useFinancialMutation((pin?: string) => accountApi.transfer(toE164(country.dialCode, phone), value, pin));
  const pending = deposit.isPending || withdraw.isPending || send.isPending;

  const succeed = (message: string) => {
    track('wallet_operation', { mode, provider: mode === 'send' ? 'dala' : provider, amount: amountBucket(value) });
    setDone(message);
  };

  const submit = async () => {
    setError(undefined);
    try {
      if (mode === 'deposit') {
        await deposit.mutateAsync(undefined);
        succeed(`${formatFCFA(value)} déposés depuis ${PROVIDERS.find((p) => p.id === provider)!.name}.`);
      } else if (mode === 'withdraw') {
        if (await strongAuth((pin) => withdraw.mutateAsync(pin), { amount: value })) succeed(`${formatFCFA(value)} envoyés vers votre wallet.`);
      } else {
        if (await strongAuth((pin) => send.mutateAsync(pin), { amount: value })) succeed(`${formatFCFA(value)} envoyés.`);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
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

  const isMobileMoney = mode === 'deposit' || mode === 'withdraw';

  return (
    <Screen wallpaper="portfolio"
      header={<Header title="Portefeuille" />}
      footer={mode !== 'scan' ? <Button title="Valider" disabled={value < 100 || (mode === 'send' && phone.length < 8)} loading={pending} onPress={submit} /> : undefined}
    >
      <SegmentedTabs<Mode>
        value={mode}
        onChange={setMode}
        tabs={[
          { key: 'deposit', label: 'Recharger', icon: 'deposit' },
          { key: 'send', label: 'Envoyer', icon: 'send' },
          { key: 'withdraw', label: 'Retirer', icon: 'withdraw' },
          { key: 'scan', label: 'Scanner', icon: 'scan' },
        ]}
      />
      <AppText variant="caption" color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.md }}>
        Solde disponible : {formatFCFA(summary.data?.main ?? 0)}
      </AppText>

      {mode === 'scan' ? (
        permission?.granted ? (
          <View style={styles.camera}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                const r = parseQr(data);
                if (!r) return setError('QR code non reconnu');
                const c = UEMOA_COUNTRIES.find((x) => r.phone.startsWith(x.dialCode)) ?? UEMOA_COUNTRIES[0];
                setCountry(c);
                setPhone(r.phone.slice(c.dialCode.length));
                if (r.amount) setAmount(String(r.amount));
                setMode('send');
              }}
            />
            <View style={styles.frame} />
          </View>
        ) : (
          <Card style={{ gap: SPACING.md, alignItems: 'center' }}>
            <DalaIcon name="scan" size={96} />
            <AppText align="center">Scannez le QR code DALA d'un commerçant ou d'un proche pour payer instantanément.</AppText>
            <Button title="Autoriser l'appareil photo" onPress={() => void requestPermission()} />
          </Card>
        )
      ) : (
        <>
          {isMobileMoney ? (
            <>
              <AppText variant="caption" weight="semibold" color={COLORS.darkGray} style={{ marginBottom: SPACING.xs }}>Opérateur</AppText>
              <View style={styles.providers}>
                {PROVIDERS.map((p) => (
                  <Pressable key={p.id} onPress={() => setProvider(p.id)} accessibilityRole="radio" accessibilityState={{ checked: provider === p.id }} style={[styles.provider, provider === p.id && { borderColor: COLORS.navy }]}>
                    <View style={[styles.providerDot, { backgroundColor: p.color }]} />
                    <AppText variant="caption" weight="semibold">{p.name}</AppText>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <PhoneInput label="Numéro DALA du destinataire" country={country} onCountryChange={setCountry} value={phone} onChangeText={setPhone} />
          )}
          <Input label="Montant" keyboardType="number-pad" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} suffix={<AppText weight="semibold">FCFA</AppText>} />
          <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' }}>
            {[5_000, 10_000, 25_000, 50_000].map((v) => (
              <Chip key={v} label={formatFCFA(v)} active={value === v} onPress={() => setAmount(String(v))} />
            ))}
          </View>
          <Card style={{ marginTop: SPACING.md }}>
            <AppText variant="caption" color={COLORS.darkGray}>
              {mode === 'deposit'
                ? "Frais DALA : 0 FCFA. Les frais éventuels de votre opérateur s'appliquent. Vous recevrez une demande de confirmation sur votre téléphone."
                : mode === 'withdraw'
                  ? 'Frais DALA : 0 FCFA. Confirmation par PIN au-delà de 50 000 FCFA.'
                  : 'Transfert gratuit et instantané entre comptes DALA. KYC niveau 2 requis.'}
            </AppText>
          </Card>
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
  camera: { height: 320, borderRadius: RADIUS.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 200, height: 200, borderWidth: 3, borderColor: COLORS.gold, borderRadius: RADIUS.lg },
});
