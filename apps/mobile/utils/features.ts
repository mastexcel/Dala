import { TEST_PHASE } from '@dala/shared';

/**
 * Fonctions ouvertes dans l'application pendant la phase de test LIF-BCEAO (reflet de
 * TEST_PHASE ; l'API applique les mêmes règles et reste seule à faire foi).
 */
export const FEATURES = {
  invest: TEST_PHASE.modules.invest,
  crowdfund: TEST_PHASE.modules.crowdfund,
  assistant: TEST_PHASE.aiAssistant !== 'off',
  assistantMode: TEST_PHASE.aiAssistant,
} as const;

export const isProviderEnabled = (id: string) => !TEST_PHASE.disabledProviders.includes(id);
