import * as Sentry from '@sentry/node';
import { config } from '../config';

const SECRET_HEADERS = ['authorization', 'x-transaction-pin', 'x-admin-key', 'x-signature', 'cookie'];
const SECRET_FIELDS = ['pin', 'newPin', 'currentPin', 'otp', 'refreshToken'];

let enabled = false;

/** Suivi des erreurs (Sentry), actif uniquement si SENTRY_DSN est défini. Aucun secret n'est transmis. */
export function initMonitoring() {
  if (!config.SENTRY_DSN) return;
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      const headers = event.request?.headers;
      if (headers) for (const h of SECRET_HEADERS) delete headers[h];
      const data = event.request?.data;
      if (data && typeof data === 'object') for (const f of SECRET_FIELDS) delete (data as Record<string, unknown>)[f];
      if (typeof data === 'string') event.request!.data = '[filtré]';
      return event;
    },
  });
  enabled = true;
}

export function captureError(err: unknown, context: { path?: string; userId?: string } = {}) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.path) scope.setTag('path', context.path);
    Sentry.captureException(err);
  });
}
