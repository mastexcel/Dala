import { prisma, num } from '../lib/prisma';
import { config } from '../config';
import { verifyAuditChain } from './audit';

/**
 * Réconciliation quotidienne du cantonnement (Art. 48-51) :
 * somme des soldes clients par type vs. solde des comptes bancaires dédiés.
 */
export async function reconcileSafeguarding() {
  const groups = await prisma.account.groupBy({ by: ['type'], _sum: { balance: true } });
  const ledger = (t: string) => num(groups.find((g) => g.type === t)?._sum.balance ?? 0);
  const lines = [
    { pool: 'MAIN', ledger: ledger('MAIN'), bank: config.SAFEGUARD_BALANCE_MAIN },
    { pool: 'SAVINGS', ledger: ledger('SAVINGS') + ledger('VAULT'), bank: config.SAFEGUARD_BALANCE_SAVINGS },
    { pool: 'INVEST', ledger: ledger('INVESTMENT'), bank: config.SAFEGUARD_BALANCE_INVEST },
    { pool: 'CROWDFUND', ledger: ledger('CROWDFUND'), bank: config.SAFEGUARD_BALANCE_CROWDFUND },
  ].map((l) => ({ ...l, gap: l.bank - l.ledger, ok: l.bank >= l.ledger }));
  return { date: new Date().toISOString(), lines, ok: lines.every((l) => l.ok) };
}

/** Reporting réglementaire mensuel (agrégats transmis à la BCEAO). */
export async function bceaoMonthlyReport(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const [byType, usersByKyc, activeUsers, alerts, complaints, loans] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['type'],
      where: { createdAt: { gte: start, lt: end }, status: 'COMPLETED' },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.user.groupBy({ by: ['kycLevel'], _count: { _all: true } }),
    prisma.transaction.findMany({ where: { createdAt: { gte: start, lt: end } }, distinct: ['userId'], select: { userId: true } }),
    prisma.amlAlert.groupBy({ by: ['severity'], where: { createdAt: { gte: start, lt: end } }, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ['status'], where: { createdAt: { gte: start, lt: end } }, _count: { _all: true } }),
    prisma.loan.groupBy({ by: ['status'], where: { createdAt: { gte: start, lt: end } }, _count: { _all: true }, _sum: { amount: true } }),
  ]);
  const auditRows = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    institution: 'DALA Finance',
    currency: 'XOF',
    transactions: byType.map((t) => ({ type: t.type, count: t._count._all, volume: Math.abs(num(t._sum.amount)) })),
    customers: { byKycLevel: usersByKyc.map((u) => ({ level: u.kycLevel, count: u._count._all })), activeInPeriod: activeUsers.length },
    aml: alerts.map((a) => ({ severity: a.severity, count: a._count._all })),
    complaints: complaints.map((c) => ({ status: c.status, count: c._count._all })),
    credit: loans.map((l) => ({ status: l.status, count: l._count._all, volume: num(l._sum.amount) })),
    safeguarding: await reconcileSafeguarding(),
    auditChain: verifyAuditChain(auditRows),
  };
}
