import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';
import { captureError } from '../lib/monitoring';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route introuvable', code: 'NOT_FOUND' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    return res.status(404).json({ error: 'Ressource introuvable', code: 'NOT_FOUND' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON invalide', code: 'BAD_JSON' });
  }
  logger.error({ err, path: req.path }, 'Erreur non gérée');
  captureError(err, { path: req.path, userId: (req as { user?: { id: string } }).user?.id });
  res.status(500).json({ error: 'Une erreur est survenue. Réessayez plus tard.', code: 'INTERNAL' });
}
