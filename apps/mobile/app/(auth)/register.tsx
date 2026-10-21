import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UEMOA_COUNTRIES, toE164 } from '@dala/shared';
import { AppText, AuthBackground, Button, CodeInput, Header, Input, PhoneInput, type Country } from '@/components/ui';
import { authApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { useRegistrationStore } from '@/stores/registration';
import { COLORS, SPACING } from '@/theme';

const schema = z
  .object({
    firstName: z.string().trim().min(2, 'Prénom trop court'),
    lastName: z.string().trim().min(2, 'Nom trop court'),
    phone: z.string().min(7, 'Numéro invalide'),
    email: z.string().email('E-mail invalide').optional().or(z.literal('')),
    pin: z.string().regex(/^\d{4}$/, '4 chiffres'),
    pinConfirm: z.string(),
    referralCode: z.string().optional(),
  })
  .refine((v) => v.pin === v.pinConfirm, { path: ['pinConfirm'], message: 'Les codes PIN ne correspondent pas' })
  .refine((v) => !/^(\d)\1+$/.test(v.pin) && !['1234', '0123', '4321'].includes(v.pin), { path: ['pin'], message: 'PIN trop simple' });

type Form = z.infer<typeof schema>;

export default function Register() {
  const [country, setCountry] = useState<Country>(UEMOA_COUNTRIES[0]);
  const [error, setError] = useState<string>();
  const setPending = useRegistrationStore((s) => s.set);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', phone: '', email: '', pin: '', pinConfirm: '', referralCode: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(undefined);
    const phone = toE164(country.dialCode, v.phone);
    if (v.phone.replace(/\D/g, '').length !== country.phoneLength) {
      setError(`Le numéro doit contenir ${country.phoneLength} chiffres`);
      return;
    }
    try {
      const r = await authApi.requestOtp(phone, 'REGISTER');
      setPending({ phone, firstName: v.firstName, lastName: v.lastName, pin: v.pin, email: v.email || undefined, referralCode: v.referralCode || undefined });
      router.push({ pathname: '/(auth)/otp', params: { dev: __DEV__ ? r.devCode ?? '' : '' } });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <AuthBackground>
      <View style={{ marginHorizontal: -SPACING.lg }}>
        <Header title="Créer un compte" light />
      </View>
      <AppText color={COLORS.lightGray} style={{ marginBottom: SPACING.md }}>
        Ouvrez votre compte DALA en 2 minutes. Niveau 1 : nom, prénom et téléphone vérifié.
      </AppText>
      <Controller control={control} name="firstName" render={({ field, fieldState }) => <Input dark label="Prénom" autoComplete="given-name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <Controller control={control} name="lastName" render={({ field, fieldState }) => <Input dark label="Nom" autoComplete="family-name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <Controller control={control} name="phone" render={({ field, fieldState }) => <PhoneInput dark country={country} onCountryChange={setCountry} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <Controller control={control} name="email" render={({ field, fieldState }) => <Input dark label="E-mail (facultatif)" keyboardType="email-address" autoCapitalize="none" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <Controller control={control} name="pin" render={({ field, fieldState }) => (
        <View>
          <CodeInput dark secure label="Choisissez un code PIN" length={4} value={field.value} onChange={field.onChange} />
          {fieldState.error ? <AppText variant="small" color="#FF8A80">{fieldState.error.message}</AppText> : null}
        </View>
      )} />
      <Controller control={control} name="pinConfirm" render={({ field, fieldState }) => (
        <View>
          <CodeInput dark secure label="Confirmez le code PIN" length={4} value={field.value} onChange={field.onChange} />
          {fieldState.error ? <AppText variant="small" color="#FF8A80">{fieldState.error.message}</AppText> : null}
        </View>
      )} />
      <Controller control={control} name="referralCode" render={({ field }) => <Input dark label="Code de parrainage (facultatif)" autoCapitalize="characters" value={field.value} onChangeText={field.onChange} />} />
      {error ? <AppText color="#FF8A80" align="center">{error}</AppText> : null}
      <Button title="Recevoir le code OTP" onPress={onSubmit} loading={formState.isSubmitting} />
      <AppText variant="small" color={COLORS.lightGray} align="center">
        En continuant, vous acceptez les Conditions générales d'utilisation et la politique de confidentialité de DALA Finance.
      </AppText>
      <Pressable onPress={() => router.replace('/(auth)/login')} accessibilityRole="button" style={{ padding: SPACING.md }}>
        <AppText align="center" color={COLORS.lightGray}>
          Déjà inscrit ? <AppText weight="bold" color={COLORS.gold}>Se connecter</AppText>
        </AppText>
      </Pressable>
    </AuthBackground>
  );
}
