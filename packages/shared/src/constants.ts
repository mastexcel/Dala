/**
 * Constantes produit et réglementaires DALA Finance.
 * Référence : Instruction BCEAO N°001-01-2024 relative aux services de paiement dans l'UMOA.
 * Les seuils marqués « à valider » doivent être confirmés par le service Conformité avant production.
 */

export const CURRENCY = 'XOF' as const;
export const CURRENCY_LABEL = 'FCFA' as const;
export const APP_NAME = 'DALA Finance';
export const APP_SLOGAN = 'Faire grandir vos ambitions';

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
export const LOAN_MAX = 500_000;
export const LOAN_STEP = 5_000;
export const LOAN_DURATIONS = [7, 14, 30, 60, 90] as const;
export type LoanDuration = (typeof LOAN_DURATIONS)[number];
/** Taux d'usure applicable aux SFD dans l'UMOA (annuel). À valider. */
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

/** Coffre-fort : durées de blocage (mois) et taux bonus annuels. */
export const VAULT_OPTIONS = [
  { months: 3, rate: 0.035 },
  { months: 6, rate: 0.045 },
  { months: 12, rate: 0.06 },
] as const;

/** Crowdfunding en capital (equity uniquement). */
export const CROWDFUND_MIN_INVESTMENT = 5_000;
export const CROWDFUND_VALIDATOR = 'Bridge Investment Partners';
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

export const LEGAL_NOTICE =
  "DALA Finance — Établissement de paiement soumis à l'Instruction BCEAO N°001-01-2024. " +
  "Les fonds des clients sont cantonnés sur des comptes dédiés, distincts des fonds propres de l'établissement.";

export const LEGAL_NOTICE_INVEST =
  "Tout investissement comporte un risque de perte en capital. Les performances passées ne préjugent pas des performances futures. " +
  `Droit de rétractation de ${WITHDRAWAL_PERIOD_HOURS} h.`;

export const LEGAL_NOTICE_CROWDFUND =
  "Investir dans des sociétés non cotées comporte un risque de perte totale du capital et un risque d'illiquidité. " +
  `Projets validés par ${CROWDFUND_VALIDATOR}. N'investissez que l'argent dont vous n'avez pas besoin à court terme.`;

export const LEGAL_NOTICE_CREDIT =
  'Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de remboursement avant de vous engager. ' +
  `TAEG conforme au taux d'usure en vigueur dans l'UMOA (${USURY_RATE * 100} %).`;

/** Sujets proposés pour contacter l'équipe commerciale. */
export const ADVISOR_TOPICS = {
  INVEST: 'Placements (bons du Trésor, FCP)',
  CROWDFUND: 'Crowdfunding en capital',
  SAVINGS: 'Épargne et tontines',
  CREDIT: 'Micro-crédit',
  BUSINESS: 'Lever des fonds pour mon entreprise',
  OTHER: 'Autre demande',
} as const;
/** Heures d'ouverture de l'équipe commerciale (heure d'Abidjan, GMT). */
export const ADVISOR_HOURS = 'du lundi au vendredi, de 8 h à 18 h';

/** Avertissement affiché avec l'assistant IA. */
export const AI_DISCLAIMER =
  "Les réponses de l'assistant IA sont générées automatiquement à titre d'information. Elles ne constituent ni un conseil en investissement personnalisé ni une recommandation de DALA Finance. Tout placement comporte un risque de perte en capital.";
