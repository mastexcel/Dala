import bcrypt from 'bcryptjs';
import { config, isProd } from '../config';
import { prisma } from '../lib/prisma';
import { randomDigits } from '../lib/crypto';
import { badRequest } from '../lib/errors';
import { sms } from './sms';

const MAX_ATTEMPTS = 5;

export async function issueOtp(phone: string, purpose = 'LOGIN'): Promise<{ expiresAt: Date; devCode?: string }> {
  const code = randomDigits(config.OTP_LENGTH);
  const expiresAt = new Date(Date.now() + config.OTP_TTL_SECONDS * 1000);
  await prisma.otpChallenge.updateMany({ where: { phone, purpose, consumed: false }, data: { consumed: true } });
  await prisma.otpChallenge.create({ data: { phone, purpose, codeHash: await bcrypt.hash(code, 8), expiresAt } });
  await sms.send(phone, `DALA : votre code de vérification est ${code}. Il expire dans ${Math.round(config.OTP_TTL_SECONDS / 60)} min. Ne le partagez jamais.`);
  // En développement, le code est renvoyé pour faciliter les tests (jamais en production).
  return { expiresAt, devCode: isProd ? undefined : code };
}

export async function verifyOtp(phone: string, code: string, purpose = 'LOGIN'): Promise<void> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, purpose, consumed: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!challenge || challenge.expiresAt < new Date()) throw badRequest('Code expiré. Demandez-en un nouveau.', 'OTP_EXPIRED');
  if (challenge.attempts >= MAX_ATTEMPTS) throw badRequest('Trop de tentatives. Demandez un nouveau code.', 'OTP_LOCKED');
  const ok = await bcrypt.compare(code, challenge.codeHash);
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: ok ? { consumed: true } : { attempts: { increment: 1 } },
  });
  if (!ok) throw badRequest('Code incorrect', 'OTP_INVALID');
}
