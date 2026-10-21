import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code = 'BAD_REQUEST', details?: unknown) => new HttpError(400, msg, code, details);
export const unauthorized = (msg = 'Authentification requise', code = 'UNAUTHORIZED') => new HttpError(401, msg, code);
export const forbidden = (msg: string, code = 'FORBIDDEN', details?: unknown) => new HttpError(403, msg, code, details);
export const notFound = (msg = 'Ressource introuvable') => new HttpError(404, msg, 'NOT_FOUND');
export const conflict = (msg: string, code = 'CONFLICT') => new HttpError(409, msg, code);

/** Enveloppe un handler async pour propager les erreurs au middleware d'erreur. */
export function asyncHandler<R extends Request = Request>(
  fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as R, res, next).catch(next);
  };
}
