import type { NextFunction, Request, Response } from 'express';
import { checkKycLimit, KYC_LIMITS, type KycLevel } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { forbidden, notFound } from '../lib/errors';
import type { AuthedRequest } from './auth';

const OUTGOING_TYPES = ['WITHDRAWAL', 'TRANSFER_OUT', 'SAVINGS_IN', 'INVESTMENT_BUY', 'CROWDFUND_IN', 'DEPOSIT'] as const;

/** Volume du mois en cours soumis au plafond KYC (valeurs absolues). */
export async function monthToDateVolume(userId: string, now = new Date()): Promise<number> {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const agg = await prisma.transaction.findMany({
    where: { userId, createdAt: { gte: start }, status: { in: ['COMPLETED', 'PENDING'] }, type: { in: [...OUTGOING_TYPES] } },
    select: { amount: true },
  });
  return agg.reduce((s, t) => s + Math.abs(num(t.amount)), 0);
}

/** Applique les plafonds KYC (Art. 27-31) et le plafond personnalisé de l'utilisateur. */
export function enforceKycLimit(amountOf: (req: Request) => number, opts: { isTransfer?: boolean } = {}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { id } = (req as AuthedRequest).user;
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw notFound('Utilisateur introuvable');
      if (user.status !== 'ACTIVE') throw forbidden('Compte gelé — contactez le support', 'ACCOUNT_FROZEN');
      const amount = amountOf(req);
      const volume = await monthToDateVolume(id);
      const result = checkKycLimit({ kycLevel: user.kycLevel as KycLevel, monthToDateVolume: volume, amount, isTransfer: opts.isTransfer });
      if (!result.allowed) {
        throw forbidden(result.reason, 'KYC_LIMIT', {
          requiredLevel: result.requiredLevel,
          limit: KYC_LIMITS[user.kycLevel as KycLevel].monthlyLimit,
          used: volume,
        });
      }
      if (user.customMonthlyLimit && volume + amount > num(user.customMonthlyLimit)) {
        throw forbidden('Plafond personnalisé atteint. Modifiez-le dans Profil › Sécurité.', 'CUSTOM_LIMIT');
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function requireKycLevel(level: KycLevel) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { kyc } = (req as AuthedRequest).user;
    if (kyc < level) return next(forbidden(`KYC de niveau ${level} requis`, 'KYC_LEVEL', { requiredLevel: level }));
    next();
  };
}
