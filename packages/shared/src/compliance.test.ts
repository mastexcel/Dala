import { describe, expect, it } from 'vitest';
import { ageOn, detectCiOperator, operatorMatchesPhone, checkKycLimit, evaluateAml, isStrongAuth, requiresStrongAuth } from './compliance';

describe('KYC', () => {
  it('bloque les transferts au niveau 1', () => {
    expect(checkKycLimit({ kycLevel: 1, monthToDateVolume: 0, amount: 1_000, isTransfer: true }).allowed).toBe(false);
  });
  it('applique le plafond mensuel du niveau 1', () => {
    expect(checkKycLimit({ kycLevel: 1, monthToDateVolume: 190_000, amount: 10_000 }).allowed).toBe(true);
    const r = checkKycLimit({ kycLevel: 1, monthToDateVolume: 190_000, amount: 20_000 });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.requiredLevel).toBe(2);
  });
  it('niveau 3 sans plafond', () => {
    expect(checkKycLimit({ kycLevel: 3, monthToDateVolume: 1e9, amount: 1e8 }).allowed).toBe(true);
  });
});

describe('Authentification forte', () => {
  it('exige 2 facteurs au-delà de 50 000 FCFA', () => {
    expect(requiresStrongAuth('PAYMENT', 50_000)).toBe(false);
    expect(requiresStrongAuth('PAYMENT', 50_001)).toBe(true);
    expect(requiresStrongAuth('LOGIN')).toBe(true);
    expect(isStrongAuth(['KNOWLEDGE', 'KNOWLEDGE'])).toBe(false);
    expect(isStrongAuth(['KNOWLEDGE', 'POSSESSION'])).toBe(true);
  });
});

describe('LBC/FT', () => {
  const now = new Date('2026-05-01T12:00:00Z');
  it('détecte le fractionnement', () => {
    const recent = [4_500_000, 4_200_000].map((amount, i) => ({ amount, createdAt: new Date(now.getTime() - (i + 1) * 3_600_000) }));
    expect(evaluateAml({ amount: 4_900_000, recent, now }).severity).toBe('RED');
  });
  it('signale les gros montants en orange', () => {
    expect(evaluateAml({ amount: 6_000_000, recent: [], now }).severity).toBe('ORANGE');
  });
  it('gèle en rouge sur liste de sanctions', () => {
    expect(evaluateAml({ amount: 100, recent: [], sanctionsHit: true, now }).severity).toBe('RED');
  });
  it('vert sinon', () => {
    expect(evaluateAml({ amount: 25_000, recent: [], now }).severity).toBe('GREEN');
  });
});

describe('ageOn', () => {
  it('calcule l’âge révolu et refuse les dates invalides', () => {
    const at = new Date('2026-10-25T12:00:00Z');
    expect(ageOn('2008-10-25', at)).toBe(18);
    expect(ageOn('2008-10-26', at)).toBe(17);
    expect(ageOn('1990-02-30', at)).toBeNaN();
    expect(ageOn('25/10/1990', at)).toBeNaN();
  });
});

describe('opérateurs mobile money en Côte d’Ivoire', () => {
  it('déduit l’opérateur du préfixe', () => {
    expect(detectCiOperator('+2250707000000')).toBe('ORANGE_MONEY');
    expect(detectCiOperator('+2250505000000')).toBe('MTN_MOMO');
    expect(detectCiOperator('+2250101000000')).toBe('MOOV_MONEY');
    expect(detectCiOperator('+2252720000000')).toBeNull();
    expect(detectCiOperator('+221770000000')).toBeNull();
  });

  it('vérifie la cohérence opérateur / numéro (Wave accepte tous les numéros)', () => {
    expect(operatorMatchesPhone('ORANGE_MONEY', '+2250707000000')).toBe(true);
    expect(operatorMatchesPhone('ORANGE_MONEY', '+2250505000000')).toBe(false);
    expect(operatorMatchesPhone('WAVE', '+2250505000000')).toBe(true);
    expect(operatorMatchesPhone('WAVE', '+221770000000')).toBe(false);
  });
});
