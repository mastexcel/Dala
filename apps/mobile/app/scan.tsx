import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { CI_MOBILE_MONEY, formatFCFA, parseScannedCode, type ScannedCode } from '@dala/shared';
import { AppText, Button, Card, DalaIcon, Header, Input, KeyValue, LegalNotice, Screen } from '@/components/ui';
import { useFinancialMutation } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { paymentRequestApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { isProviderEnabled } from '@/utils/features';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

const operatorName = (id: string | null | undefined) => CI_MOBILE_MONEY.find((o) => o.id === id)?.name;

/** Ouvre l'envoi d'argent pré-rempli (vers un compte DALA ou vers un mobile money). */
function openSend(dest: 'dala' | 'mobile', phone: string, amount?: number, operator?: string | null) {
  router.push({
    pathname: '/wallet',
    params: { mode: 'send', dest, to: phone, ...(amount ? { amount: String(amount) } : {}), ...(operator ? { operator } : {}) },
  });
}

/**
 * Scanner : QR DALA, demandes de paiement DALA, QR « EMVCo » des paiements interopérables,
 * numéros de téléphone et liens des opérateurs mobile money.
 */
export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [result, setResult] = useState<ScannedCode>();
  const [request, setRequest] = useState<Awaited<ReturnType<typeof paymentRequestApi.info>>>();
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string>();
  const strongAuth = useStrongAuth();
  const pay = useFinancialMutation((pin?: string) => paymentRequestApi.payWithBalance(request!.code, request!.amount, pin));

  const handle = async (data: string) => {
    if (result) return;
    setError(undefined);
    const code = parseScannedCode(data);
    // Codes qui mènent directement à un écran d'envoi pré-rempli.
    if (code.kind === 'dala-transfer') return openSend('dala', code.phone, code.amount);
    if (code.kind === 'phone') return openSend('mobile', code.phone, code.amount, code.operator);
    setResult(code);
    if (code.kind === 'dala-request') {
      try {
        setRequest(await paymentRequestApi.info(code.code));
      } catch (e) {
        setError(errorMessage(e));
      }
    }
  };

  const reset = () => {
    setResult(undefined);
    setRequest(undefined);
    setPaid(false);
    setError(undefined);
  };

  const payRequest = async () => {
    setError(undefined);
    try {
      if (await strongAuth((pin) => pay.mutateAsync(pin), { amount: request!.amount })) setPaid(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const canUseCamera = Platform.OS !== 'web';

  return (
    <Screen wallpaper="portfolio" header={<Header title="Scanner un QR code" />}>
      {!result ? (
        <>
          {canUseCamera && permission?.granted ? (
            <View style={styles.camera}>
              <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => void handle(data)} />
              <View style={styles.frame} />
            </View>
          ) : canUseCamera ? (
            <Card style={{ gap: SPACING.md, alignItems: 'center' }}>
              <DalaIcon name="scan" size={96} />
              <AppText align="center">Autorisez l'appareil photo pour scanner un QR code de paiement.</AppText>
              <Button title="Autoriser l'appareil photo" onPress={() => void requestPermission()} />
            </Card>
          ) : null}
          <Card style={{ marginTop: SPACING.md, gap: SPACING.xs }}>
            <AppText weight="bold">Codes reconnus</AppText>
            {[
              'QR DALA d’un proche ou d’un commerçant',
              'Lien ou QR de demande de paiement DALA : payez avec votre solde',
              'QR de paiement interopérable (format EMVCo, BCEAO / UEMOA)',
              'QR contenant un numéro (contact, tel:) : envoi vers Orange Money, MTN MoMo ou Moov Money',
              'Liens Wave, Orange Money, MTN MoMo et Moov Money',
            ].map((t) => (
              <AppText key={t} variant="caption" color={COLORS.darkGray}>• {t}</AppText>
            ))}
          </Card>
          <Input label="Ou collez le contenu du QR code / le lien" value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} style={{ marginTop: SPACING.md }} />
          <Button title="Analyser" variant="outline" disabled={!manual.trim()} onPress={() => void handle(manual)} />
        </>
      ) : result.kind === 'dala-request' ? (
        <Card style={{ gap: SPACING.sm }}>
          {paid ? (
            <View style={{ alignItems: 'center', gap: SPACING.sm }}>
              <DalaIcon name="success" size={80} />
              <AppText variant="h3" weight="bold" align="center">Paiement effectué</AppText>
              <AppText align="center" color={TEXT_ON_WHITE.muted}>{formatFCFA(request!.amount)} payés à {request!.beneficiary}.</AppText>
              <Button title="Retour à l'accueil" onPress={() => router.replace('/(tabs)')} />
            </View>
          ) : request ? (
            <>
              <AppText weight="bold">Demande de paiement DALA</AppText>
              <KeyValue label="Bénéficiaire" value={request.beneficiary} />
              <KeyValue label="Montant" value={formatFCFA(request.amount)} strong />
              {request.note ? <KeyValue label="Motif" value={request.note} /> : null}
              {request.status === 'OPEN' ? (
                <Button title={`Payer ${formatFCFA(request.amount)} avec mon solde`} loading={pay.isPending} onPress={payRequest} />
              ) : (
                <AppText color={TEXT_ON_WHITE.red}>{request.status === 'PAID' ? 'Cette demande a déjà été payée.' : 'Cette demande n’est plus active.'}</AppText>
              )}
            </>
          ) : !error ? (
            <AppText>Chargement de la demande…</AppText>
          ) : null}
        </Card>
      ) : result.kind === 'emv' ? (
        <Card style={{ gap: SPACING.sm }}>
          <AppText weight="bold">QR de paiement {result.networks.length ? `(${result.networks.join(', ')})` : ''}</AppText>
          {result.merchantName ? <KeyValue label="Commerçant" value={result.merchantName} /> : null}
          {result.city ? <KeyValue label="Ville" value={result.city} /> : null}
          {result.amount ? <KeyValue label="Montant" value={result.currency === '952' ? formatFCFA(result.amount) : String(result.amount)} strong /> : null}
          {!result.crcValid ? <AppText color={TEXT_ON_WHITE.red}>Attention : ce QR code semble altéré (contrôle d'intégrité invalide). Ne payez pas.</AppText> : null}
          {result.phone && result.crcValid && (!result.operator || isProviderEnabled(result.operator)) ? (
            <Button
              title={`Envoyer${result.amount ? ` ${formatFCFA(result.amount)}` : ''} au ${result.phone}`}
              onPress={() => openSend('mobile', result.phone!, result.amount, result.operator)}
            />
          ) : (
            <AppText variant="caption" color={COLORS.darkGray}>
              Ce QR code identifie le commerçant auprès de son opérateur{operatorName(result.operator) ? ` (${operatorName(result.operator)})` : ''}. Le paiement direct de ce type de QR depuis DALA sera possible une fois DALA relié au système de paiement instantané interopérable de la BCEAO ou aux services marchands des opérateurs. En attendant, demandez au commerçant son numéro mobile money ou son QR DALA.
            </AppText>
          )}
        </Card>
      ) : result.kind === 'operator-link' ? (
        <Card style={{ gap: SPACING.sm }}>
          <AppText weight="bold">Lien {operatorName(result.operator)}</AppText>
          <AppText variant="caption" color={COLORS.darkGray}>
            {isProviderEnabled(result.operator)
              ? `Ce lien est un paiement ${operatorName(result.operator)} : il s'ouvre dans l'application de l'opérateur. Pour payer depuis DALA, demandez le numéro mobile money du bénéficiaire.`
              : `${operatorName(result.operator)} n'est pas encore disponible dans DALA pendant la phase de test. Vous pouvez ouvrir ce lien dans l'application ${operatorName(result.operator)}.`}
          </AppText>
          <Button title={`Ouvrir dans ${operatorName(result.operator)}`} variant="outline" onPress={() => void Linking.openURL(result.url)} />
        </Card>
      ) : result.kind === 'unknown' ? (
        <Card style={{ gap: SPACING.sm }}>
          <AppText weight="bold">QR code non reconnu</AppText>
          <AppText variant="caption" color={COLORS.darkGray} numberOfLines={4}>{result.raw}</AppText>
          <AppText variant="caption" color={TEXT_ON_WHITE.muted}>Ce code ne contient ni paiement ni numéro de téléphone exploitable.</AppText>
        </Card>
      ) : null}

      {result ? <Button title="Scanner un autre code" variant="ghost" onPress={reset} style={{ marginTop: SPACING.md }} /> : null}
      {error ? <AppText color={TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{error}</AppText> : null}
      <LegalNotice />
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { height: 320, borderRadius: RADIUS.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 200, height: 200, borderWidth: 3, borderColor: COLORS.gold, borderRadius: RADIUS.lg },
});
