import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { badRequest } from '../lib/errors';

type Part = 'body' | 'query' | 'params';

/** Valide et remplace req[part] par la version parsée (coercions zod incluses). */
export function validate<S extends ZodTypeAny>(schema: S, part: Part = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(badRequest('Données invalides', 'VALIDATION_ERROR', result.error.flatten()));
    }
    // req.query est un getter en Express 5 ; on écrase prudemment.
    Object.defineProperty(req, part, { value: result.data as z.infer<S>, writable: true, configurable: true });
    next();
  };
}
