import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './lib/logger';
import { requireAuth } from './middleware/auth';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';
import { router as auth } from './routes/auth';
import { router as users } from './routes/users';
import { router as accounts } from './routes/accounts';
import { router as savings } from './routes/savings';
import { router as investments } from './routes/investments';
import { router as crowdfund } from './routes/crowdfund';
import { router as loans } from './routes/loans';
import { router as transactions } from './routes/transactions';
import { router as notifications } from './routes/notifications';
import { router as compliance } from './routes/compliance';
import { router as webhooks } from './routes/webhooks';
import { router as advisor, deskRouter } from './routes/advisor';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS === '*' ? true : config.CORS_ORIGINS.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  app.use(globalLimiter);

  // Poste des conseillers (page statique ; les données passent par /v1/advisor-desk avec la clé back-office).
  app.use('/desk', express.static(path.join(__dirname, '../desk'), { index: 'index.html', maxAge: '1h' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'dala-api', time: new Date().toISOString() }));

  const v1 = express.Router();
  v1.use('/auth', auth);
  v1.use('/webhooks', webhooks);
  v1.use('/compliance', compliance);
  v1.use('/users', requireAuth, users);
  v1.use('/accounts', requireAuth, accounts);
  v1.use('/savings', requireAuth, savings);
  v1.use('/investments', requireAuth, investments);
  v1.use('/crowdfund', requireAuth, crowdfund);
  v1.use('/loans', requireAuth, loans);
  v1.use('/transactions', requireAuth, transactions);
  v1.use('/notifications', requireAuth, notifications);
  v1.use('/advisor', requireAuth, advisor);
  v1.use('/advisor-desk', deskRouter);
  app.use('/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
