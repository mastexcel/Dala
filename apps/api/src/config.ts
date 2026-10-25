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
  /**
   * Stockage des pièces KYC : 'sandbox' (aucun envoi) ou 's3', un stockage compatible S3 chez
   * l'hébergeur d'Abidjan. Les données clients restent dans l'UEMOA (engagement du dossier LIF).
   */
  STORAGE_DRIVER: z.enum(['sandbox', 's3']).default('sandbox'),
  STORAGE_BUCKET: z.string().default('kyc-documents'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('ci-abidjan'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /**
   * Services hébergés hors de l'UEMOA déclarés à l'ARTCI, séparés par des virgules
   * (sentry, twilio, fcm). Un service non déclaré n'est jamais appelé.
   */
  FOREIGN_PROCESSORS_DECLARED: z.string().default(''),
  FCM_SERVER_KEY: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
  SAFEGUARD_BALANCE_MAIN: z.coerce.number().default(0),
  SAFEGUARD_BALANCE_SAVINGS: z.coerce.number().default(0),
  SAFEGUARD_BALANCE_INVEST: z.coerce.number().default(0),
  SAFEGUARD_BALANCE_CROWDFUND: z.coerce.number().default(0),
  SENTRY_DSN: z.string().optional(),
});

const parsed = schema
  .superRefine((c, ctx) => {
    const declared = c.FOREIGN_PROCESSORS_DECLARED.split(',').map((s) => s.trim());
    if (c.SMS_PROVIDER === 'twilio' && !declared.includes('twilio')) {
      ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDER'], message: "Twilio est hébergé hors de l'UEMOA : déclarez-le (FOREIGN_PROCESSORS_DECLARED) ou utilisez l'API SMS d'Orange." });
    }
    if (c.STORAGE_DRIVER === 's3' && (!c.S3_ENDPOINT || !c.S3_ACCESS_KEY_ID || !c.S3_SECRET_ACCESS_KEY)) {
      ctx.addIssue({ code: 'custom', path: ['S3_ENDPOINT'], message: 'S3_ENDPOINT, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY sont requis avec STORAGE_DRIVER=s3.' });
    }
  })
  .safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Configuration invalide :', parsed.error.flatten().fieldErrors);
  throw new Error('Configuration invalide — voir apps/api/.env.example');
}

export const config = parsed.data;
/** Un service étranger n'est utilisé que s'il a été déclaré à l'ARTCI. */
export const foreignProcessorAllowed = (name: 'sentry' | 'twilio' | 'fcm') =>
  config.FOREIGN_PROCESSORS_DECLARED.split(',').map((s) => s.trim()).includes(name);
export const isProd = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
