import {
  AML_LARGE_TRANSACTION,
  AML_STRUCTURING_MIN_COUNT,
  AML_STRUCTURING_RATIO,
  AML_STRUCTURING_WINDOW_HOURS,
  AML_VELOCITY_MAX_PER_HOUR,
  KYC_LIMITS,
  STRONG_AUTH_THRESHOLD,
} from './constants';
import type { KycLevel } from './types';

/* ------------------------------------------------------------------ */
/* KYC — plafonds (Art. 27-31)                                          */
/* ------------------------------------------------------------------ */

export interface KycCheckInput {
  kycLevel: KycLevel;
  monthToDateVolume: number;
  amount: number;
  isTransfer?: boolean;
}

export type KycCheckResult = { allowed: true } | { allowed: false; reason: string; requiredLevel: KycLevel };

export function checkKycLimit({ kycLevel, monthToDateVolume, amount, isTransfer }: KycCheckInput): KycCheckResult {
  const rule = KYC_LIMITS[kycLevel];
  if (isTransfer && !rule.transfersAllowed) {
    return { allowed: false, reason: 'Les transferts nécessitent un KYC de niveau 2', requiredLevel: 2 };
  }
  if (rule.monthlyLimit !== null && monthToDateVolume + amount > rule.monthlyLimit) {
    const next = (kycLevel + 1) as KycLevel;
    return {
      allowed: false,
      reason: `Plafond mensuel de ${rule.monthlyLimit} FCFA atteint pour le niveau ${kycLevel}`,
      requiredLevel: next,
    };
  }
  return { allowed: true };
}

/* ------------------------------------------------------------------ */
/* Authentification forte (Art. 84)                                     */
/* ------------------------------------------------------------------ */

export type AuthFactor = 'KNOWLEDGE' | 'POSSESSION' | 'INHERENCE';

export type SensitiveOperation = 'LOGIN' | 'PAYMENT' | 'PROFILE_UPDATE' | 'ADD_BENEFICIARY';

export function requiresStrongAuth(op: SensitiveOperation, amount = 0): boolean {
  if (op === 'PAYMENT') return amount > STRONG_AUTH_THRESHOLD;
  return true;
}

/** Au moins deux catégories de facteurs distinctes. */
export function isStrongAuth(factors: AuthFactor[]): boolean {
  return new Set(factors).size >= 2;
}

/* ------------------------------------------------------------------ */
/* LBC/FT — détection de transactions suspectes                         */
/* ------------------------------------------------------------------ */

export type AmlSeverity = 'GREEN' | 'ORANGE' | 'RED';

export interface AmlAlert {
  rule: 'LARGE_AMOUNT' | 'STRUCTURING' | 'VELOCITY' | 'SANCTIONS';
  severity: AmlSeverity;
  message: string;
}

export interface AmlContext {
  amount: number;
  /** Transactions sortantes/entrantes récentes de l'utilisateur (montant + date). */
  recent: { amount: number; createdAt: Date }[];
  sanctionsHit?: boolean;
  now?: Date;
}

export function evaluateAml({ amount, recent, sanctionsHit, now = new Date() }: AmlContext): { severity: AmlSeverity; alerts: AmlAlert[] } {
  const alerts: AmlAlert[] = [];
  if (sanctionsHit) {
    alerts.push({ rule: 'SANCTIONS', severity: 'RED', message: 'Correspondance sur une liste de sanctions' });
  }
  if (amount >= AML_LARGE_TRANSACTION) {
    alerts.push({ rule: 'LARGE_AMOUNT', severity: 'ORANGE', message: 'Opération au-delà du seuil de déclaration' });
  }
  const windowStart = now.getTime() - AML_STRUCTURING_WINDOW_HOURS * 3_600_000;
  const nearThreshold = [...recent, { amount, createdAt: now }].filter(
    (t) =>
      t.createdAt.getTime() >= windowStart &&
      t.amount >= AML_LARGE_TRANSACTION * AML_STRUCTURING_RATIO &&
      t.amount < AML_LARGE_TRANSACTION,
  );
  if (nearThreshold.length >= AML_STRUCTURING_MIN_COUNT) {
    alerts.push({ rule: 'STRUCTURING', severity: 'RED', message: 'Fractionnement suspect sous le seuil de déclaration' });
  }
  const lastHour = recent.filter((t) => t.createdAt.getTime() >= now.getTime() - 3_600_000).length + 1;
  if (lastHour > AML_VELOCITY_MAX_PER_HOUR) {
    alerts.push({ rule: 'VELOCITY', severity: 'ORANGE', message: 'Fréquence de transactions anormale' });
  }
  const severity: AmlSeverity = alerts.some((a) => a.severity === 'RED')
    ? 'RED'
    : alerts.length > 0
      ? 'ORANGE'
      : 'GREEN';
  return { severity, alerts };
}
