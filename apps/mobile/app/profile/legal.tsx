import { View } from 'react-native';
import { AppText, Card, Header, Logo, Screen, SectionTitle, TestPhaseNotice } from '@/components/ui';
import { COMPLAINT_RESPONSE_DAYS, CROWDFUND_VALIDATOR, DEMO_NOTICE, LEGAL_NOTICE, REGULATORY_FRAMEWORK, LEGAL_NOTICE_CREDIT, LEGAL_NOTICE_CROWDFUND, LEGAL_NOTICE_INVEST, SUPPORT_PHONE, WITHDRAWAL_PERIOD_HOURS } from '@dala/shared';
import { TestPhaseTerms } from '@/components/legal/TestPhaseTerms';
import { FEATURES } from '@/utils/features';
import { USE_MOCKS } from '@/services/config';
import { COLORS, SPACING } from '@/theme';

const SECTIONS = [
  { title: 'Éditeur et statut', body: `${LEGAL_NOTICE}${USE_MOCKS ? ` ${DEMO_NOTICE}` : ''}` },
  { title: 'Cadre réglementaire', body: `${REGULATORY_FRAMEWORK.slice(0, -1)} : authentification forte (art. 84), cantonnement des fonds (art. 48-51), lutte contre le blanchiment de capitaux et le financement du terrorisme (art. 27-31) et protection des utilisateurs (art. 52-74).` },
  { title: 'Tarification', body: 'Les conditions tarifaires sont affichées avant chaque opération. Ouverture de compte, épargne et cotisations de tontine : gratuites. Les frais des opérateurs mobile money peuvent s’appliquer aux dépôts et retraits.' },
  ...(FEATURES.invest
    ? [
        { title: 'Investissement', body: LEGAL_NOTICE_INVEST },
        { title: 'Droit de rétractation', body: `Vous disposez d'un délai de ${WITHDRAWAL_PERIOD_HOURS} heures pour vous rétracter de tout investissement, sans frais ni justification.` },
      ]
    : []),
  ...(FEATURES.crowdfund
    ? [{ title: 'Crowdfunding en capital', body: `${LEGAL_NOTICE_CROWDFUND} Les projets sont sélectionnés par ${CROWDFUND_VALIDATOR}. DALA ne propose ni prêt participatif, ni don.` }]
    : []),
  { title: 'Crédit', body: LEGAL_NOTICE_CREDIT },
  { title: 'Réclamations', body: `Toute réclamation reçoit une réponse sous ${COMPLAINT_RESPONSE_DAYS} jours ouvrés (Profil › Support, ou au ${SUPPORT_PHONE}).` },
  { title: 'Données personnelles', body: 'Vos données sont collectées pour la gestion de votre compte et le respect de nos obligations légales (KYC, LBC/FT). Elles ne sont jamais vendues et sont hébergées dans l’UEMOA. Vous disposez d’un droit d’accès, d’export, de rectification et de clôture (Profil › Mes données).' },
]

export default function Legal() {
  return (
    <Screen wallpaper="profile" header={<Header title="Mentions légales & CGU" />}>
      <Logo variant="black" width={140} style={{ alignSelf: 'center', marginBottom: SPACING.md }} />
      <View style={{ marginBottom: SPACING.md }}>
        <TestPhaseNotice />
      </View>
      {SECTIONS.map((s) => (
        <Card key={s.title} style={{ marginBottom: SPACING.sm }}>
          <SectionTitle title={s.title} />
          <AppText variant="caption" color={COLORS.darkGray}>{s.body}</AppText>
        </Card>
      ))}
      <SectionTitle title="Conditions de la phase de test" icon="info" />
      <TestPhaseTerms />
    </Screen>
  );
}
