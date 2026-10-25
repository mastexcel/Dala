import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { CaretDown } from 'phosphor-react-native';
import { UEMOA_COUNTRIES } from '@dala/shared';
import { COLORS, RADIUS, SPACING } from '@/theme';
import { AppText } from './AppText';
import { Input } from './Input';

export type Country = (typeof UEMOA_COUNTRIES)[number];

interface Props {
  country: Country;
  onCountryChange: (c: Country) => void;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  dark?: boolean;
  label?: string;
  placeholder?: string;
}

/** Saisie de numéro avec sélecteur d'indicatif UEMOA (+225 par défaut). */
export function PhoneInput({ country, onCountryChange, value, onChangeText, error, dark, label = 'Numéro de téléphone', placeholder }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Input
        dark={dark}
        label={label}
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/[^\d ]/g, ''))}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder={placeholder ?? '0'.repeat(country.phoneLength).replace(/(\d{2})(?=\d)/g, '$1 ')}
        maxLength={country.phoneLength + Math.floor(country.phoneLength / 2)}
        error={error}
        prefix={
          <Pressable onPress={() => setOpen(true)} style={styles.prefix} accessibilityRole="button" accessibilityLabel={`Indicatif ${country.name} ${country.dialCode}, modifier`}>
            <AppText>{country.flag}</AppText>
            <AppText weight="semibold" color={dark ? COLORS.white : COLORS.black}>
              {country.dialCode}
            </AppText>
            <CaretDown size={14} color={dark ? COLORS.lightGray : COLORS.midGray} />
          </Pressable>
        }
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <AppText variant="h4" weight="bold" style={{ marginBottom: SPACING.sm }}>
              Pays de l'UEMOA
            </AppText>
            <FlatList
              data={UEMOA_COUNTRIES}
              keyExtractor={(c) => c.code}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onCountryChange(item);
                    setOpen(false);
                  }}
                  style={[styles.item, item.code === country.code && { backgroundColor: COLORS.offWhite }]}
                >
                  <AppText>{item.flag}</AppText>
                  <AppText style={{ flex: 1 }}>{item.name}</AppText>
                  <AppText weight="semibold">{item.dialCode}</AppText>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  prefix: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: SPACING.sm, borderRightWidth: 1, borderRightColor: COLORS.lightGray },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.55)', justifyContent: 'center', padding: SPACING.lg },
  sheet: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, maxHeight: '70%' },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.sm },
});
