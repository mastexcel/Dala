import type { Prisma } from '@prisma/client';
import { badRequest } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { appendAudit } from './audit';
import { post } from './ledger';
import { getProvider, type MobileMoneyProviderId } from './mobileMoney';

interface PayoutInput {
  userId: string;
  provider: MobileMoneyProviderId;
  /** Numéro mobile money crédité (celui de l'utilisateur ou d'un tiers). */
  phone: string;
  amount: number;
  type: 'WITHDRAWAL' | 'TRANSFER_OUT';
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Décaissement vers un wallet mobile money : débit d'abord (évite le double paiement), puis appel à
 * l'opérateur ; le compte est recrédité si l'opérateur refuse.
 */
export async function payoutToMobileMoney(input: PayoutInput) {
  const p = getProvider(input.provider);
  const tx = await prisma.$transaction((t) =>
    post(t, {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      from: 'MAIN',
      to: null,
      status: 'PENDING',
      metadata: { provider: input.provider, toPhone: input.phone, ...(input.metadata ?? {}) } as Prisma.InputJsonValue,
    }),
  );
  const result = await p.withdraw(input.phone, input.amount, tx.reference ?? tx.id);
  if (result.status === 'FAILED') {
    await prisma.$transaction(async (t) => {
      await t.transaction.update({ where: { id: tx.id }, data: { status: 'FAILED' } });
      await t.account.updateMany({ where: { userId: input.userId, type: 'MAIN' }, data: { balance: { increment: input.amount } } });
      await appendAudit(t, { userId: input.userId, action: 'LEDGER_WITHDRAWAL_REVERSED', entity: 'Transaction', entityId: tx.id, payload: { amount: input.amount } });
    });
    throw badRequest(result.message ?? "Opération refusée par l'opérateur", 'PROVIDER_FAILED');
  }
  if (result.status === 'SUCCESS') await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED' } });
  return { status: result.status, transactionId: tx.id, providerName: p.name };
}
