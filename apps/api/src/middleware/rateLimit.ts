import rateLimit from 'express-rate-limit';
import { isTest } from '../config';

const common = { standardHeaders: 'draft-7' as const, legacyHeaders: false, skip: () => isTest };

export const globalLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 120 });

/** OTP : 3 envois / 10 min par numéro + IP. */
export const otpLimiter = rateLimit({
  ...common,
  windowMs: 10 * 60_000,
  limit: 3,
  keyGenerator: (req) => `${req.ip}:${(req.body as { phone?: string })?.phone ?? ''}`,
  message: { error: 'Trop de demandes de code. Réessayez dans quelques minutes.', code: 'RATE_LIMITED' },
});

export const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60_000,
  limit: 10,
  message: { error: 'Trop de tentatives de connexion.', code: 'RATE_LIMITED' },
});
