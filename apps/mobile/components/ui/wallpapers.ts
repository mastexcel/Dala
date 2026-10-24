/**
 * Fonds d'écran par section (charte DALA, originaux dans design/backgrounds/v3).
 * Clairs et désaturés au centre : le contenu reste lisible sans voile.
 */
export const WALLPAPERS = {
  home: require('@/assets/backgrounds/home.jpg'),
  /** Fond bleu général : connexion, transactions, notifications, portefeuille. */
  general: require('@/assets/backgrounds/general.jpg'),
  savings: require('@/assets/backgrounds/savings.jpg'),
  invest: require('@/assets/backgrounds/invest.jpg'),
  crowdfund: require('@/assets/backgrounds/crowdfund.jpg'),
  credit: require('@/assets/backgrounds/credit.jpg'),
  profile: require('@/assets/backgrounds/profile.jpg'),
} as const;

export type WallpaperName = keyof typeof WALLPAPERS;

/** Contraint l'image à son conteneur (sur le web, sa taille intrinsèque élargirait la page). */
export const WALLPAPER_IMAGE = { width: '100%', height: '100%' } as const;
