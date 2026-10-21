import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CaretRight,
  Gift,
  IdentificationCard,
  Lifebuoy,
  Scroll,
  ShieldCheck,
  SignOut,
  Translate,
  User,
} from 'phosphor-react-native';
import { KYC_LIMITS, formatFCFA, maskPhone, type KycLevel } from '@dala/shared';
import type { ComponentType } from 'react';
import { AppText, Badge, Card, ProgressBar, Screen } from '@/components/ui';
import { useMe } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

type IconT = ComponentType<{ size?: number; color?: string; weight?: 'duotone' }>;

const ITEMS: { label: string; Icon: IconT; href: string }[] = [
  { label: 'Informations personnelles', Icon: User, href: '/profile/personal' },
  { label: 'Sécurité (PIN, biométrie, 2FA)', Icon: ShieldCheck, href: '/profile/security' },
  { label: 'Notifications', Icon: Bell, href: '/profile/notifications' },
  { label: 'Langue', Icon: Translate, href: '/profile/language' },
  { label: 'Parrainage', Icon: Gift, href: '/profile/referral' },
  { label: 'Support / FAQ', Icon: Lifebuoy, href: '/profile/support' },
  { label: 'Mentions légales / CGU', Icon: Scroll, href: '/profile/legal' },
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
    <Screen>
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
          <IdentificationCard size={26} color={KYC_COLOR[level]} weight="duotone" />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">Vérification d'identité</AppText>
            <AppText variant="small" color={TEXT_ON_WHITE.muted}>
              Plafond : {limit ? `${formatFCFA(limit)} / mois` : 'illimité'}
            </AppText>
          </View>
          <Badge label={`Niveau ${level} · ${KYC_LIMITS[level].label}`} color={COLORS.white} background={KYC_COLOR[level]} />
        </View>
        <ProgressBar value={level / 3} color={KYC_COLOR[level]} label="Progression KYC" />
        {level < 3 ? (
          <AppText variant="small" weight="semibold" color={TEXT_ON_WHITE.blue}>
            Passer au niveau {level + 1} →
          </AppText>
        ) : null}
      </Card>

      <Card padded={false} style={{ marginTop: SPACING.md }}>
        {ITEMS.map(({ label, Icon, href }, i) => (
          <Pressable
            key={href}
            onPress={() => router.push(href as never)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.item, i < ITEMS.length - 1 && styles.border, pressed && { backgroundColor: COLORS.offWhite }]}
          >
            <Icon size={22} color={COLORS.navy} weight="duotone" />
            <AppText style={{ flex: 1 }}>{label}</AppText>
            <CaretRight size={16} color={COLORS.midGray} />
          </Pressable>
        ))}
      </Card>

      <Pressable onPress={signOut} accessibilityRole="button" style={[styles.item, { marginTop: SPACING.md, justifyContent: 'center' }]}>
        <SignOut size={22} color={TEXT_ON_WHITE.red} />
        <AppText weight="bold" color={TEXT_ON_WHITE.red}>
          Déconnexion
        </AppText>
      </Pressable>
      <AppText variant="small" align="center" color={TEXT_ON_WHITE.muted}>
        DALA Finance v0.1.0
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 4, marginVertical: SPACING.lg },
  avatar: { width: 84, height: 84, borderRadius: RADIUS.full, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lightGray },
});
