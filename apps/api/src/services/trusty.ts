import type { Escrow, EscrowActor, EscrowStatus, Prisma } from '@prisma/client';
import { formatFCFA } from '@dala/shared';
import { prisma, num, type Tx } from '../lib/prisma';
import { conflict } from '../lib/errors';
import { appendAudit } from './audit';
import { debitWithoutStatement, post } from './ledger';
import { emitBalanceChanged, notify } from './notifications';

/** Trusty : mouvements de fonds du séquestre, communs aux participants, au médiateur et aux tâches planifiées. */

export const addEvent = (t: Tx, escrowId: string, actor: EscrowActor, type: string, message: string) =>
  t.escrowEvent.create({ data: { escrowId, actor, type, message } });

/** Changement d'étape atomique : échoue si l'étape a changé entre-temps (double clic, tâche planifiée…). */
export async function transition(t: Tx, id: string, from: EscrowStatus[], data: Prisma.EscrowUpdateManyMutationInput) {
  const done = await t.escrow.updateMany({ where: { id, status: { in: from } }, data });
  if (!done.count) throw conflict('Cette transaction a changé d’étape. Actualisez.', 'ESCROW_STATE');
}

/**
 * Dénouement : part du vendeur versée depuis les fonds bloqués de l'acheteur, reste remboursé.
 * Doit être appelé dans la transaction qui fait passer le séquestre à RELEASED ou REFUNDED.
 */
export async function settle(t: Tx, e: Escrow, sellerAmount: number) {
  const amount = num(e.amount);
  const buyerAmount = amount - sellerAmount;
  if (sellerAmount > 0) {
    await debitWithoutStatement(t, e.buyerId, 'ESCROW', sellerAmount, { action: 'ESCROW_PAYOUT', entity: 'Escrow', entityId: e.id });
    await post(t, { userId: e.sellerId, type: 'ESCROW_RELEASE', amount: sellerAmount, description: `Trusty · ${e.title}`, from: null, to: 'MAIN', metadata: { escrowId: e.id } });
  }
  if (buyerAmount > 0) {
    await post(t, { userId: e.buyerId, type: 'ESCROW_REFUND', amount: buyerAmount, description: `Remboursement Trusty · ${e.title}`, from: 'ESCROW', to: 'MAIN', metadata: { escrowId: e.id } });
  }
  await appendAudit(t, { userId: e.buyerId, action: 'ESCROW_SETTLED', entity: 'Escrow', entityId: e.id, payload: { amount, sellerAmount, buyerAmount } });
  return { sellerAmount, buyerAmount };
}

/** Notifie les deux participants après un dénouement et rafraîchit leurs soldes. */
export async function notifySettlement(e: Escrow, sellerAmount: number) {
  const buyerAmount = num(e.amount) - sellerAmount;
  const data = { escrowId: e.id };
  await Promise.all([
    sellerAmount > 0
      ? notify(e.sellerId, { title: 'Paiement Trusty reçu 💸', body: `${formatFCFA(sellerAmount)} versés pour « ${e.title} »`, type: 'TRANSACTION', data })
      : notify(e.sellerId, { title: 'Transaction Trusty remboursée', body: `« ${e.title} » : les fonds ont été rendus à l'acheteur.`, type: 'TRANSACTION', data }),
    buyerAmount > 0
      ? notify(e.buyerId, { title: 'Remboursement Trusty', body: `${formatFCFA(buyerAmount)} rendus pour « ${e.title} »`, type: 'TRANSACTION', data })
      : notify(e.buyerId, { title: 'Transaction Trusty terminée', body: `${formatFCFA(sellerAmount)} versés au vendeur pour « ${e.title} »`, type: 'TRANSACTION', data }),
  ]);
  emitBalanceChanged(e.buyerId);
  emitBalanceChanged(e.sellerId);
}

/** Verse tout au vendeur (confirmation, code de remise, fin du délai de vérification). */
export async function releaseToSeller(e: Escrow, actor: EscrowActor, message: string, from: EscrowStatus[] = ['FUNDED', 'DELIVERED']) {
  await prisma.$transaction(async (t) => {
    await transition(t, e.id, from, { status: 'RELEASED', closedAt: new Date() });
    await settle(t, e, num(e.amount));
    await addEvent(t, e.id, actor, 'RELEASED', message);
  });
  await notifySettlement(e, num(e.amount));
}

/** Rembourse tout à l'acheteur (geste du vendeur, délai de livraison dépassé). */
export async function refundBuyer(e: Escrow, actor: EscrowActor, message: string, from: EscrowStatus[]) {
  await prisma.$transaction(async (t) => {
    await transition(t, e.id, from, { status: 'REFUNDED', closedAt: new Date() });
    await settle(t, e, 0);
    await addEvent(t, e.id, actor, 'REFUNDED', message);
  });
  await notifySettlement(e, 0);
}
