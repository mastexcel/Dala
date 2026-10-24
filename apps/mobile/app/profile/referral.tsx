import { Share, View } from 'react-native';
import { ShareNetwork } from 'phosphor-react-native';
import { AppText, Button, Card, DalaIcon, Header, Loading, Screen } from '@/components/ui';
import { useReferrals } from '@/hooks/queries';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

export default function Referral() {
  const q = useReferrals();
  const r = q.data;
  return (
    <Screen wallpaper="profile" header={<Header title="Parrainage" />}>
      <View style={{ alignItems: 'center', gap: SPACING.sm, marginVertical: SPACING.lg }}>
        <DalaIcon name="referral" size={96} />
        <AppText variant="h2" align="center">Invitez vos proches</AppText>
        <AppText align="center" color={TEXT_ON_WHITE.muted}>Partagez DALA avec votre famille, vos amis et votre tontine.</AppText>
      </View>
      {!r ? (
        <Loading />
      ) : (
        <>
          <Card style={{ alignItems: 'center', gap: SPACING.sm }}>
            <AppText variant="caption" color={TEXT_ON_WHITE.muted}>Votre code</AppText>
            <View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm }}>
              <AppText variant="h2" serif color={COLORS.navy} selectable>{r.code}</AppText>
            </View>
            <AppText variant="small" color={TEXT_ON_WHITE.muted} selectable>{r.link}</AppText>
          </Card>
          <Card style={{ marginTop: SPACING.md, alignItems: 'center' }}>
            <AppText variant="h1" serif color={TEXT_ON_WHITE.gold}>{r.count}</AppText>
            <AppText color={TEXT_ON_WHITE.muted}>filleul{r.count > 1 ? 's' : ''} inscrit{r.count > 1 ? 's' : ''}</AppText>
            {r.referees.length ? <AppText variant="small" color={TEXT_ON_WHITE.muted}>{r.referees.map((x) => x.firstName).join(', ')}</AppText> : null}
          </Card>
          <View style={{ marginTop: SPACING.lg }}>
            <Button
              title="Partager mon lien"
              icon={<ShareNetwork size={18} color={COLORS.navy} weight="bold" />}
              onPress={() => void Share.share({ message: `Rejoignez-moi sur DALA Finance pour épargner, investir et financer vos projets. Faire grandir vos ambitions : ${r.link}` })}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
