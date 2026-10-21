import type { AccountType, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { prisma, num, type Tx } from '../lib/prisma';
import { badRequest } from '../lib/errors';
import { transactionReference } from '../lib/crypto';
import { appendAudit } from './audit';

export const USER_ACCOUNT_TYPES: AccountType[] = ['MAIN', 'SAVINGS', 'VAULT', 'INVESTMENT', 'CROWDFUND'];

export async function ensureAccounts(tx: Tx, userId: string) {
  const existing = await tx.account.findMany({ where: { userId } });
  const missing = USER_ACCOUNT_TYPES.filter((t) => !existing.some((a) => a.type === t));
  if (missing.length) {
    await tx.account.createMany({ data: missing.map((type) => ({ userId, type })) });
  }
}

async function getAccount(tx: Tx, userId: string, type: AccountType) {
  const acc = await tx.account.findFirst({ where: { userId, type, isActive: true } });
  if (!acc) throw badRequest(`Compte ${type} introuvable`);
  return acc;
}

export interface PostingInput {
  userId: string;
  type: TransactionType;
  /** Montant positif de l'opération. */
  amount: number;
  description: string;
  /** Compte débité (null = entrée externe : mobile money, prêt…). */
  from: AccountType | null;
  /** Compte crédité (null = sortie externe). */
  to: AccountType | null;
  status?: TransactionStatus;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Écriture comptable atomique : mouvements de soldes + transaction + piste d'audit.
 * Le montant affiché à l'utilisateur est signé du point de vue du portefeuille principal :
 * négatif si l'argent quitte le compte MAIN, positif s'il y entre.
 */
export async function post(tx: Tx, input: PostingInput) {
  const { userId, amount, from, to } = input;
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest('Montant invalide');

  if (from) {
    const acc = await getAccount(tx, userId, from);
    // Décrément conditionnel : empêche un solde négatif même en cas de concurrence.
    const updated = await tx.account.updateMany({
      where: { id: acc.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (updated.count === 0) throw badRequest('Solde insuffisant', 'INSUFFICIENT_FUNDS');
  }
  if (to) {
    const acc = await getAccount(tx, userId, to);
    await tx.account.update({ where: { id: acc.id }, data: { balance: { increment: amount } } });
  }

  const signed = to === 'MAIN' || from === null ? amount : -amount;
  const transaction = await tx.transaction.create({
    data: {
      userId,
      type: input.type,
      amount: signed,
      description: input.description,
      reference: transactionReference(),
      status: input.status ?? 'COMPLETED',
      metadata: { ...(input.metadata as object | undefined), from, to } as Prisma.InputJsonValue,
    },
  });
  await appendAudit(tx, {
    userId,
    action: `LEDGER_${input.type}`,
    entity: 'Transaction',
    entityId: transaction.id,
    payload: { amount, from, to, reference: transaction.reference },
  });
  return transaction;
}

export function postInTransaction(input: PostingInput) {
  return prisma.$transaction((tx) => post(tx, input));
}

export async function balances(userId: string) {
  const accounts = await prisma.account.findMany({ where: { userId, isActive: true } });
  const by = (t: AccountType) => num(accounts.find((a) => a.type === t)?.balance);
  return {
    MAIN: by('MAIN'),
    SAVINGS: by('SAVINGS'),
    VAULT: by('VAULT'),
    INVESTMENT: by('INVESTMENT'),
    CROWDFUND: by('CROWDFUND'),
  };
}
