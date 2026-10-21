import type { Prisma } from '@prisma/client';
import { ML_APPROVE_THRESHOLD, ML_REVIEW_THRESHOLD, type LoanDecision } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { config } from '../config';
import { logger } from '../lib/logger';

export interface ScoringFeatures {
  account_age_days: number;
  savings_balance: number;
  savings_regularity: number; // part des 12 dernières semaines avec au moins un dépôt d'épargne
  tx_count_90d: number;
  avg_monthly_inflow: number;
  mobile_money_volume_90d: number;
  loans_repaid: number;
  loans_late: number;
  tontine_on_time_ratio: number;
  kyc_level: number;
}

const WEEK = 7 * 86_400_000;

export async function buildFeatures(userId: string, now = new Date()): Promise<ScoringFeatures> {
  const since90 = new Date(now.getTime() - 90 * 86_400_000);
  const since12w = new Date(now.getTime() - 12 * WEEK);
  const [user, txs, savingsTx, loans, tontines, savingsAcc] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.transaction.findMany({ where: { userId, createdAt: { gte: since90 }, status: 'COMPLETED' } }),
    prisma.transaction.findMany({ where: { userId, type: 'SAVINGS_IN', createdAt: { gte: since12w } }, select: { createdAt: true } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.tontineMember.findMany({ where: { userId } }),
    prisma.account.findFirst({ where: { userId, type: 'SAVINGS' } }),
  ]);
  const weeks = new Set(savingsTx.map((t) => Math.floor((now.getTime() - t.createdAt.getTime()) / WEEK)));
  const inflow = txs.filter((t) => num(t.amount) > 0 && t.type !== 'LOAN_DISBURSEMENT').reduce((s, t) => s + num(t.amount), 0);
  const mm = txs.filter((t) => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL').reduce((s, t) => s + Math.abs(num(t.amount)), 0);
  return {
    account_age_days: Math.floor((now.getTime() - user.createdAt.getTime()) / 86_400_000),
    savings_balance: num(savingsAcc?.balance),
    savings_regularity: weeks.size / 12,
    tx_count_90d: txs.length,
    avg_monthly_inflow: inflow / 3,
    mobile_money_volume_90d: mm,
    loans_repaid: loans.filter((l) => l.status === 'REPAID').length,
    loans_late: loans.filter((l) => l.status === 'OVERDUE' || l.status === 'DEFAULTED').length,
    tontine_on_time_ratio: tontines.length ? tontines.filter((t) => t.hasPaid).length / tontines.length : 0.5,
    kyc_level: user.kycLevel,
  };
}

/**
 * Repli heuristique si le micro-service ML est indisponible : régression logistique
 * à coefficients fixes, volontairement prudente.
 */
export function heuristicProbability(f: ScoringFeatures): number {
  const z =
    -1.2 +
    0.004 * Math.min(f.account_age_days, 365) +
    1.6 * f.savings_regularity +
    0.000004 * Math.min(f.savings_balance, 500_000) +
    0.012 * Math.min(f.tx_count_90d, 100) +
    0.0000015 * Math.min(f.avg_monthly_inflow, 1_000_000) +
    0.35 * Math.min(f.loans_repaid, 5) -
    1.4 * f.loans_late +
    0.8 * (f.tontine_on_time_ratio - 0.5) +
    0.25 * (f.kyc_level - 1);
  return 1 / (1 + Math.exp(-z));
}

export async function scoreProbability(features: ScoringFeatures): Promise<{ probability: number; source: 'ml' | 'heuristic'; modelVersion?: string }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2_000);
    const res = await fetch(`${config.ML_SERVICE_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`ML ${res.status}`);
    const body = (await res.json()) as { probability: number; model_version: string };
    return { probability: body.probability, source: 'ml', modelVersion: body.model_version };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Scoring ML indisponible — repli heuristique');
    return { probability: heuristicProbability(features), source: 'heuristic' };
  }
}

export function decide(probability: number): LoanDecision {
  if (probability >= ML_APPROVE_THRESHOLD) return 'APPROVED';
  if (probability >= ML_REVIEW_THRESHOLD) return 'MANUAL_REVIEW';
  return 'REJECTED';
}

/** Recalcule et persiste le score DALA (0-100). */
export async function refreshCreditScore(userId: string) {
  const features = await buildFeatures(userId);
  const result = await scoreProbability(features);
  const score = Math.round(result.probability * 100);
  await prisma.user.update({ where: { id: userId }, data: { creditScore: score } });
  return { score, ...result, features: features as unknown as Prisma.InputJsonValue };
}
