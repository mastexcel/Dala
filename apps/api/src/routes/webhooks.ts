import { Router } from 'express';
import { z } from 'zod';
import { formatFCFA } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, notFound, unauthorized } from '../lib/errors';
import { validate } from '../middleware/validate';
import { emitBalanceChanged, notify } from '../services/notifications';
import { isProviderEnabled } from '../services/testPhase';
import { appendAudit } from '../services/audit';
import { config } from '../config';
import { createHmac } from 'node:crypto';
import { safeEqual } from '../lib/crypto';

export const router = Router();

/**
 * Confirmation asynchrone des opérateurs mobile money.
 * Chaque opérateur signe le corps (HMAC-SHA256) avec la clé partagée.
 */
router.post(
  '/mobile-money/:provider',
  validate(z.object({ reference: z.string(), status: z.enum(['SUCCESS', 'FAILED']), providerReference: z.string().optional() })),
  asyncHandler(async (req, res) => {
    // Opérateur désactivé pendant la phase de test (Wave) : aucune confirmation acceptée.
    if (!isProviderEnabled(req.params.provider)) throw notFound('Opérateur non disponible');
    const secret = {
      ORANGE_MONEY: config.ORANGE_MONEY_API_KEY,
      MTN_MOMO: config.MTN_MOMO_SUBSCRIPTION_KEY,
      WAVE: config.WAVE_API_KEY,
      MOOV_MONEY: config.MOOV_API_KEY,
    }[req.params.provider];
    const signature = req.header('x-signature') ?? '';
    const expected = secret ? createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex') : '';
    if (!secret || !safeEqual(signature, expected)) throw unauthorized('Signature invalide');

    const { reference, status } = req.body as { reference: string; status: 'SUCCESS' | 'FAILED' };
    const tx = await prisma.transaction.findFirst({ where: { reference, status: 'PENDING' } });
    if (!tx) throw notFound('Transaction inconnue ou déjà traitée');
    const amount = Math.abs(num(tx.amount));

    const meta = (tx.metadata ?? {}) as { paymentRequestId?: string; channel?: string };
    // Entrées : dépôt de l'utilisateur ou paiement d'une demande par un tiers (tout opérateur).
    const incoming = tx.type === 'DEPOSIT' || (tx.type === 'TRANSFER_IN' && !!meta.paymentRequestId);
    // Sorties : retrait ou envoi vers le mobile money d'un tiers.
    const outgoing = tx.type === 'WITHDRAWAL' || (tx.type === 'TRANSFER_OUT' && meta.channel === 'MOBILE_MONEY');

    await prisma.$transaction(async (t) => {
      if (incoming) {
        await t.transaction.update({ where: { id: tx.id }, data: { status: status === 'SUCCESS' ? 'COMPLETED' : 'FAILED' } });
        if (status === 'SUCCESS') {
          await t.account.updateMany({ where: { userId: tx.userId, type: 'MAIN' }, data: { balance: { increment: amount } } });
          await appendAudit(t, { userId: tx.userId, action: 'LEDGER_DEPOSIT_CONFIRMED', entity: 'Transaction', entityId: tx.id, payload: { amount } });
        }
        if (meta.paymentRequestId) {
          await t.paymentRequest.update({
            where: { id: meta.paymentRequestId },
            data: status === 'SUCCESS' ? { status: 'PAID', paidAt: new Date() } : { status: 'OPEN', payerPhone: null, provider: null, transactionId: null },
          });
        }
      } else if (outgoing) {
        await t.transaction.update({ where: { id: tx.id }, data: { status: status === 'SUCCESS' ? 'COMPLETED' : 'FAILED' } });
        if (status === 'FAILED') {
          await t.account.updateMany({ where: { userId: tx.userId, type: 'MAIN' }, data: { balance: { increment: amount } } });
          await appendAudit(t, { userId: tx.userId, action: 'LEDGER_WITHDRAWAL_REVERSED', entity: 'Transaction', entityId: tx.id, payload: { amount } });
        }
      }
    });
    if (status === 'SUCCESS' && incoming) {
      await notify(tx.userId, meta.paymentRequestId
        ? { title: 'Paiement reçu 💸', body: `${formatFCFA(amount)} reçus sur votre demande de paiement`, type: 'TRANSACTION' }
        : { title: 'Dépôt reçu', body: `${formatFCFA(amount)} crédités`, type: 'TRANSACTION' });
    }
    emitBalanceChanged(tx.userId);
    res.json({ ok: true });
  }),
);
