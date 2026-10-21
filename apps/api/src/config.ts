import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default('*'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  OTP_LENGTH: z.coerce.number().int().min(4).max(6).default(6),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  SMS_PROVIDER: z.enum(['console', 'twilio', 'orange']).default('console'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  ORANGE_SMS_CLIENT_ID: z.string().optional(),
  ORANGE_SMS_CLIENT_SECRET: z.string().optional(),
  ORANGE_SMS_SENDER: z.string().optional(),
  REDIS_URL: z.string().optional(),
  ML_SERVICE_URL: z.string().default('http://localhost:8000'),
  MOBILE_MONEY_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  ORANGE_MONEY_API_KEY: z.string().optional(),
  MTN_MOMO_SUBSCRIPTION_KEY: z.string().optional(),
  WAVE_API_KEY: z.string().optional(),
  MOOV_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().default('kyc-documents'),
  FCM_SERVER_KEY: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
  SAFEGUARD_BALANCE_MAIN: z.coerce.number().default(0),
  SAFEGUARD_BALANCE_SAVINGS: z.coerce.number().default(0),
  SAFEGUARD_BALANCE_INVEST: z.coerce.number().default(0),
  SAFEGUARD_BALANCE_CROWDFUND: z.coerce.number().default(0),
  SENTRY_DSN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Configuration invalide :', parsed.error.flatten().fieldErrors);
  throw new Error('Configuration invalide — voir apps/api/.env.example');
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
