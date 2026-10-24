import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CaretRight } from 'phosphor-react-native';
import { KYC_LIMITS, formatFCFA, maskPhone, type KycLevel } from '@dala/shared';
import { AppText, Badge, Card, DalaIcon, Logo, ProgressBar, Screen, type DalaIconName } from '@/components/ui';
import { useMe } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

const ITEMS: { label: string; icon: DalaIconName; href: string }[] = [
  { label: 'Informations personnelles', icon: 'user', href: '/profile/personal' },
  { label: 'Sécurité (PIN, biométrie, 2FA)', icon: 'security', href: '/profile/security' },
  { label: 'Notifications', icon: 'notifications', href: '/profile/notifications' },
  { label: 'Langue', icon: 'settings', href: '/profile/language' },
  { label: 'Parrainage', icon: 'referral', href: '/profile/referral' },
  { label: 'Échanger avec un conseiller', icon: 'investors', href: '/advisor' },
  { label: 'Assistant IA', icon: 'performance', href: '/assistant' },
  { label: 'Support / FAQ', icon: 'info', href: '/profile/support' },
  { label: 'Mentions légales / CGU', icon: 'details', href: '/profile/legal' },
];

const KYC_COLOR: Record<KycLevel, string> = { 1: COLORS.orange, 2: COLORS.blue, 3: COLORS.green };

export default function Profile() {
  const me = useMe();
  const stored = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();
  const user = me.data ?? stored;
  const level = (user?.kycLevel ?? 1) as KycLevel;
  const limit = KYC_LIMITS[level].monthlyLimit;

  const signOut = () =>
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          await logout();
          qc.clear();
          router.replace('/(auth)/login');
        },
      },
    ]);

  return (
    <Screen wallpaper="profile">
      <Logo variant="colorLight" width={72} style={{ alignSelf: 'flex-end' }} />
      <View style={styles.head}>
        <View style={styles.avatar}>
          <AppText variant="h2" serif color={COLORS.navy}>
            {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
          </AppText>
        </View>
        <AppText variant="h3" weight="bold">
          {user?.firstName} {user?.lastName}
        </AppText>
        <AppText color={TEXT_ON_WHITE.muted}>{user ? maskPhone(user.phone) : ''}</AppText>
      </View>

      <Card onPress={() => router.push('/profile/kyc')} style={{ gap: SPACING.sm }} accessibilityLabel={`Vérification KYC niveau ${level}`}>
        <View style={styles.row}>
          <DalaIcon name="kyc" size={40} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText weight="bold">Vérification d'identité</AppText>
            <Badge label={`Niveau ${level} · ${KYC_LIMITS[level].label}`} color={COLORS.white} background={KYC_COLOR[level]} />
            <AppText variant="small" color={TEXT_ON_WHITE.muted}>
              Plafond : {limit ? `${formatFCFA(limit)} / mois` : 'illimité'}
            </AppText>
          </View>
        </View>
        <ProgressBar value={level / 3} color={KYC_COLOR[level]} label="Progression KYC" />
        {level < 3 ? (
          <AppText variant="small" weight="semibold" color={TEXT_ON_WHITE.blue}>
            Passer au niveau {level + 1} →
          </AppText>
        ) : null}
      </Card>

      <Card padded={false} style={{ marginTop: SPACING.md }}>
        {ITEMS.map(({ label, icon, href }, i) => (
          <Pressable
            key={href}
            onPress={() => router.push(href as never)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.item, i < ITEMS.length - 1 && styles.border, pressed && { backgroundColor: COLORS.offWhite }]}
          >
            <DalaIcon name={icon} size={30} />
            <AppText style={{ flex: 1 }}>{label}</AppText>
            <CaretRight size={16} color={COLORS.midGray} />
          </Pressable>
        ))}
      </Card>

      <Pressable onPress={signOut} accessibilityRole="button" style={[styles.item, { marginTop: SPACING.md, justifyContent: 'center' }]}>
        <DalaIcon name="close" size={28} />
        <AppText weight="bold" color={TEXT_ON_WHITE.red}>
          Déconnexion
        </AppText>
      </Pressable>
      <View style={{ alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md }}>
        <Logo variant="black" width={90} style={{ opacity: 0.6 }} />
        <AppText variant="small" align="center" color={TEXT_ON_WHITE.muted}>
          DALA Finance v0.1.0
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 4, marginBottom: SPACING.lg },
  avatar: { width: 84, height: 84, borderRadius: RADIUS.full, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lightGray },
});
