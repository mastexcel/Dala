import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { requiresStrongAuth, type AuthFactor, type SensitiveOperation } from '@dala/shared';
import { verifyAccessToken } from '../lib/jwt';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { safeEqual } from '../lib/crypto';

export interface AuthedRequest extends Request {
  user: { id: string; amr: AuthFactor[]; kyc: number };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    const claims = verifyAccessToken(header.slice(7));
    (req as AuthedRequest).user = { id: claims.sub, amr: claims.amr ?? [], kyc: claims.kyc };
    next();
  } catch {
    next(unauthorized('Session expirée', 'TOKEN_EXPIRED'));
  }
}

const MAX_PIN_ATTEMPTS = 5;

/** Vérifie le PIN d'un utilisateur et gère le verrouillage après 5 échecs. */
export async function verifyPin(userId: string, pin: string | undefined): Promise<boolean> {
  if (!pin) return false;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.failedPinAttempts >= MAX_PIN_ATTEMPTS) {
    throw forbidden('PIN verrouillé après trop de tentatives. Réinitialisez-le via OTP.', 'PIN_LOCKED');
  }
  const ok = await bcrypt.compare(pin, user.pin);
  await prisma.user.update({
    where: { id: userId },
    data: { failedPinAttempts: ok ? 0 : { increment: 1 } },
  });
  return ok;
}

/**
 * Authentification forte par opération (Art. 84) : la session prouve la possession de l'appareil,
 * l'en-tête `x-transaction-pin` apporte le facteur connaissance. Le PIN est exigé pour toute
 * opération sensible, et pour les paiements au-delà de 50 000 FCFA.
 */
export function requireStrongAuth(op: SensitiveOperation, amountOf?: (req: Request) => number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const amount = amountOf ? amountOf(req) : 0;
      if (!requiresStrongAuth(op, amount)) return next();
      const pin = req.header('x-transaction-pin');
      if (!pin) throw forbidden('Confirmation par PIN requise', 'STRONG_AUTH_REQUIRED');
      const ok = await verifyPin((req as AuthedRequest).user.id, pin);
      if (!ok) throw forbidden('PIN incorrect', 'INVALID_PIN');
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Accès back-office (reporting BCEAO, revue des projets, CENTIF). */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const key = req.header('x-admin-key');
  if (!config.ADMIN_API_KEY || !key || !safeEqual(key, config.ADMIN_API_KEY)) {
    return next(forbidden('Accès réservé au back-office'));
  }
  next();
}
