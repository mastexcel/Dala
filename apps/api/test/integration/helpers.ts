import { createServer, type Server } from 'node:http';
import { TEST_PHASE } from '@dala/shared';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { signAccessToken } from '../../src/lib/jwt';

export const app = createApp();
export const api = () => request(app);
export const ADMIN = { 'x-admin-key': 'integration-admin-key' };
export const PIN = '2580';
export const CONSENT = { version: TEST_PHASE.consentVersion, accepted: true } as const;

/** Vide toutes les tables (base de test uniquement). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

let phoneSeq = 0;
export function nextPhone() {
  phoneSeq += 1;
  return `+22507${String(10_000_000 + phoneSeq).slice(-8)}`;
}

/** Inscription complète via l'API (OTP renvoyé en clair hors production). */
export async function register(firstName = 'Awa', lastName = 'Koné', pin = PIN) {
  const phone = nextPhone();
  const otp = await api().post('/v1/auth/otp/request').send({ phone, purpose: 'REGISTER' }).expect(200);
  const res = await api()
    .post('/v1/auth/register')
    .send({ phone, otp: otp.body.devCode, firstName, lastName, pin, dateOfBirth: '1990-05-14', consent: CONSENT })
    .expect(201);
  return { phone, userId: res.body.user.id as string, token: res.body.accessToken as string, refreshToken: res.body.refreshToken as string };
}

/** Jeton d'accès reflétant le niveau KYC actuel en base. */
export async function tokenFor(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return signAccessToken({ sub: userId, amr: ['POSSESSION', 'KNOWLEDGE'], kyc: u.kycLevel });
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function mainBalance(userId: string) {
  const acc = await prisma.account.findFirstOrThrow({ where: { userId, type: 'MAIN' } });
  return acc.balance.toNumber();
}

/** Dépôt sandbox (succès immédiat). */
export async function deposit(token: string, amount: number) {
  return api().post('/v1/accounts/deposit').set(bearer(token)).send({ provider: 'ORANGE_MONEY', amount }).expect(201);
}

/** Faux service de scoring ML : probabilité pilotée par le test. */
export const ml = { probability: 0.9, server: null as Server | null };
export function startMlStub() {
  ml.server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ probability: ml.probability, model_version: 'stub', score: Math.round(ml.probability * 100) }));
    });
  });
  return new Promise<void>((resolve) => ml.server!.listen(18765, '127.0.0.1', resolve));
}
export const stopMlStub = () => new Promise<void>((resolve) => (ml.server ? ml.server.close(() => resolve()) : resolve()));

export { prisma };
