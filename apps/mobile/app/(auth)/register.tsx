import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MIN_AGE, TEST_PHASE, UEMOA_COUNTRIES, ageOn, toE164 } from '@dala/shared';
import { AppText, AuthBackground, Button, CodeInput, Header, Input, PhoneInput, type Country } from '@/components/ui';
import { authApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { useRegistrationStore } from '@/stores/registration';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const schema = z
  .object({
    firstName: z.string().trim().min(2, 'Prénom trop court'),
    lastName: z.string().trim().min(2, 'Nom trop court'),
    phone: z.string().min(7, 'Numéro invalide'),
    email: z.string().email('E-mail invalide').optional().or(z.literal('')),
    // Saisie JJ/MM/AAAA, convertie en AAAA-MM-JJ pour l'API.
    birthDate: z
      .string()
      .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Format JJ/MM/AAAA')
      .refine((v) => !Number.isNaN(ageOn(toIsoDate(v))), 'Date invalide')
      .refine((v) => ageOn(toIsoDate(v)) >= MIN_AGE, `Le compte est réservé aux personnes de ${MIN_AGE} ans ou plus`),
    pin: z.string().regex(/^\d{4}$/, '4 chiffres'),
    pinConfirm: z.string(),
    referralCode: z.string().optional(),
  })
  .refine((v) => v.pin === v.pinConfirm, { path: ['pinConfirm'], message: 'Les codes PIN ne correspondent pas' })
  .refine((v) => !/^(\d)\1+$/.test(v.pin) && !['1234', '0123', '4321'].includes(v.pin), { path: ['pin'], message: 'PIN trop simple' });

type Form = z.infer<typeof schema>;

function toIsoDate(ddmmyyyy: string) {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m}-${d}`;
}

/** Ajoute les barres obliques pendant la saisie : 14051990 → 14/05/1990. */
function maskDate(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

export default function Register() {
  const [country, setCountry] = useState<Country>(UEMOA_COUNTRIES[0]);
  const [error, setError] = useState<string>();
  const setPending = useRegistrationStore((s) => s.set);
  const consent = useRegistrationStore((s) => s.consent);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', phone: '', email: '', birthDate: '', pin: '', pinConfirm: '', referralCode: '' },
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
      setPending({
        phone,
        firstName: v.firstName,
        lastName: v.lastName,
        pin: v.pin,
        email: v.email || undefined,
        referralCode: v.referralCode || undefined,
        dateOfBirth: toIsoDate(v.birthDate),
        consent: { version: consent!.version, accepted: true },
      });
      router.push({ pathname: '/(auth)/otp', params: { dev: __DEV__ ? r.devCode ?? '' : '' } });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  // L'avertissement de la phase de test doit être accepté avant toute saisie.
  if (consent?.version !== TEST_PHASE.consentVersion) return <Redirect href="/(auth)/consent" />;

  return (
    <AuthBackground>
      <View style={{ marginHorizontal: -SPACING.lg }}>
        <Header title="Créer un compte" />
      </View>
      <AppText color={TEXT_ON_WHITE.muted} style={{ marginBottom: SPACING.md }}>
        Ouvrez votre compte DALA en 2 minutes. Niveau 1 : nom, prénom et téléphone vérifié.
      </AppText>
      <Controller control={control} name="firstName" render={({ field, fieldState }) => <Input label="Prénom" autoComplete="given-name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <Controller control={control} name="lastName" render={({ field, fieldState }) => <Input label="Nom" autoComplete="family-name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <Controller control={control} name="phone" render={({ field, fieldState }) => <PhoneInput country={country} onCountryChange={setCountry} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <Controller control={control} name="birthDate" render={({ field, fieldState }) => <Input label="Date de naissance (JJ/MM/AAAA)" keyboardType="number-pad" maxLength={10} placeholder="14/05/1990" value={field.value} onChangeText={(t) => field.onChange(maskDate(t))} error={fieldState.error?.message} />} />
      <Controller control={control} name="email" render={({ field, fieldState }) => <Input label="E-mail (facultatif)" keyboardType="email-address" autoCapitalize="none" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
      <Controller control={control} name="pin" render={({ field, fieldState }) => (
        <View>
          <CodeInput secure label="Choisissez un code PIN" length={4} value={field.value} onChange={field.onChange} />
          {fieldState.error ? <AppText variant="small" color={TEXT_ON_WHITE.red}>{fieldState.error.message}</AppText> : null}
        </View>
      )} />
      <Controller control={control} name="pinConfirm" render={({ field, fieldState }) => (
        <View>
          <CodeInput secure label="Confirmez le code PIN" length={4} value={field.value} onChange={field.onChange} />
          {fieldState.error ? <AppText variant="small" color={TEXT_ON_WHITE.red}>{fieldState.error.message}</AppText> : null}
        </View>
      )} />
      <Controller control={control} name="referralCode" render={({ field }) => <Input label="Code de parrainage (facultatif)" autoCapitalize="characters" value={field.value} onChangeText={field.onChange} />} />
      {error ? <AppText color={TEXT_ON_WHITE.red} align="center">{error}</AppText> : null}
      <Button title="Recevoir le code OTP" onPress={onSubmit} loading={formState.isSubmitting} />
      <AppText variant="small" color={TEXT_ON_WHITE.muted} align="center">
        Conditions de la phase de test acceptées le {new Date(consent.acceptedAt).toLocaleString('fr-FR')}.
      </AppText>
      <Pressable onPress={() => router.replace('/(auth)/login')} accessibilityRole="button" style={{ padding: SPACING.md }}>
        <AppText align="center" color={TEXT_ON_WHITE.muted}>
          Déjà inscrit ? <AppText weight="bold" color={TEXT_ON_WHITE.gold}>Se connecter</AppText>
        </AppText>
      </Pressable>
    </AuthBackground>
  );
}
