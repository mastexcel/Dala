import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { CROWDFUND_VALIDATOR_DESIGNATED, TEST_PHASE, formatFCFA } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { isTest } from '../config';

/**
 * Engagements de la phase de test LIF-BCEAO, vérifiés côté serveur (l'écran n'est qu'un reflet).
 * Les valeurs viennent de `TEST_PHASE` (packages/shared) : une seule source pour l'app et l'API.
 */

type Tx = Prisma.TransactionClient;
type ModuleName = keyof typeof TEST_PHASE.modules;

/** Modules ouverts. Seuls les tests automatisés peuvent les rouvrir, pour vérifier le code désactivé. */
export const modules: Record<ModuleName, boolean> = { ...TEST_PHASE.modules };

export function setModuleForTests(name: ModuleName, enabled: boolean) {
  if (!isTest) throw new Error('Réservé aux tests automatisés');
  modules[name] = enabled;
}

if (modules.crowdfund && !CROWDFUND_VALIDATOR_DESIGNATED) {
  throw new Error('Le crowdfunding ne peut pas être ouvert sans cabinet de validation indépendant désigné.');
}

const limitReached = (message: string, details?: unknown) => new HttpError(409, message, 'TEST_LIMIT_REACHED', details);

/** Coupe les routes d'un module fermé pendant le test (investissement, crowdfunding). */
export function requireModule(name: ModuleName) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!modules[name]) return next(new HttpError(404, 'Service non disponible pendant la phase de test', 'MODULE_DISABLED'));
    next();
  };
}

export const isProviderEnabled = (provider: string) => !TEST_PHASE.disabledProviders.includes(provider);

/** Verrou transactionnel : sérialise les vérifications de plafonds globaux (évite les dépassements concurrents). */
async function lockLimits(tx: Tx, key: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
}
const LOCK = { users: 71_001, credit: 71_002, funds: 71_003, tontines: 71_004 } as const;

export async function assertUserCapacity(tx: Tx) {
  await lockLimits(tx, LOCK.users);
  const count = await tx.user.count({ where: { status: { not: 'CLOSED' } } });
  if (count >= TEST_PHASE.limits.maxUsers) {
    throw limitReached(`Les inscriptions sont fermées : la phase de test est limitée à ${TEST_PHASE.limits.maxUsers} utilisateurs.`);
  }
}

/** Restant dû sur les prêts décaissés. */
export async function creditOutstanding(db: Tx | typeof prisma = prisma) {
  const agg = await db.loan.aggregate({ where: { status: { in: ['DISBURSED', 'OVERDUE'] } }, _sum: { totalDue: true, amountPaid: true } });
  return num(agg._sum.totalDue ?? 0) - num(agg._sum.amountPaid ?? 0);
}

export async function assertCreditCapacity(tx: Tx, amount: number) {
  await lockLimits(tx, LOCK.credit);
  const outstanding = await creditOutstanding(tx);
  if (outstanding + amount > TEST_PHASE.limits.maxCreditOutstanding) {
    throw limitReached(`Encours de crédit de la phase de test atteint (${formatFCFA(TEST_PHASE.limits.maxCreditOutstanding)}). Réessayez plus tard.`);
  }
}

/** Fonds clients : soldes cumulés de tous les comptes, plus les dépôts en attente de confirmation. */
export async function clientFunds(db: Tx | typeof prisma = prisma) {
  const [balances, pending] = await Promise.all([
    db.account.aggregate({ _sum: { balance: true } }),
    db.transaction.aggregate({ where: { type: 'DEPOSIT', status: 'PENDING' }, _sum: { amount: true } }),
  ]);
  return num(balances._sum.balance ?? 0) + num(pending._sum.amount ?? 0);
}

export async function assertClientFundsCapacity(tx: Tx, amount: number) {
  await lockLimits(tx, LOCK.funds);
  if ((await clientFunds(tx)) + amount > TEST_PHASE.limits.maxClientFunds) {
    throw limitReached(`Le total des fonds de la phase de test (${formatFCFA(TEST_PHASE.limits.maxClientFunds)}) est atteint : dépôt impossible pour le moment.`);
  }
}

export async function assertTontineCapacity(tx: Tx) {
  await lockLimits(tx, LOCK.tontines);
  const open = await tx.tontine.count({ where: { status: { in: ['PENDING', 'ACTIVE'] } } });
  if (open >= TEST_PHASE.limits.maxTontines) {
    throw limitReached(`La phase de test est limitée à ${TEST_PHASE.limits.maxTontines} tontines en cours.`);
  }
}

/** Suivi des plafonds (rapport mensuel BCEAO). */
export async function testPhaseUsage() {
  const [users, credit, funds, tontines, maxKyc] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'CLOSED' } } }),
    creditOutstanding(),
    clientFunds(),
    prisma.tontine.count({ where: { status: { in: ['PENDING', 'ACTIVE'] } } }),
    prisma.user.aggregate({ _max: { kycLevel: true } }),
  ]);
  const l = TEST_PHASE.limits;
  const line = (used: number, limit: number) => ({ used, limit, ratio: limit ? used / limit : 0, ok: used <= limit });
  return {
    users: line(users, l.maxUsers),
    creditOutstanding: line(credit, l.maxCreditOutstanding),
    clientFunds: line(funds, l.maxClientFunds),
    openTontines: line(tontines, l.maxTontines),
    maxKycLevel: line(maxKyc._max.kycLevel ?? 1, l.maxKycLevel),
    loanMax: l.loanMax,
    maxTontineMembers: l.maxTontineMembers,
  };
}
