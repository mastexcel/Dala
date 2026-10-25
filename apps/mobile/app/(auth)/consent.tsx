import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { TEST_PHASE, TEST_PHASE_NOTICE } from '@dala/shared';
import { TestPhaseTerms } from '@/components/legal/TestPhaseTerms';
import { AppText, AuthBackground, Button, Header } from '@/components/ui';
import { useRegistrationStore } from '@/stores/registration';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

/** Avertissement de la phase de test, accepté avant toute saisie de données personnelles. */
export default function Consent() {
  const accept = useRegistrationStore((s) => s.acceptConsent);
  const [understood, setUnderstood] = useState(false);
  const [terms, setTerms] = useState(false);

  return (
    <AuthBackground>
      <View style={{ marginHorizontal: -SPACING.lg }}>
        <Header title="Avant de commencer" />
      </View>
      <AppText weight="bold" color={TEXT_ON_WHITE.gold} align="center">
        {TEST_PHASE_NOTICE}
      </AppText>
      <AppText color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.sm }}>
        Lisez ces conditions avant de créer votre compte.
      </AppText>
      <TestPhaseTerms />
      <View style={{ flexDirection: 'row', gap: SPACING.md, alignItems: 'center', marginTop: SPACING.md }}>
        <Switch value={understood} onValueChange={setUnderstood} trackColor={{ true: COLORS.green }} accessibilityLabel="J'ai compris que le service est en phase de test" />
        <AppText variant="caption" style={{ flex: 1 }}>
          J'ai compris que DALA Finance est un service expérimental en phase de test, avec les plafonds ci-dessus.
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: SPACING.md, alignItems: 'center' }}>
        <Switch value={terms} onValueChange={setTerms} trackColor={{ true: COLORS.green }} accessibilityLabel="J'accepte les conditions générales" />
        <AppText variant="caption" style={{ flex: 1 }}>
          J'accepte les conditions générales d'utilisation et la politique de confidentialité.{' '}
          <AppText variant="caption" weight="bold" color={TEXT_ON_WHITE.blue} onPress={() => router.push('/profile/legal')} accessibilityRole="link">
            Lire
          </AppText>
        </AppText>
      </View>
      <Button
        title="J'accepte et je continue"
        disabled={!understood || !terms}
        onPress={() => {
          accept(TEST_PHASE.consentVersion);
          router.replace('/(auth)/register');
        }}
      />
      <AppText variant="small" color={TEXT_ON_WHITE.muted} align="center">
        Version {TEST_PHASE.consentVersion}. Votre acceptation est horodatée et conservée avec votre compte.
      </AppText>
    </AuthBackground>
  );
}
