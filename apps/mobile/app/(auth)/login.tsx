import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Fingerprint, ScanSmiley } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { UEMOA_COUNTRIES, toE164 } from '@dala/shared';
import { AppText, AuthBackground, Button, CodeInput, Logo, PhoneInput, type Country } from '@/components/ui';
import { authApi } from '@/services/api';
import { USE_MOCKS } from '@/services/config';
import { errorMessage } from '@/services/errors';
import { track, amountBucket } from '@/services/monitoring';
import { useAuthStore } from '@/stores/auth';
import { useBiometrics } from '@/hooks/useBiometrics';
import { COLORS, RADIUS, SPACING, TEXT_ON_WHITE } from '@/theme';

const OTP_LENGTH = 6;

export default function Login() {
  const { t } = useTranslation();
  const [country, setCountry] = useState<Country>(UEMOA_COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const { setSession, refresh, hasStoredSession, biometricEnabled } = useAuthStore();
  const bio = useBiometrics();

  const e164 = toE164(country.dialCode, phone);
  const phoneValid = phone.replace(/\D/g, '').length === country.phoneLength;

  const sendOtp = async () => {
    setError(undefined);
    setLoading(true);
    try {
      const r = await authApi.requestOtp(e164, 'LOGIN');
      setOtpSent(true);
      if (r.devCode && __DEV__) setOtp(r.devCode);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setError(undefined);
    setLoading(true);
    try {
      await setSession(await authApi.login({ phone: e164, otp, pin }));
      track('login', { country: country.code });
      router.replace('/(tabs)');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  /** Biométrie (inhérence) + appareil enrôlé (possession) = authentification forte. */
  const biometricLogin = async () => {
    if (!hasStoredSession) {
      Alert.alert('Biométrie', 'Connectez-vous une première fois avec votre code, puis activez la biométrie dans Profil › Sécurité.');
      return;
    }
    if (!(await bio.authenticate())) return;
    setLoading(true);
    const ok = await refresh({ biometric: true });
    setLoading(false);
    if (ok) {
      track('login_biometric');
      router.replace('/(tabs)');
    }
    else setError('Session expirée. Connectez-vous avec votre code.');
  };

  const BioIcon = bio.label === 'Face ID' ? ScanSmiley : Fingerprint;

  return (
    <AuthBackground>
      <View style={styles.logo}>
        <Logo variant="colorLight" width={200} />
        <AppText variant="h2" color={COLORS.navy} align="center" style={{ marginTop: SPACING.lg }}>
          Bon retour 👋
        </AppText>
      </View>

      <PhoneInput country={country} onCountryChange={setCountry} value={phone} onChangeText={setPhone} />

      {!otpSent ? (
        <Button title={t('auth.sendOtp')} onPress={sendOtp} loading={loading} disabled={!phoneValid} />
      ) : (
        <>
          <CodeInput label={t('auth.otp')} length={OTP_LENGTH} value={otp} onChange={setOtp} autoFocus />
          <CodeInput secure label={t('auth.pin')} length={4} value={pin} onChange={setPin} />
          <Button title={t('auth.login')} onPress={login} loading={loading} disabled={otp.length !== OTP_LENGTH || pin.length < 4} />
          <Pressable onPress={sendOtp} accessibilityRole="button" style={{ alignSelf: 'center', padding: SPACING.sm }}>
            <AppText variant="caption" color={TEXT_ON_WHITE.gold} weight="semibold">
              {t('auth.resend')}
            </AppText>
          </Pressable>
        </>
      )}

      {error ? (
        <AppText color={TEXT_ON_WHITE.red} align="center" accessibilityLiveRegion="assertive">
          {error}
        </AppText>
      ) : null}

      {(bio.available || USE_MOCKS) && (hasStoredSession || biometricEnabled) ? (
        <Pressable onPress={biometricLogin} style={styles.bio} accessibilityRole="button">
          <BioIcon size={26} color={COLORS.gold} weight="duotone" />
          <AppText weight="semibold" color={COLORS.navy}>
            {t('auth.biometric', { method: bio.label })}
          </AppText>
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }} />
      {USE_MOCKS ? (
        <AppText variant="small" align="center" color={TEXT_ON_WHITE.muted}>
          {t('auth.demoHint')}
        </AppText>
      ) : null}
      <Pressable onPress={() => router.push('/(auth)/register')} accessibilityRole="button" style={{ padding: SPACING.md }}>
        <AppText align="center" color={TEXT_ON_WHITE.muted}>
          {t('auth.noAccount')} <AppText weight="bold" color={TEXT_ON_WHITE.gold}>{t('auth.createAccount')}</AppText>
        </AppText>
      </Pressable>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', marginVertical: SPACING.xl },
  bio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.lightGray, backgroundColor: COLORS.white, marginTop: SPACING.md },
});
