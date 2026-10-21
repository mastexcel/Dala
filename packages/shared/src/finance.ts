import {
  CROWDFUND_MIN_INVESTMENT,
  LOAN_DURATIONS,
  LOAN_FEE_RATE,
  LOAN_MAX,
  LOAN_MIN,
  LOAN_MIN_SCORE,
  LOAN_RATE_BEST,
  LOAN_RATE_WORST,
  LOAN_STEP,
  USURY_RATE,
  VAULT_OPTIONS,
} from './constants';
import type { LoanQuote, LoanScheduleItem } from './types';

const DAY_MS = 86_400_000;

export function roundFCFA(n: number): number {
  return Math.round(n);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/* ------------------------------------------------------------------ */
/* Micro-crédit                                                         */
/* ------------------------------------------------------------------ */

/** Taux nominal annuel interpolé selon le score DALA (0-100). */
export function loanAnnualRate(score: number): number {
  const s = clamp(score, 0, 100) / 100;
  return LOAN_RATE_WORST - (LOAN_RATE_WORST - LOAN_RATE_BEST) * s;
}

/** Montant maximal empruntable selon le score : 0 sous le seuil, puis croissance linéaire jusqu'à 500 000. */
export function eligibleLoanAmount(score: number): number {
  if (score < LOAN_MIN_SCORE) return 0;
  const ratio = (score - LOAN_MIN_SCORE) / (100 - LOAN_MIN_SCORE);
  const raw = LOAN_MIN + ratio * (LOAN_MAX - LOAN_MIN);
  return clamp(Math.floor(raw / LOAN_STEP) * LOAN_STEP, LOAN_MIN, LOAN_MAX);
}

export function isValidLoanAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= LOAN_MIN && amount <= LOAN_MAX && amount % LOAN_STEP === 0;
}

export function isValidLoanDuration(days: number): boolean {
  return (LOAN_DURATIONS as readonly number[]).includes(days);
}

/**
 * Devis de prêt conforme : intérêts simples prorata temporis (base 365),
 * frais de dossier plafonnés pour que le TAEG reste ≤ taux d'usure.
 * TAEG (approche actuarielle simplifiée, prêt in fine) = coût total / capital × 365 / durée.
 */
export function quoteLoan(amount: number, duration: number, score: number, now: Date = new Date()): LoanQuote {
  if (!isValidLoanAmount(amount)) throw new RangeError(`Montant invalide : ${amount}`);
  if (!isValidLoanDuration(duration)) throw new RangeError(`Durée invalide : ${duration}`);
  const annualRate = loanAnnualRate(score);
  const interest = roundFCFA((amount * annualRate * duration) / 365);
  const feeHeadroom = Math.floor((amount * (USURY_RATE - annualRate) * duration) / 365);
  const fees = Math.max(0, Math.min(roundFCFA(amount * LOAN_FEE_RATE), feeHeadroom - 1));
  const totalDue = amount + interest + fees;
  const taeg = ((interest + fees) / amount) * (365 / duration);
  const dueDate = new Date(now.getTime() + duration * DAY_MS).toISOString();
  return { amount, duration, annualRate, interest, fees, totalDue, taeg, dueDate };
}

/**
 * Échéancier : prêts ≤ 30 j remboursés in fine ; au-delà, mensualités égales (dernière ajustée).
 */
export function loanSchedule(totalDue: number, duration: number, start: Date, amountPaid = 0): LoanScheduleItem[] {
  const count = duration <= 30 ? 1 : Math.round(duration / 30);
  const base = Math.floor(totalDue / count);
  let remainingPaid = amountPaid;
  return Array.from({ length: count }, (_, i) => {
    const amount = i === count - 1 ? totalDue - base * (count - 1) : base;
    const days = count === 1 ? duration : (i + 1) * 30;
    const paid = remainingPaid >= amount;
    remainingPaid = Math.max(0, remainingPaid - amount);
    return { index: i + 1, dueDate: new Date(start.getTime() + days * DAY_MS).toISOString(), amount, paid };
  });
}

/* ------------------------------------------------------------------ */
/* Investissement                                                       */
/* ------------------------------------------------------------------ */

/** Intérêts d'un titre du marché monétaire UMOA (convention exact/360). */
export function bondInterest(amount: number, annualRate: number, days: number): number {
  return roundFCFA((amount * annualRate * days) / 360);
}

export function simulateBond(amount: number, annualRate: number, days: number) {
  const interest = bondInterest(amount, annualRate, days);
  return { amount, interest, total: amount + interest, effectiveYield: interest / amount };
}

/* ------------------------------------------------------------------ */
/* Épargne                                                              */
/* ------------------------------------------------------------------ */

export function vaultRate(months: number): number {
  const opt = VAULT_OPTIONS.find((o) => o.months === months);
  if (!opt) throw new RangeError(`Durée de coffre invalide : ${months}`);
  return opt.rate;
}

/** Intérêts acquis d'un coffre-fort au jour `at` (plafonnés à la date de déblocage). */
export function vaultAccruedInterest(amount: number, rate: number, createdAt: Date, unlockDate: Date, at: Date = new Date()): number {
  const end = Math.min(at.getTime(), unlockDate.getTime());
  const days = Math.max(0, (end - createdAt.getTime()) / DAY_MS);
  return roundFCFA((amount * rate * days) / 365);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Nombre de prélèvements nécessaires pour atteindre un objectif. */
export function savingsInstallments(remaining: number, perInstallment: number): number {
  if (perInstallment <= 0) return Infinity;
  return Math.ceil(Math.max(0, remaining) / perInstallment);
}

export function progressRatio(current: number, target: number): number {
  if (target <= 0) return 0;
  return clamp(current / target, 0, 1);
}

/* ------------------------------------------------------------------ */
/* Crowdfunding en capital                                              */
/* ------------------------------------------------------------------ */

/**
 * Part de capital reçue pour un ticket : ticket / valorisation post-money.
 * Renvoie un ratio (0.001 = 0,1 %).
 */
export function equityForInvestment(amount: number, valuation: number): number {
  if (valuation <= 0) return 0;
  return amount / valuation;
}

export function validateCrowdfundTicket(amount: number, fundingGoal: number, fundingRaised: number): string | null {
  if (!Number.isFinite(amount) || amount < CROWDFUND_MIN_INVESTMENT) {
    return `Le ticket minimum est de ${CROWDFUND_MIN_INVESTMENT} FCFA`;
  }
  if (amount > fundingGoal - fundingRaised) return "Le montant dépasse le reliquat de la levée";
  return null;
}
