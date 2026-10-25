/**
 * Constantes produit et réglementaires DALA Finance.
 * Référence : Instruction BCEAO N°001-01-2024 relative aux services de paiement dans l'UMOA.
 * Les seuils marqués « à valider » doivent être confirmés par le service Conformité avant production.
 */

export const CURRENCY = 'XOF' as const;
export const CURRENCY_LABEL = 'FCFA' as const;
export const APP_NAME = 'DALA Finance';
export const APP_SLOGAN = 'Faire grandir vos ambitions';

/* ------------------------------------------------------------------------------------------------
 * Phase de test au sein du Laboratoire d'Innovation Financière (LIF) de la BCEAO.
 * Ces valeurs reprennent les engagements du dossier de candidature : elles sont appliquées par
 * l'API (seule source qui fait foi) et reprises à l'écran. Toute modification doit d'abord être
 * validée avec la BCEAO.
 * ---------------------------------------------------------------------------------------------- */
export const TEST_PHASE = {
  /**
   * Modules ouverts pendant le test : épargne, crédit et paiements.
   * Investissement et financement participatif relèvent de l'AMF-UMOA : désactivés.
   */
  modules: { invest: false, crowdfund: false },
  /**
   * Assistant IA : 'off' (désactivé), 'help' (aide à l'usage de l'application, sans données
   * personnelles ni investissement) ou 'full'. Désactivé pendant le test : il enverrait des
   * données hors de l'UEMOA.
   */
  aiAssistant: 'off' as 'off' | 'help' | 'full',
  limits: {
    /** Montant maximal d'un prêt (FCFA). */
    loanMax: 100_000,
    /** Nombre maximal d'utilisateurs inscrits. */
    maxUsers: 500,
    /** Niveau KYC maximal ouvert. */
    maxKycLevel: 2 as 1 | 2 | 3,
    /** Nombre maximal de tontines (non terminées) et de membres par tontine. */
    maxTontines: 30,
    maxTontineMembers: 20,
    /** Encours total de crédit (capital restant dû, FCFA). */
    maxCreditOutstanding: 5_000_000,
    /** Total des fonds clients (soldes cumulés, FCFA). */
    maxClientFunds: 30_000_000,
  },
  /** Seul un établissement agréé peut rémunérer l'épargne : coffre-fort sans intérêt pendant le test. */
  vaultInterest: false,
  /** Opérateurs mobile money désactivés tant que leur statut n'est pas vérifié. */
  disabledProviders: ['WAVE'] as string[],
  /** Date de fin du test (AAAA-MM-JJ), à renseigner une fois fixée avec la BCEAO. */
  endDate: null as string | null,
  /** Version du texte de consentement accepté à l'inscription. */
  consentVersion: '2026-10-lif-1',
};

/** Âge minimal pour ouvrir un compte. */
export const MIN_AGE = 18;

/** Éditeur de l'application. */
export const PUBLISHER = 'Bridge Investment Partners SARL';
export const PUBLISHER_RCCM = 'CI-ABJ-03-2022-B12-00279';

/** Contact du support client. */
export const SUPPORT_PHONE = '+225 07 48 34 66 50';
/** Adresse e-mail du support : à renseigner (non communiquée). */
export const SUPPORT_EMAIL: string | null = null;

