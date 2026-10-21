import type { Frequency } from '@prisma/client';

const DAYS: Record<Frequency, number> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 };

export function frequencyDays(f: Frequency): number {
  return DAYS[f];
}

/** Date de la prochaine cotisation : début de tontine + (cycle courant) périodes. */
export function nextContributionDate(createdAt: Date, frequency: Frequency, currentCycle: number): Date {
  return new Date(createdAt.getTime() + currentCycle * DAYS[frequency] * 86_400_000);
}

/** Montant perçu par le bénéficiaire d'un tour : cotisation × nombre de membres. */
export function potAmount(contribution: number, memberCount: number): number {
  return contribution * memberCount;
}

/** Le bénéficiaire du tour n est le membre en position n. */
export function beneficiaryPosition(currentCycle: number): number {
  return currentCycle;
}
