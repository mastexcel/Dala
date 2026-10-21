import pino from 'pino';
import { isTest } from '../config';

export const logger = pino({
  level: isTest ? 'silent' : process.env.LOG_LEVEL ?? 'info',
  redact: ['req.headers.authorization', 'req.headers["x-transaction-pin"]', '*.pin', '*.otp'],
});
