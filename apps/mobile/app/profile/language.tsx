import { Pressable, View } from 'react-native';
import { CheckCircle, Circle } from 'phosphor-react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Header, Screen } from '@/components/ui';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const LANGS = [
  { code: 'fr', label: 'Français', available: true },
  { code: 'en', label: 'English', available: true },
  { code: 'bm', label: 'Bamanankan (bambara)', available: false },
];

export default function Language() {
  const { i18n } = useTranslation();
  return (
    <Screen header={<Header title="Langue" />}>
      <Card padded={false}>
        {LANGS.map((l) => {
          const active = i18n.language === l.code;
          return (
            <Pressable
              key={l.code}
              disabled={!l.available}
              onPress={() => void i18n.changeLanguage(l.code)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled: !l.available }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md }}
            >
              {active ? <CheckCircle size={22} color={COLORS.green} weight="fill" /> : <Circle size={22} color={COLORS.midGray} />}
              <View style={{ flex: 1 }}>
                <AppText weight="semibold" color={l.available ? COLORS.black : COLORS.midGray}>{l.label}</AppText>
                {!l.available ? <AppText variant="small" color={TEXT_ON_WHITE.muted}>Bientôt disponible</AppText> : null}
              </View>
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}
