import { View } from 'react-native';
import {
  COMPLAINT_RESPONSE_DAYS,
  KYC_LIMITS,
  LEGAL_NOTICE,
  MIN_AGE,
  RETENTION_YEARS_AFTER_CLOSURE,
  TEST_PHASE,
  formatDate,
  formatFCFA,
} from '@dala/shared';
import { AppText, Card, SectionTitle } from '@/components/ui';
import { COLORS, SPACING } from '@/theme';

const l = TEST_PHASE.limits;

/** Conditions de participation à la phase de test (écran de consentement et mentions légales). */
export const TEST_PHASE_TERMS: { title: string; items: string[] }[] = [
  {
    title: 'Un service expérimental',
    items: [
      LEGAL_NOTICE,
      "Le service est expérimental : il peut évoluer, être suspendu ou prendre fin à l'issue du test.",
      'Pendant le test, seuls l’épargne, le micro-crédit et les paiements sont proposés. Les placements et le financement participatif ne le sont pas.',
    ],
  },
  {
    title: 'Durée du test',
    items: [
      TEST_PHASE.endDate
        ? `Le test se déroule jusqu’au ${formatDate(TEST_PHASE.endDate)}.`
        : 'La durée du test est fixée par le protocole convenu avec la BCEAO. La date de fin vous sera indiquée dans l’application dès qu’elle sera arrêtée.',
      'Vous serez prévenu dans l’application avant la fin du test et pourrez retirer vos fonds.',
    ],
  },
  {
    title: 'Plafonds',
    items: [
      `Prêt : ${formatFCFA(l.loanMax)} au maximum par prêt.`,
      `Comptes ouverts aux niveaux de vérification 1 et 2 : ${formatFCFA(KYC_LIMITS[1].monthlyLimit!)} puis ${formatFCFA(KYC_LIMITS[2].monthlyLimit!)} d’opérations par mois.`,
      `Tontines : ${l.maxTontineMembers} membres au plus.`,
      `Le test est limité à ${l.maxUsers} utilisateurs. Les plafonds globaux (encours de crédit, fonds déposés) peuvent suspendre temporairement un prêt ou un dépôt.`,
      'L’épargne (objectifs, coffre-fort) n’est pas rémunérée pendant le test.',
      `Le service est réservé aux personnes de ${MIN_AGE} ans ou plus.`,
    ],
  },
  {
    title: 'Vos droits',
    items: [
      'Retirer vos fonds à tout moment vers votre compte mobile money.',
      `Déposer une réclamation : réponse sous ${COMPLAINT_RESPONSE_DAYS} jours ouvrés. Sans réponse satisfaisante, vous pouvez saisir l’Observatoire de la qualité des services financiers ou la BCEAO.`,
      'Accéder à vos données, les exporter, les faire rectifier et clôturer votre compte (Profil › Mes données).',
      `Après clôture, vos données sont conservées ${RETENTION_YEARS_AFTER_CLOSURE} ans, comme l’exige la réglementation contre le blanchiment, puis anonymisées. Elles sont hébergées dans l’UEMOA.`,
    ],
  },
];

export function TestPhaseTerms() {
  return (
    <View style={{ gap: SPACING.sm }}>
      {TEST_PHASE_TERMS.map((section) => (
        <Card key={section.title} style={{ gap: SPACING.xs }}>
          <SectionTitle title={section.title} />
          {section.items.map((item) => (
            <View key={item} style={{ flexDirection: 'row', gap: SPACING.xs }}>
              <AppText variant="caption" color={COLORS.darkGray}>•</AppText>
              <AppText variant="caption" color={COLORS.darkGray} style={{ flex: 1 }}>
                {item}
              </AppText>
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}