/** Indicatifs téléphoniques des 8 pays de l'UEMOA. */
export const UEMOA_COUNTRIES = [
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225', flag: '🇨🇮', phoneLength: 10 },
  { code: 'SN', name: 'Sénégal', dialCode: '+221', flag: '🇸🇳', phoneLength: 9 },
  { code: 'ML', name: 'Mali', dialCode: '+223', flag: '🇲🇱', phoneLength: 8 },
  { code: 'BF', name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫', phoneLength: 8 },
  { code: 'BJ', name: 'Bénin', dialCode: '+229', flag: '🇧🇯', phoneLength: 10 },
  { code: 'TG', name: 'Togo', dialCode: '+228', flag: '🇹🇬', phoneLength: 8 },
  { code: 'NE', name: 'Niger', dialCode: '+227', flag: '🇳🇪', phoneLength: 8 },
  { code: 'GW', name: 'Guinée-Bissau', dialCode: '+245', flag: '🇬🇼', phoneLength: 7 },
] as const;
export type UemoaCountryCode = (typeof UEMOA_COUNTRIES)[number]['code'];

/** Authentification forte (Art. 84) : seuil au-delà duquel une 2e preuve est exigée. */
export const STRONG_AUTH_THRESHOLD = 50_000;

/** Plafonds mensuels par niveau KYC (Art. 27-31, LBC/FT). `null` = pas de plafond. */
export const KYC_LIMITS: Record<1 | 2 | 3, { monthlyLimit: number | null; transfersAllowed: boolean; label: string }> = {
  1: { monthlyLimit: 200_000, transfersAllowed: false, label: 'Basique' },
  2: { monthlyLimit: 2_000_000, transfersAllowed: true, label: 'Intermédiaire' },
  3: { monthlyLimit: null, transfersAllowed: true, label: 'Complet' },
};

export const KYC_REQUIREMENTS: Record<1 | 2 | 3, string[]> = {
  1: ['Nom et prénom', 'Numéro de téléphone vérifié (OTP)'],
  2: ["Pièce d'identité (CNI ou passeport)", 'Selfie de vérification', 'Justificatif de domicile'],
  3: ['Justificatif de revenus', 'Vidéo de vérification'],
};

/** Micro-crédit */
export const LOAN_MIN = 5_000;
/** Plafond de la phase de test (le produit cible prévoit 500 000 FCFA). */
export const LOAN_MAX = TEST_PHASE.limits.loanMax;
export const LOAN_STEP = 5_000;
export const LOAN_DURATIONS = [7, 14, 30, 60, 90] as const;
export type LoanDuration = (typeof LOAN_DURATIONS)[number];
/**
 * Taux d'usure applicable au prêteur (annuel). 24 % est le taux des SFD dans l'UMOA ; une banque
 * est soumise à 15 %. À confirmer avec l'établissement agréé partenaire selon son statut.
 */
export const USURY_RATE = 0.24;
/** Taux nominal annuel selon le score (meilleur score → taux le plus bas). */
export const LOAN_RATE_BEST = 0.12;
export const LOAN_RATE_WORST = 0.18;
/** Frais de dossier (% du capital), plafonnés pour respecter le taux d'usure. */
export const LOAN_FEE_RATE = 0.01;
/** Score minimal pour être éligible à un prêt. */
export const LOAN_MIN_SCORE = 30;
/** Seuils de décision automatique du scoring ML (probabilité de remboursement). */
export const ML_APPROVE_THRESHOLD = 0.7;
export const ML_REVIEW_THRESHOLD = 0.5;

/** Taux du coffre-fort prévus hors phase de test (servis par un établissement agréé). */
const VAULT_TARGET_RATES = { 3: 0.035, 6: 0.045, 12: 0.06 } as const;
/** Coffre-fort : durées de blocage (mois) et taux annuels (nuls pendant le test). */
export const VAULT_OPTIONS = ([3, 6, 12] as const).map((months) => ({
  months,
  rate: TEST_PHASE.vaultInterest ? VAULT_TARGET_RATES[months] : 0,
}));

/** Crowdfunding en capital (equity uniquement). */
export const CROWDFUND_MIN_INVESTMENT = 5_000;
/**
 * Validation des projets : le dossier prévoit un cabinet indépendant de l'éditeur.
 * Le module ne peut pas être rouvert tant que ce cabinet n'est pas désigné (voir TEST_PHASE).
 */
export const CROWDFUND_VALIDATOR = 'un cabinet indépendant';
export const CROWDFUND_VALIDATOR_DESIGNATED = false;
export const CROWDFUND_REVIEW_DAYS = 15;
/** Droit de rétractation sur les investissements (heures). */
export const WITHDRAWAL_PERIOD_HOURS = 48;
/** Délai maximal de réponse à une réclamation (jours ouvrés). */
export const COMPLAINT_RESPONSE_DAYS = 15;

/** LBC/FT — seuils de détection (à paramétrer avec le responsable conformité). */
export const AML_LARGE_TRANSACTION = 5_000_000;
export const AML_STRUCTURING_WINDOW_HOURS = 24;
export const AML_STRUCTURING_MIN_COUNT = 3;
export const AML_STRUCTURING_RATIO = 0.8;
export const AML_VELOCITY_MAX_PER_HOUR = 10;

export const PROJECT_SECTORS = {
  AGRITECH: { label: 'AgriTech', emoji: '🌱' },
  SOLARTECH: { label: 'SolarTech', emoji: '☀️' },
  FOODTECH: { label: 'FoodTech', emoji: '🍲' },
  HEALTHTECH: { label: 'HealthTech', emoji: '🩺' },
  FINTECH: { label: 'FinTech', emoji: '💳' },
  EDUTECH: { label: 'EduTech', emoji: '📚' },
  LOGISTICS: { label: 'Logistique', emoji: '🚚' },
  OTHER: { label: 'Autre', emoji: '✨' },
} as const;

/** Bandeau permanent : DALA n'est pas présentée comme un établissement de paiement. */
export const TEST_PHASE_NOTICE = 'Service en phase de test au sein du LIF-BCEAO';

/** Mention propre à la version de démonstration (backend simulé). */
export const DEMO_NOTICE = "Version de démonstration : aucune opération réelle n'est effectuée et aucun fonds n'est déposé.";

export const REGULATORY_FRAMEWORK = "Le service est conçu dans le respect de l'Instruction BCEAO N°001-01-2024 relative aux services de paiement dans l'UMOA.";

/** Mention légale (écrans financiers, mentions légales, relevés PDF, reçus). */
export const LEGAL_NOTICE =
  `DALA Finance, solution éditée par ${PUBLISHER} (RCCM ${PUBLISHER_RCCM}). ` +
  "Service en phase de test au sein du Laboratoire d'Innovation Financière de la BCEAO. " +
  'Les opérations sont réalisées en partenariat avec un établissement agréé.';

export const LEGAL_NOTICE_INVEST =
  "Tout investissement comporte un risque de perte en capital. Les performances passées ne préjugent pas des performances futures. " +
  `Droit de rétractation de ${WITHDRAWAL_PERIOD_HOURS} h.`;

export const LEGAL_NOTICE_CROWDFUND =
  "Investir dans des sociétés non cotées comporte un risque de perte totale du capital et un risque d'illiquidité. " +
  `Projets validés par ${CROWDFUND_VALIDATOR}. N'investissez que l'argent dont vous n'avez pas besoin à court terme.`;

export const LEGAL_NOTICE_CREDIT =
  'Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de remboursement avant de vous engager. ' +
  `TAEG conforme au taux d'usure en vigueur dans l'UMOA (${USURY_RATE * 100} %).`;

/** Libellés des sujets d'échange avec l'équipe commerciale (y compris ceux des anciennes conversations). */
export const ADVISOR_TOPICS = {
  PAYMENTS: 'Paiements et portefeuille',
  SAVINGS: 'Épargne et tontines',
  CREDIT: 'Micro-crédit',
  OTHER: 'Autre demande',
  INVEST: 'Placements (bons du Trésor, FCP)',
  CROWDFUND: 'Crowdfunding en capital',
  BUSINESS: 'Lever des fonds pour mon entreprise',
} as const;
/**
 * Sujets ouverts aux nouvelles demandes pendant le test : l'investissement et la levée de fonds
 * relèvent de l'AMF-UMOA et sont exclus.
 */
export const ADVISOR_OPEN_TOPICS = ['PAYMENTS', 'SAVINGS', 'CREDIT', 'OTHER'] as const;
/** Heures d'ouverture de l'équipe commerciale (heure d'Abidjan, GMT). */
export const ADVISOR_HOURS = 'du lundi au vendredi, de 8 h à 18 h';

/** Avertissement affiché avec l'assistant IA. */
export const AI_DISCLAIMER =
  "Les réponses de l'assistant IA sont générées automatiquement à titre d'information. Elles ne constituent ni un conseil en investissement personnalisé ni une recommandation de DALA Finance. Tout placement comporte un risque de perte en capital.";

/** Politique de conservation des données (affichée dans l'application). */
export const DATA_RETENTION_POLICY = [
  "Données d'identification (KYC) et opérations : conservées 10 ans après la clôture du compte, conformément à la loi uniforme relative à la lutte contre le blanchiment de capitaux et le financement du terrorisme.",
  "Après ce délai, les données sont supprimées ou anonymisées.",
  'Échanges avec le support et réclamations : conservés pendant la même durée, pour répondre à un éventuel contrôle.',
  'Toutes les données sont hébergées dans l’UEMOA.',
];
/** Durée de conservation après clôture (années). */
export const RETENTION_YEARS_AFTER_CLOSURE = 10;

/**
 * Opérateurs mobile money en Côte d'Ivoire. Depuis la numérotation à 10 chiffres (2021), le préfixe
 * indique l'opérateur : 07 Orange, 05 MTN, 01 Moov. Wave fonctionne avec un numéro de n'importe quel
 * opérateur (pas de préfixe propre). Les opérateurs de TEST_PHASE.disabledProviders restent fermés.
 */
export const CI_MOBILE_MONEY = [
  { id: 'ORANGE_MONEY', name: 'Orange Money', prefix: '07', color: '#FF7900' },
  { id: 'MTN_MOMO', name: 'MTN MoMo', prefix: '05', color: '#FFCB05' },
  { id: 'MOOV_MONEY', name: 'Moov Money', prefix: '01', color: '#0057A8' },
  { id: 'WAVE', name: 'Wave', prefix: null, color: '#1DC8F1' },
] as const;
export type MobileMoneyOperator = (typeof CI_MOBILE_MONEY)[number]['id'];

/** Durée de validité d'une demande de paiement (heures). */
export const PAYMENT_REQUEST_TTL_HOURS = 72;
