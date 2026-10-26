import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatFCFA, type EscrowActor, type EscrowDTO } from '@dala/shared';
import { AppText, Badge, Button, Card, DalaIcon, Header, Input, KeyValue, LegalNotice, Loading, Screen, SectionTitle } from '@/components/ui';
import { ESCROW_STEPS, escrowStatus, escrowStep, shortDate } from '@/components/trusty/meta';
import { qk } from '@/hooks/queries';
import { useStrongAuth } from '@/hooks/useStrongAuth';
import { trustyApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

const ACTOR: Record<EscrowActor, string> = { BUYER: 'Acheteur', SELLER: 'Vendeur', SYSTEM: 'DALA', MEDIATOR: 'Médiation DALA' };

/** Suivi d'une transaction Trusty et actions possibles selon l'étape et le rôle. */
export default function EscrowDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const strongAuth = useStrongAuth();
  const q = useQuery({ queryKey: ['trusty', id], queryFn: () => trustyApi.get(id), refetchInterval: 4_000 });
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);

  if (!q.data) return <Screen header={<Header title="Trusty" />}>{q.error ? <AppText color={TEXT_ON_WHITE.red}>{errorMessage(q.error)}</AppText> : <Loading />}</Screen>;
  const e = q.data;
  const can = (a: EscrowDTO['actions'][number]) => e.actions.includes(a);
  const buyer = e.role === 'BUYER';
  const st = escrowStatus(e.status);
  const step = escrowStep(e.status);

  /** Exécute une action puis rafraîchit la transaction, la liste et les soldes. */
  const act = async (name: string, run: () => Promise<EscrowDTO | null>) => {
    setBusy(name);
    setError(undefined);
    try {
      const updated = await run();
      if (updated) qc.setQueryData(['trusty', id], updated);
      void qc.invalidateQueries({ queryKey: ['trusty'] });
      void qc.invalidateQueries({ queryKey: qk.summary });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      return updated;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setBusy(undefined);
    }
  };

  const fund = () => strongAuth((pin) => trustyApi.fund(e.id, e.amount, pin), { amount: e.amount, title: `Bloquer ${formatFCFA(e.amount)}` });

  return (
    <Screen wallpaper="portfolio" header={<Header title="Transaction sécurisée" />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Card style={{ gap: SPACING.xs }}>
        <AppText variant="h3" weight="bold">{e.title}</AppText>
        <AppText variant="h2" weight="bold" color={COLORS.navy}>{formatFCFA(e.amount)}</AppText>
        <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
          {buyer ? 'Vous achetez à' : 'Vous vendez à'} {e.counterparty.name} · {e.counterparty.phone}
        </AppText>
        <AppText variant="small" color={TEXT_ON_WHITE.green}>
          {e.counterparty.completedDeals
            ? `✓ ${e.counterparty.completedDeals} transaction${e.counterparty.completedDeals > 1 ? 's' : ''} Trusty réussie${e.counterparty.completedDeals > 1 ? 's' : ''}`
            : 'Première transaction Trusty de ce contact'}
        </AppText>
        <Badge label={st.label} color={st.color} />
      </Card>

      {e.status !== 'CANCELLED' ? (
        <View style={styles.steps} accessibilityLabel={`Étape ${Math.min(step + 1, 4)} sur 4`}>
          {ESCROW_STEPS.map((label, i) => (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.dot, i < step ? styles.done : i === step ? styles.current : null]}>
                {i < step ? <AppText variant="small" weight="bold" color={COLORS.white}>✓</AppText> : null}
              </View>
              <AppText variant="small" align="center" color={i <= step ? COLORS.navy : COLORS.darkGray}>{label}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      {/* ------------------------------ Actions ------------------------------ */}
      {e.status === 'PROPOSED' ? (
        <Card style={{ gap: SPACING.sm }}>
          {can('accept') ? (
            <>
              <AppText>{e.counterparty.name} vous propose cette transaction. Vérifiez l'objet, le montant et les délais.</AppText>
              {buyer ? (
                <Button
                  title={`Accepter et bloquer ${formatFCFA(e.amount)}`}
                  loading={busy === 'accept'}
                  onPress={() => void act('accept', async () => { await trustyApi.accept(e.id); return fund(); })}
                />
              ) : (
                <Button title="Accepter les conditions" loading={busy === 'accept'} onPress={() => void act('accept', () => trustyApi.accept(e.id))} />
              )}
            </>
          ) : (
            <AppText>Proposition envoyée. {e.counterparty.name} doit accepter les conditions.</AppText>
          )}
        </Card>
      ) : null}

      {e.status === 'ACCEPTED' ? (
        <Card style={{ gap: SPACING.sm }}>
          {can('fund') ? (
            <>
              <AppText>Conditions acceptées. Bloquez les fonds : le vendeur saura que l'argent est sécurisé et pourra livrer. Il ne sera payé qu'après la livraison.</AppText>
              <Button title={`Bloquer ${formatFCFA(e.amount)}`} loading={busy === 'fund'} onPress={() => void act('fund', fund)} />
            </>
          ) : (
            <AppText>Conditions acceptées. Attendez que l'acheteur bloque les fonds avant de livrer.</AppText>
          )}
        </Card>
      ) : null}

      {buyer && e.releaseCode ? (
        <Card style={{ gap: SPACING.sm, alignItems: 'center' }}>
          <DalaIcon name="security" size={40} />
          <AppText weight="bold">Votre code de remise</AppText>
          <AppText variant="h1" weight="bold" color={COLORS.navy} accessibilityLabel={`Code de remise ${e.releaseCode.split('').join(' ')}`} selectable>
            {e.releaseCode.slice(0, 3)} {e.releaseCode.slice(3)}
          </AppText>
          <AppText variant="caption" align="center" color={TEXT_ON_WHITE.muted}>
            Donnez ce code au vendeur seulement quand vous avez le bien en main et qu'il est conforme. Le code déclenche le paiement. DALA ne vous le demandera jamais.
          </AppText>
        </Card>
      ) : null}

      {buyer && (e.status === 'FUNDED' || e.status === 'DELIVERED') ? (
        <Card style={{ gap: SPACING.sm, marginTop: SPACING.md }}>
          <AppText>
            {e.status === 'DELIVERED'
              ? `Le vendeur a déclaré la livraison${e.deliveryNote ? ` : « ${e.deliveryNote} »` : ''}. Vous avez jusqu'au ${shortDate(e.inspectionEndsAt)} pour confirmer ou signaler un problème ; sans réponse, le vendeur sera payé.`
              : `${formatFCFA(e.amount)} sont bloqués. Livraison attendue avant le ${shortDate(e.deliveryDeadline)}.`}
          </AppText>
          {can('release') ? (
            <Button
              title="J'ai reçu, payer le vendeur"
              loading={busy === 'release'}
              onPress={() => void act('release', () => strongAuth((pin) => trustyApi.release(e.id, pin), { always: true, title: `Verser ${formatFCFA(e.amount)} au vendeur` }))}
            />
          ) : null}
          {can('reclaim') ? (
            <Button title="Délai dépassé : récupérer mes fonds" variant="outline" loading={busy === 'reclaim'} onPress={() => void act('reclaim', () => trustyApi.reclaim(e.id))} />
          ) : null}
          {can('dispute') && !disputing ? <Button title="Signaler un problème" variant="ghost" onPress={() => setDisputing(true)} /> : null}
          {disputing ? (
            <>
              <Input label="Qu'est-ce qui ne va pas ?" value={reason} onChangeText={setReason} multiline maxLength={1_000} placeholder="Bien non conforme, abîmé, non reçu…" />
              <Button
                title="Ouvrir un litige"
                variant="outline"
                disabled={reason.trim().length < 10}
                loading={busy === 'dispute'}
                onPress={() => void act('dispute', () => trustyApi.dispute(e.id, reason.trim())).then((r) => r && setDisputing(false))}
              />
              <AppText variant="small" color={TEXT_ON_WHITE.muted}>Les fonds restent bloqués ; un médiateur DALA examine les échanges et tranche.</AppText>
            </>
          ) : null}
        </Card>
      ) : null}

      {!buyer && (e.status === 'FUNDED' || e.status === 'DELIVERED' || e.status === 'DISPUTED') ? (
        <Card style={{ gap: SPACING.sm }}>
          {e.status !== 'DISPUTED' ? (
            <AppText weight="semibold" color={TEXT_ON_WHITE.green}>🔒 {formatFCFA(e.amount)} sont bloqués chez DALA pour vous. Vous pouvez livrer en toute confiance.</AppText>
          ) : (
            <AppText>L'acheteur a signalé un problème. Expliquez votre position ci-dessous : un médiateur DALA va trancher.</AppText>
          )}
          {can('redeem') ? (
            <>
              <Input label="Code de remise de l'acheteur" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} hint={`Remise en main propre : l'acheteur vous donne son code à 6 chiffres. ${e.codeAttemptsLeft} essai${e.codeAttemptsLeft > 1 ? 's' : ''} restant${e.codeAttemptsLeft > 1 ? 's' : ''}.`} />
              <Button title="Valider le code et être payé" disabled={code.length !== 6} loading={busy === 'redeem'} onPress={() => void act('redeem', () => trustyApi.redeem(e.id, code)).then(() => setCode(''))} />
            </>
          ) : null}
          {can('deliver') ? (
            <>
              <Input label="Livraison à distance (facultatif)" value={note} onChangeText={setNote} maxLength={500} placeholder="Transporteur, numéro de suivi, date de passage…" />
              <Button title="Déclarer la livraison" variant="outline" loading={busy === 'deliver'} onPress={() => void act('deliver', () => trustyApi.deliver(e.id, note.trim() || undefined))} />
            </>
          ) : null}
          {e.status === 'DELIVERED' ? (
            <AppText variant="caption" color={TEXT_ON_WHITE.muted}>Livraison déclarée. Vous serez payé dès que l'acheteur confirme, au plus tard le {shortDate(e.inspectionEndsAt)} sans litige.</AppText>
          ) : null}
          {can('refund') ? (
            confirmRefund ? (
              <Button title={`Confirmer : rendre ${formatFCFA(e.amount)} à l'acheteur`} variant="outline" loading={busy === 'refund'} onPress={() => void act('refund', () => trustyApi.refund(e.id))} />
            ) : (
              <Button title="Rembourser l'acheteur" variant="ghost" onPress={() => setConfirmRefund(true)} />
            )
          ) : null}
        </Card>
      ) : null}

      {buyer && e.status === 'DISPUTED' ? (
        <Card><AppText>Litige en cours : les fonds restent bloqués jusqu'à la décision du médiateur DALA. Ajoutez vos explications ci-dessous.</AppText></Card>
      ) : null}

      {e.status === 'RELEASED' || e.status === 'REFUNDED' ? (
        <Card style={{ gap: SPACING.xs, alignItems: 'center' }}>
          <DalaIcon name="success" size={64} />
          <AppText weight="bold" align="center">
            {e.resolution
              ? `Décision de la médiation : ${formatFCFA(e.resolution.sellerAmount)} au vendeur, ${formatFCFA(e.resolution.buyerAmount)} à l'acheteur`
              : e.status === 'RELEASED'
                ? `${formatFCFA(e.amount)} versés au vendeur`
                : `${formatFCFA(e.amount)} remboursés à l'acheteur`}
          </AppText>
          {e.resolution?.note ? <AppText variant="caption" align="center" color={TEXT_ON_WHITE.muted}>{e.resolution.note}</AppText> : null}
        </Card>
      ) : null}

      {can('cancel') ? (
        <Button title="Annuler la proposition" variant="ghost" loading={busy === 'cancel'} onPress={() => void act('cancel', () => trustyApi.cancel(e.id))} style={{ marginTop: SPACING.sm }} />
      ) : null}
      {error ? <AppText color={TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{error}</AppText> : null}

      {/* ------------------------------ Conditions ------------------------------ */}
      <SectionTitle title="Conditions convenues" />
      <Card style={{ gap: SPACING.xs }}>
        {e.description ? <AppText variant="caption">{e.description}</AppText> : null}
        <KeyValue label="Délai de livraison" value={`${e.deliveryDays} j après le blocage des fonds`} />
        <KeyValue label="Délai de vérification" value={e.inspectionHours < 168 ? `${e.inspectionHours} h après la livraison` : '7 jours après la livraison'} />
        {e.deliveryDeadline ? <KeyValue label="Livraison attendue avant" value={shortDate(e.deliveryDeadline)} /> : null}
        <KeyValue label="Frais Trusty" value="0 FCFA (phase de test)" />
        <KeyValue label="Référence" value={e.code} />
      </Card>

      <SectionTitle title="Journal de la transaction" />
      <Card style={{ gap: SPACING.sm }}>
        {e.events.map((v) => (
          <View key={v.id} style={[styles.event, v.actor === e.role && styles.mine]}>
            <AppText variant="small" weight="bold" color={v.actor === 'MEDIATOR' || v.actor === 'SYSTEM' ? TEXT_ON_WHITE.blue : COLORS.darkGray}>
              {v.actor === e.role ? 'Vous' : ACTOR[v.actor]} · {shortDate(v.createdAt)}
            </AppText>
            <AppText variant="caption">{v.message}</AppText>
          </View>
        ))}
        {can('message') ? (
          <>
            <Input label="Écrire à l'autre participant" value={message} onChangeText={setMessage} maxLength={1_000} multiline placeholder={e.status === 'DISPUTED' ? 'Vos explications et preuves pour le médiateur…' : 'Lieu de rendez-vous, précisions…'} />
            <Button title="Envoyer" variant="outline" disabled={!message.trim()} loading={busy === 'message'} onPress={() => void act('message', () => trustyApi.message(e.id, message.trim())).then((r) => r && setMessage(''))} />
            <AppText variant="small" color={TEXT_ON_WHITE.muted}>Les messages sont conservés et servent de preuve en cas de litige.</AppText>
          </>
        ) : null}
      </Card>
      <LegalNotice text="Les fonds bloqués sont conservés sur un compte de cantonnement de l'établissement partenaire agréé jusqu'au dénouement de la transaction." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: SPACING.md },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.lightGray, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  current: { borderColor: COLORS.gold, borderWidth: 3 },
  event: { padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.lightGray, gap: 2 },
  mine: { backgroundColor: `${COLORS.gold}22` },
});
