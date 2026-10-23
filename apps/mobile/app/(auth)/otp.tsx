import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { maskPhone } from '@dala/shared';
import { AppText, AuthBackground, Button, CodeInput, Header } from '@/components/ui';
import { authApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { useAuthStore } from '@/stores/auth';
import { useRegistrationStore } from '@/stores/registration';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function Otp() {
  const { dev } = useLocalSearchParams<{ dev?: string }>();
  const pending = useRegistrationStore((s) => s.pending);
  const clear = useRegistrationStore((s) => s.set);
  const setSession = useAuthStore((s) => s.setSession);
  const [otp, setOtp] = useState(dev ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!pending) return <Redirect href="/(auth)/register" />;

  const verify = async () => {
    setLoading(true);
    setError(undefined);
    try {
      await setSession(await authApi.register({ ...pending, otp }));
      clear(null);
      track('signup_completed', { referred: !!pending.referralCode });
      router.replace('/(tabs)');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setCountdown(RESEND_SECONDS);
    try {
      await authApi.requestOtp(pending.phone, 'REGISTER');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <AuthBackground>
      <View style={{ marginHorizontal: -SPACING.lg }}>
        <Header title="Vérification" />
      </View>
      <AppText variant="h2" color={COLORS.navy}>
        Entrez le code reçu
      </AppText>
      <AppText color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.lg }}>
        Un SMS a été envoyé au {maskPhone(pending.phone)}.
      </AppText>
      <CodeInput label="Code OTP" length={OTP_LENGTH} value={otp} onChange={setOtp} autoFocus />
      {error ? <AppText color={TEXT_ON_WHITE.red} align="center">{error}</AppText> : null}
      <Button title="Valider et créer mon compte" onPress={verify} loading={loading} disabled={otp.length !== OTP_LENGTH} />
      <Pressable disabled={countdown > 0} onPress={resend} accessibilityRole="button" style={{ padding: SPACING.md, alignSelf: 'center' }}>
        <AppText color={countdown > 0 ? TEXT_ON_WHITE.muted : TEXT_ON_WHITE.gold} weight="semibold">
          {countdown > 0 ? `Renvoyer le code dans ${countdown} s` : 'Renvoyer le code'}
        </AppText>
      </Pressable>
    </AuthBackground>
  );
}
