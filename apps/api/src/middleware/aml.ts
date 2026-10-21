import type { NextFunction, Request, Response } from 'express';
import { evaluateAml } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { forbidden } from '../lib/errors';
import { screenUser } from '../services/sanctions';
import { recordAmlAlert } from '../services/aml';
import type { AuthedRequest } from './auth';

/**
 * Contrôle LBC/FT avant chaque opération financière (Art. 27-31) :
 * screening sanctions, seuils, fractionnement, vélocité. Alerte rouge → gel + déclaration CENTIF.
 */
export function amlScreen(amountOf: (req: Request) => number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { id } = (req as AuthedRequest).user;
      const amount = amountOf(req);
      const since = new Date(Date.now() - 24 * 3_600_000);
      const [user, recent] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id } }),
        prisma.transaction.findMany({ where: { userId: id, createdAt: { gte: since } }, select: { amount: true, createdAt: true } }),
      ]);
      const sanctionsHit = await screenUser(user);
      const result = evaluateAml({
        amount,
        recent: recent.map((t) => ({ amount: Math.abs(num(t.amount)), createdAt: t.createdAt })),
        sanctionsHit,
      });
      if (result.severity !== 'GREEN') {
        await recordAmlAlert(id, amount, result, { path: req.path });
      }
      if (result.severity === 'RED') {
        throw forbidden('Opération bloquée par les contrôles de conformité. Notre équipe vous contactera.', 'AML_BLOCKED');
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
