import { describe, expect, it } from 'vitest';
import { computeAuditHash, GENESIS_HASH, verifyAuditChain } from '../src/services/audit';
import { decide, heuristicProbability, type ScoringFeatures } from '../src/services/scoring';
import { matchesList } from '../src/services/sanctions';
import { addBusinessDays } from '../src/lib/businessDays';
import { nextContributionDate, potAmount } from '../src/services/tontine';

describe('piste d\'audit chaînée', () => {
  const t1 = new Date('2026-01-01T00:00:00Z');
  const t2 = new Date('2026-01-01T00:01:00Z');
  const h1 = computeAuditHash(GENESIS_HASH, { action: 'A', entity: 'X' }, t1);
  const h2 = computeAuditHash(h1, { action: 'B', entity: 'X' }, t2);
  const rows = [
    { seq: 1, userId: null, action: 'A', entity: 'X', entityId: null, payload: null, prevHash: GENESIS_HASH, hash: h1, createdAt: t1 },
    { seq: 2, userId: null, action: 'B', entity: 'X', entityId: null, payload: null, prevHash: h1, hash: h2, createdAt: t2 },
  ];
  it('valide une chaîne intacte', () => expect(verifyAuditChain(rows)).toEqual({ valid: true }));
  it('détecte une altération', () => {
    expect(verifyAuditChain([rows[0], { ...rows[1], action: 'TAMPERED' }])).toEqual({ valid: false, brokenAt: 2 });
  });
});

describe('scoring heuristique', () => {
  const base: ScoringFeatures = {
    account_age_days: 30, savings_balance: 0, savings_regularity: 0, tx_count_90d: 2, avg_monthly_inflow: 0,
    mobile_money_volume_90d: 0, loans_repaid: 0, loans_late: 0, tontine_on_time_ratio: 0.5, kyc_level: 1,
  };
  it('un bon épargnant score mieux qu\'un nouveau compte', () => {
    const good = { ...base, account_age_days: 365, savings_regularity: 1, savings_balance: 500_000, tx_count_90d: 80, loans_repaid: 3, kyc_level: 2 };
    expect(heuristicProbability(good)).toBeGreaterThan(heuristicProbability(base));
    expect(decide(heuristicProbability(good))).toBe('APPROVED');
  });
  it('les retards pénalisent', () => {
    expect(heuristicProbability({ ...base, loans_late: 2 })).toBeLessThan(heuristicProbability(base));
  });
});

describe('divers', () => {
  it('sanctions : correspondance insensible aux accents et à l\'ordre', () => {
    expect(matchesList('Jéan Dupont', ['dupont jean'])).toBe(true);
    expect(matchesList('Jean Martin', ['dupont jean'])).toBe(false);
  });
  it('jours ouvrés : 15 j depuis un lundi → lundi + 3 semaines', () => {
    const d = addBusinessDays(new Date('2026-03-02T10:00:00'), 15);
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(23);
  });
  it('tontine : cagnotte et prochaine date', () => {
    expect(potAmount(20_000, 5)).toBe(100_000);
    expect(nextContributionDate(new Date('2026-01-01'), 'WEEKLY', 2).toISOString().slice(0, 10)).toBe('2026-01-15');
  });
});

describe('canonicalJson', () => {
  it('produit le même hash quel que soit l\'ordre des clés (jsonb)', async () => {
    const { canonicalJson } = await import('../src/services/audit');
    expect(canonicalJson({ b: 1, a: { d: 2, c: [1, { z: 1, y: 2 }] } })).toBe(canonicalJson({ a: { c: [1, { y: 2, z: 1 }], d: 2 }, b: 1 }));
  });
});
