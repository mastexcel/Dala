import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { fr } from './fr';
import { en } from './en';

// Français par défaut ; anglais disponible ; bambara (bm) prévu.
void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v3',
});

export default i18n;
