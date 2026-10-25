import { describe, expect, it } from 'vitest';
import { LEGAL_NOTICE, TEST_PHASE_NOTICE } from './constants';

describe('mentions légales', () => {
  it('reprend le texte du dossier', () => {
    expect(LEGAL_NOTICE).toBe(
      "DALA Finance, solution éditée par Bridge Investment Partners SARL (RCCM CI-ABJ-03-2022-B12-00279). Service en phase de test au sein du Laboratoire d'Innovation Financière de la BCEAO. Les opérations sont réalisées en partenariat avec un établissement agréé.",
    );
    expect(TEST_PHASE_NOTICE).toBe('Service en phase de test au sein du LIF-BCEAO');
  });

  it('ne présente pas DALA comme un établissement de paiement', () => {
    expect(LEGAL_NOTICE).not.toMatch(/établissement de paiement/i);
  });
});
