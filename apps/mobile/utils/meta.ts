import type { ProjectSector, TransactionType } from '@dala/shared';
import { PROJECT_SECTORS, UEMOA_COUNTRIES } from '@dala/shared';
import { COLORS } from '@/theme';

export type TxCategory = 'savings' | 'invest' | 'crowdfund' | 'credit' | 'transfer';

export const TX_CATEGORY: Record<TransactionType, TxCategory> = {
  SAVINGS_IN: 'savings',
  SAVINGS_OUT: 'savings',
  INVESTMENT_BUY: 'invest',
  INVESTMENT_RETURN: 'invest',
  CROWDFUND_IN: 'crowdfund',
  CROWDFUND_RETURN: 'crowdfund',
  LOAN_DISBURSEMENT: 'credit',
  LOAN_REPAYMENT: 'credit',
  DEPOSIT: 'transfer',
  WITHDRAWAL: 'transfer',
  TRANSFER_IN: 'transfer',
  TRANSFER_OUT: 'transfer',
  ESCROW_HOLD: 'transfer',
  ESCROW_RELEASE: 'transfer',
  ESCROW_REFUND: 'transfer',
  FEE: 'transfer',
};

export const CATEGORY_COLOR: Record<TxCategory, string> = {
  savings: COLORS.green,
  invest: COLORS.blue,
  crowdfund: COLORS.purple,
  credit: COLORS.orange,
  transfer: COLORS.navy,
};

export const SECTOR_COLOR: Record<ProjectSector, string> = {
  AGRITECH: COLORS.green,
  SOLARTECH: COLORS.gold,
  FOODTECH: COLORS.orange,
  HEALTHTECH: COLORS.red,
  FINTECH: COLORS.blue,
  EDUTECH: COLORS.purple,
  LOGISTICS: COLORS.darkGray,
  OTHER: COLORS.midGray,
};

export function sectorLabel(s: ProjectSector) {
  const meta = PROJECT_SECTORS[s];
  return `${meta.label} ${meta.emoji}`;
}

export function countryFlag(code: string) {
  return UEMOA_COUNTRIES.find((c) => c.code === code)?.flag ?? '🏳️';
}

export function countryName(code: string) {
  return UEMOA_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export const FREQUENCY_LABEL = { DAILY: 'Quotidien', WEEKLY: 'Hebdomadaire', BIWEEKLY: 'Bimensuel', MONTHLY: 'Mensuel' } as const;

export const LOAN_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En analyse', color: COLORS.blue },
  APPROVED: { label: 'Approuvé', color: COLORS.green },
  DISBURSED: { label: 'En cours', color: COLORS.orange },
  REPAID: { label: 'Remboursé', color: COLORS.green },
  OVERDUE: { label: 'En retard', color: COLORS.red },
  DEFAULTED: { label: 'Impayé', color: COLORS.red },
  REJECTED: { label: 'Refusé', color: COLORS.midGray },
};
