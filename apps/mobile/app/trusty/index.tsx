import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ESCROW_CLOSED, TRUSTY, formatFCFA } from '@dala/shared';
import { AppText, Badge, Button, Card, DalaIcon, Header, LegalNotice, Loading, Screen, SectionTitle } from '@/components/ui';
import { escrowStatus } from '@/components/trusty/meta';
import { trustyApi } from '@/services/api';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const HOW = [
  ['1', 'Vous vous mettez d’accord', "L'acheteur ou le vendeur propose l'objet, le prix et les délais ; l'autre accepte."],
  ['2', "L'acheteur bloque l'argent", 'Les fonds sont mis de côté chez DALA. Le vendeur voit qu’ils sont sécurisés avant de livrer.'],
  ['3', 'Le vendeur livre', "En main propre, l'acheteur lui donne son code de remise. À distance, l'acheteur a un délai pour vérifier."],
  ['4', 'DALA paie le vendeur', 'Dès la confirmation. En cas de problème, un médiateur DALA tranche ; sans livraison, l’acheteur est remboursé.'],
] as const;

/** Trusty : transactions sécurisées par séquestre. */
export default function TrustyHome() {
  const list = useQuery({ queryKey: ['trusty'], queryFn: trustyApi.list, refetchInterval: 10_000 });
  const open = list.data?.filter((e) => !ESCROW_CLOSED.includes(e.status)) ?? [];
  const closed = list.data?.filter((e) => ESCROW_CLOSED.includes(e.status)) ?? [];

  const item = (e: NonNullable<typeof list.data>[number]) => {
    const st = escrowStatus(e.status);
    return (
      <Pressable key={e.id} onPress={() => router.push(`/trusty/${e.id}`)} accessibilityRole="button" accessibilityLabel={`${e.title}, ${formatFCFA(e.amount)}, ${st.label}`}>
        <Card style={{ gap: 4, marginBottom: SPACING.sm }}>
          <View style={styles.row}>
            <AppText weight="bold" style={{ flex: 1 }} numberOfLines={1}>{e.title}</AppText>
            <AppText weight="bold">{formatFCFA(e.amount)}</AppText>
          </View>
          <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
            {e.role === 'BUYER' ? `Achat auprès de ${e.counterparty.name}` : `Vente à ${e.counterparty.name}`}
          </AppText>
          <Badge label={st.label} color={st.color} />
        </Card>
      </Pressable>
    );
  };

  return (
    <Screen wallpaper="portfolio" header={<Header title="Trusty" />} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <Card style={{ gap: SPACING.sm }}>
        <View style={styles.row}>
          <DalaIcon name="security" size={44} />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">Achetez et vendez sans risque</AppText>
            <AppText variant="caption" color={TEXT_ON_WHITE.muted}>
              DALA garde l'argent de l'acheteur et ne le verse au vendeur qu'une fois le bien livré ou le service rendu.
            </AppText>
          </View>
        </View>
        <Button title="Nouvelle transaction sécurisée" onPress={() => router.push('/trusty/new')} />
      </Card>

      {list.isLoading ? <Loading /> : null}
      {open.length ? (
        <>
          <SectionTitle title="En cours" />
          {open.map(item)}
        </>
      ) : null}

      <SectionTitle title="Comment ça marche" />
      <Card style={{ gap: SPACING.md }}>
        {HOW.map(([n, title, body]) => (
          <View key={n} style={[styles.row, { alignItems: 'flex-start' }]}>
            <View style={styles.step}><AppText weight="bold" color={COLORS.navy}>{n}</AppText></View>
            <View style={{ flex: 1 }}>
              <AppText weight="semibold">{title}</AppText>
              <AppText variant="caption" color={TEXT_ON_WHITE.muted}>{body}</AppText>
            </View>
          </View>
        ))}
        <AppText variant="small" color={COLORS.darkGray}>
          Gratuit pendant la phase de test · jusqu'à {formatFCFA(TRUSTY.maxAmount)} par transaction · KYC niveau 2 pour les deux participants.
        </AppText>
      </Card>

      {closed.length ? (
        <>
          <SectionTitle title="Terminées" />
          {closed.map(item)}
        </>
      ) : null}
      <LegalNotice text="Les fonds bloqués sont conservés sur un compte de cantonnement de l'établissement partenaire agréé jusqu'au dénouement de la transaction." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  step: { width: 30, height: 30, borderRadius: 15, backgroundColor: `${COLORS.gold}33`, alignItems: 'center', justifyContent: 'center' },
});
