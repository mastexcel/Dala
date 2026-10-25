import { describe, expect, it } from 'vitest';
import { LEGAL_NOTICE, TEST_PHASE_NOTICE } from './constants';

describe('mentions légales', () => {
  it('affiche le statut de phase de test au sein du LIF-BCEAO', () => {
    expect(TEST_PHASE_NOTICE).toBe('Service en phase de test au sein du LIF-BCEAO');
    expect(LEGAL_NOTICE).toContain(TEST_PHASE_NOTICE);
  });

  it('ne présente pas DALA comme un établissement de paiement', () => {
    expect(LEGAL_NOTICE).not.toMatch(/établissement/i);
  });
});
