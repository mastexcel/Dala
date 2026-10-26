export const COLORS = {
  // Primaires
  navy: '#0F1B3D', // Fond principal, headers, confiance
  gold: '#D4A017', // Accents, CTA, succès financier
  green: '#1B8A6B', // Épargne, validations, croissance

  // Secondaires
  purple: '#8E44AD', // Crowdfunding, premium
  blue: '#2980B9', // Investissement, liens
  orange: '#E67E22', // Crédit, alertes douces
  red: '#E74C3C', // Erreurs, refus

  // Neutres
  white: '#FFFFFF',
  /** Fond des blocs posés sur les fonds d'écran : blanc transparent à 15 % (opacité 85 %). */
  surface: 'rgba(255,255,255,0.85)',
  offWhite: '#F8F9FA',
  lightGray: '#E9ECEF',
  midGray: '#6C757D',
  darkGray: '#343A40',
  black: '#212529',

  // Gradients (CSS/SVG)
  gradientPrimary: ['#0F1B3D', '#1A2E5A'],
  gradientGold: ['#D4A017', '#F0C040'],
  gradientGreen: ['#1B8A6B', '#2ECC71'],
  gradientPurple: ['#8E44AD', '#9B59B6'],
} as const;

/** Variantes accessibles (contraste AA ≥ 4.5:1 sur blanc) pour le texte coloré. */
export const TEXT_ON_WHITE = {
  gold: '#8A6608',
  green: '#167358',
  orange: '#A8560F',
  blue: '#1F6391',
  purple: '#7D3C98',
  red: '#C0392B',
  muted: '#5A6268',
} as const;

/** Couleur de chaque pilier (icônes, barres de progression, badges). */
export const PILLAR_COLORS = {
  savings: COLORS.green,
  invest: COLORS.blue,
  crowdfund: COLORS.purple,
  credit: COLORS.orange,
} as const;
