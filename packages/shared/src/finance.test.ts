import { describe, expect, it } from 'vitest';
import {
  bondInterest,
  eligibleLoanAmount,
  equityForInvestment,
  loanSchedule,
  loanTaeg,
  quoteLoan,
  validateCrowdfundTicket,
  vaultAccruedInterest,
} from './finance';
import { USURY_RATE } from './constants';
import { formatCompact, formatFCFA } from './format';

describe('quoteLoan', () => {
  it('respecte le taux d\'usure pour toutes les durées et tous les scores', () => {
    for (const duration of [7, 14, 30, 60, 90]) {
      for (const score of [30, 50, 75, 100]) {
        for (const amount of [5_000, 50_000, 100_000]) {
          const q = quoteLoan(amount, duration, score);
          expect(q.taeg).toBeLessThanOrEqual(USURY_RATE);
          expect(q.totalDue).toBe(amount + q.interest + q.fees);
        }
      }
    }
  });

  it('rejette les montants hors grille', () => {
    expect(() => quoteLoan(7_500, 30, 80)).toThrow(RangeError);
    // Plafond de la phase de test : 100 000 FCFA.
    expect(() => quoteLoan(105_000, 30, 80)).toThrow(RangeError);
    expect(() => quoteLoan(50_000, 45, 80)).toThrow(RangeError);
  });

  it('calcule le TAEG actuariel des prêts à mensualités', () => {
    // 100 000 FCFA, 3 mensualités de 35 000 : la valeur actuelle des échéances au taux de période
    // trouvé égale le capital prêté (≈ 2,48 % par 30 jours, soit ≈ 30,2 % l'an).
    const taeg = loanTaeg(100_000, 105_000, 90);
    const i = (taeg * 30) / 365;
    const pv = [1, 2, 3].reduce((sum, k) => sum + 35_000 / (1 + i) ** k, 0);
    expect(pv).toBeCloseTo(100_000, 2);
    expect(taeg).toBeCloseTo(0.3017, 3);
    // L'ancien calcul « in fine » aurait donné 20,3 % : il sous-estimait le coût réel.
    expect(loanTaeg(100_000, 105_000, 90)).toBeGreaterThan((5_000 / 100_000) * (365 / 90));
    // In fine : coût / capital × 365 / durée.
    expect(loanTaeg(100_000, 101_000, 30)).toBeCloseTo((1_000 / 100_000) * (365 / 30), 10);
  });

  it('réduit frais puis intérêts sur 90 jours pour rester sous l’usure', () => {
    const q = quoteLoan(100_000, 90, 30);
    expect(q.taeg).toBeLessThan(USURY_RATE);
    expect(loanTaeg(100_000, q.totalDue + 1, 90)).toBeGreaterThanOrEqual(USURY_RATE * 0.999);
  });

  it('applique un meilleur taux aux bons scores', () => {
    expect(quoteLoan(100_000, 30, 100).annualRate).toBeLessThan(quoteLoan(100_000, 30, 40).annualRate);
  });
});

describe('eligibleLoanAmount', () => {
  it('est nul sous le score minimal et plafonné à 100 000 pendant le test', () => {
    expect(eligibleLoanAmount(10)).toBe(0);
    expect(eligibleLoanAmount(30)).toBe(5_000);
    expect(eligibleLoanAmount(100)).toBe(100_000);
    expect(eligibleLoanAmount(65) % 5_000).toBe(0);
  });
});

describe('loanSchedule', () => {
  it('somme des échéances = total dû', () => {
    const s = loanSchedule(103_001, 90, new Date('2026-01-01'));
    expect(s).toHaveLength(3);
    expect(s.reduce((a, i) => a + i.amount, 0)).toBe(103_001);
  });
  it('marque les échéances payées', () => {
    const s = loanSchedule(90_000, 90, new Date('2026-01-01'), 30_000);
    expect(s.map((i) => i.paid)).toEqual([true, false, false]);
  });
});

describe('investissement & épargne', () => {
  it('calcule les intérêts d\'un bon du Trésor en base 360', () => {
    expect(bondInterest(100_000, 0.06, 360)).toBe(6_000);
    expect(bondInterest(100_000, 0.06, 182)).toBe(3_033);
  });
  it('plafonne les intérêts du coffre à la date de déblocage', () => {
    const c = new Date('2026-01-01');
    const u = new Date('2026-07-01');
    expect(vaultAccruedInterest(100_000, 0.045, c, u, new Date('2027-01-01'))).toBe(
      vaultAccruedInterest(100_000, 0.045, c, u, u),
    );
  });
});

describe('crowdfunding', () => {
  it('calcule l\'equity sur la valorisation post-money', () => {
    expect(equityForInvestment(50_000, 250_000_000)).toBeCloseTo(0.0002);
  });
  it('valide le ticket minimum et le reliquat', () => {
    expect(validateCrowdfundTicket(1_000, 50_000_000, 0)).not.toBeNull();
    expect(validateCrowdfundTicket(20_000_000, 50_000_000, 39_000_000)).not.toBeNull();
    expect(validateCrowdfundTicket(25_000, 50_000_000, 39_000_000)).toBeNull();
  });
});

describe('format', () => {
  it('formate en FCFA avec espaces fines', () => {
    expect(formatFCFA(247_500)).toBe('247 500 FCFA');
    expect(formatFCFA(12_500, { sign: true })).toBe('+12 500 FCFA');
    expect(formatCompact(39_000_000)).toBe('39M');
    expect(formatCompact(1_500)).toBe('1,5k');
  });
});
