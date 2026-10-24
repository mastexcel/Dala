/**
 * Fonds d'écran par section (charte DALA, planche design/backgrounds/planche-fonds.png).
 * Clairs et désaturés au centre : le contenu reste lisible sans voile.
 */
export const WALLPAPERS = {
  home: require('@/assets/backgrounds/home.jpg'),
  auth: require('@/assets/backgrounds/auth.jpg'),
  savings: require('@/assets/backgrounds/savings.jpg'),
  invest: require('@/assets/backgrounds/invest.jpg'),
  crowdfund: require('@/assets/backgrounds/crowdfund.jpg'),
  credit: require('@/assets/backgrounds/credit.jpg'),
  transactions: require('@/assets/backgrounds/transactions.jpg'),
  profile: require('@/assets/backgrounds/profile.jpg'),
  notifications: require('@/assets/backgrounds/notifications.jpg'),
  portfolio: require('@/assets/backgrounds/portfolio.jpg'),
  services: require('@/assets/backgrounds/services.jpg'),
  opportunities: require('@/assets/backgrounds/opportunities.jpg'),
} as const;

export type WallpaperName = keyof typeof WALLPAPERS;

/** Contraint l'image à son conteneur (sur le web, sa taille intrinsèque élargirait la page). */
export const WALLPAPER_IMAGE = { width: '100%', height: '100%' } as const;
