import { RETENTION_YEARS_AFTER_CLOSURE, WITHDRAWAL_PERIOD_HOURS, formatFCFA } from '@dala/shared';
import type { Frequency } from '@prisma/client';
import { prisma, num } from '../lib/prisma';
import { logger } from '../lib/logger';
import { post } from '../services/ledger';
import { notify } from '../services/notifications';
import { refreshCreditScore } from '../services/scoring';
import { reconcileSafeguarding } from '../services/reporting';
import { appendAudit } from '../services/audit';
import { frequencyDays } from '../services/tontine';
import { bondInterest } from '@dala/shared';

/** Prélèvement automatique des objectifs d'épargne arrivés à échéance de fréquence. */
export async function runAutoSave(now = new Date()) {
  const goals = await prisma.savingsGoal.findMany({ where: { autoSave: true, frequency: { not: null }, autoAmount: { not: null } } });
  let processed = 0;
  for (const g of goals) {
    const last = await prisma.transaction.findFirst({
      where: { userId: g.userId, type: 'SAVINGS_IN', metadata: { path: ['goalId'], equals: g.id } },
      orderBy: { createdAt: 'desc' },
    });
    const periodMs = frequencyDays(g.frequency as Frequency) * 86_400_000;
    if (last && now.getTime() - last.createdAt.getTime() < periodMs) continue;
    const remaining = num(g.targetAmount) - num(g.currentAmount);
    const amount = Math.min(num(g.autoAmount), remaining);
    if (amount <= 0) continue;
    try {
      await prisma.$transaction(async (tx) => {
        await post(tx, { userId: g.userId, type: 'SAVINGS_IN', amount, description: `Épargne auto · ${g.name}`, from: 'MAIN', to: 'SAVINGS', metadata: { goalId: g.id, auto: true } });
        await tx.savingsGoal.update({ where: { id: g.id }, data: { currentAmount: { increment: amount } } });
      });
      processed++;
      await notify(g.userId, { title: 'Épargne automatique', body: `${formatFCFA(amount)} versés sur « ${g.name} »`, type: 'SAVINGS' });
    } catch (err) {
      await notify(g.userId, { title: 'Épargne automatique non effectuée', body: `Solde insuffisant pour « ${g.name} ». Rechargez votre compte.`, type: 'SAVINGS' });
      logger.info({ goalId: g.id, err: (err as Error).message }, 'Auto-save ignoré');
    }
  }
  return processed;
}

/** Libère les coffres-forts arrivés à échéance (capital + intérêts vers le compte principal). */
export async function releaseVaults(now = new Date()) {
  const due = await prisma.vault.findMany({ where: { released: false, unlockDate: { lte: now } } });
  for (const v of due) {
    const amount = num(v.amount);
    const interest = Math.round((amount * num(v.rate) * (v.unlockDate.getTime() - v.createdAt.getTime())) / (365 * 86_400_000));
    await prisma.$transaction(async (tx) => {
      await tx.vault.update({ where: { id: v.id }, data: { released: true } });
      await post(tx, { userId: v.userId, type: 'SAVINGS_OUT', amount, description: 'Déblocage coffre-fort', from: 'VAULT', to: 'MAIN', metadata: { vaultId: v.id } });
      if (interest > 0) {
        await post(tx, { userId: v.userId, type: 'INVESTMENT_RETURN', amount: interest, description: 'Intérêts coffre-fort', from: null, to: 'MAIN', metadata: { vaultId: v.id } });
      }
    });
    await notify(v.userId, { title: 'Coffre-fort débloqué 🎉', body: `${formatFCFA(amount + interest)} crédités sur votre compte.`, type: 'SAVINGS' });
  }
  return due.length;
}

/** Fin du délai de rétractation : confirmation des investissements crowdfunding. */
export async function confirmCrowdfundInvestments(now = new Date()) {
  const cutoff = new Date(now.getTime() - WITHDRAWAL_PERIOD_HOURS * 3_600_000);
  const res = await prisma.crowdfundInvestment.updateMany({ where: { status: 'PENDING', createdAt: { lte: cutoff } }, data: { status: 'CONFIRMED' } });
  return res.count;
}

