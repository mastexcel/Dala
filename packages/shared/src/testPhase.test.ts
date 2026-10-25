import { describe, expect, it } from 'vitest';
import { ADVISOR_OPEN_TOPICS, CROWDFUND_VALIDATOR_DESIGNATED, LOAN_MAX, TEST_PHASE, VAULT_OPTIONS } from './constants';

describe('engagements de la phase de test (dossier LIF-BCEAO)', () => {
  it('limite le périmètre à l’épargne, au crédit et aux paiements', () => {
    expect(TEST_PHASE.modules).toEqual({ invest: false, crowdfund: false });
    expect(ADVISOR_OPEN_TOPICS).not.toContain('INVEST');
    expect(ADVISOR_OPEN_TOPICS).not.toContain('CROWDFUND');
    expect(ADVISOR_OPEN_TOPICS).not.toContain('BUSINESS');
  });

  it('reprend les plafonds du dossier', () => {
    expect(LOAN_MAX).toBe(100_000);
    expect(TEST_PHASE.limits).toEqual({
      loanMax: 100_000,
      maxUsers: 500,
      maxKycLevel: 2,
      maxTontines: 30,
      maxTontineMembers: 20,
      maxCreditOutstanding: 5_000_000,
      maxClientFunds: 30_000_000,
    });
  });

  it('ne rémunère pas l’épargne et coupe Wave et l’assistant IA', () => {
    expect(VAULT_OPTIONS.every((o) => o.rate === 0)).toBe(true);
    expect(TEST_PHASE.disabledProviders).toContain('WAVE');
    expect(TEST_PHASE.aiAssistant).toBe('off');
  });

  it('ne permet pas de rouvrir le crowdfunding sans cabinet de validation indépendant', () => {
    expect(TEST_PHASE.modules.crowdfund && !CROWDFUND_VALIDATOR_DESIGNATED).toBe(false);
  });
});