/** Remboursement des titres arrivés à maturité. */
export async function settleMaturedInvestments(now = new Date()) {
  const due = await prisma.investment.findMany({ where: { status: 'ACTIVE', maturityDate: { lte: now }, type: { in: ['TREASURY_BOND', 'SUKUK'] } } });
  for (const inv of due) {
    const amount = num(inv.amount);
    const days = Math.round((inv.maturityDate.getTime() - inv.createdAt.getTime()) / 86_400_000);
    const interest = bondInterest(amount, num(inv.rate), days);
    await prisma.$transaction(async (tx) => {
      await tx.investment.update({ where: { id: inv.id }, data: { status: 'MATURED' } });
      await post(tx, { userId: inv.userId, type: 'INVESTMENT_RETURN', amount, description: 'Remboursement titre à maturité', from: 'INVESTMENT', to: 'MAIN', metadata: { investmentId: inv.id } });
      if (interest > 0) {
        await post(tx, { userId: inv.userId, type: 'INVESTMENT_RETURN', amount: interest, description: 'Intérêts titre public', from: null, to: 'MAIN', metadata: { investmentId: inv.id } });
      }
    });
    await notify(inv.userId, { title: 'Placement arrivé à échéance', body: `${formatFCFA(amount + interest)} crédités.`, type: 'INVEST' });
  }
  return due.length;
}

/** Passage en retard des prêts échus non remboursés. */
export async function markOverdueLoans(now = new Date()) {
  const overdue = await prisma.loan.findMany({ where: { status: 'DISBURSED', dueDate: { lt: now } } });
  for (const l of overdue) {
    await prisma.loan.update({ where: { id: l.id }, data: { status: 'OVERDUE' } });
    await notify(l.userId, { title: 'Échéance dépassée', body: 'Votre prêt est en retard. Remboursez dès que possible pour préserver votre score.', type: 'CREDIT' });
  }
  return overdue.length;
}

/** Relance des réclamations proches de l'échéance des 15 jours ouvrés. */
export async function complaintSlaWatch(now = new Date()) {
  const soon = new Date(now.getTime() + 2 * 86_400_000);
  const list = await prisma.complaint.findMany({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, dueBy: { lte: soon } } });
  if (list.length) logger.warn({ count: list.length }, 'Réclamations proches du délai réglementaire');
  return list.length;
}

export async function rescoreUser(userId: string) {
  return refreshCreditScore(userId);
}

export async function dailyReconciliation() {
  const r = await reconcileSafeguarding();
  if (!r.ok) logger.error({ r }, 'ÉCART DE CANTONNEMENT détecté');
  return r;
}

/**
 * Fin de la durée légale de conservation (LBC/FT) : les comptes clôturés depuis plus de
 * RETENTION_YEARS_AFTER_CLOSURE ans sont anonymisés. Les montants restent pour les statistiques.
 */
export async function purgeExpiredAccounts(now = new Date()) {
  const limit = new Date(now);
  limit.setFullYear(limit.getFullYear() - RETENTION_YEARS_AFTER_CLOSURE);
  const expired = await prisma.user.findMany({ where: { status: 'CLOSED', closedAt: { lt: limit }, NOT: { firstName: 'Anonymisé' } }, select: { id: true } });
  for (const { id } of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          firstName: 'Anonymisé', lastName: '-', phone: `purge-${id}`, email: null,
          dateOfBirth: null, avatarUrl: null, pushToken: null,
        },
      });
      await tx.$executeRaw`UPDATE "User" SET "kycDocuments" = NULL WHERE id = ${id}`;
      await tx.advisorMessage.updateMany({ where: { conversation: { userId: id }, sender: 'USER' }, data: { body: '[supprimé]' } });
      await appendAudit(tx, { userId: id, action: 'DATA_PURGED', entity: 'User', entityId: id });
    });
  }
  return expired.length;
}
