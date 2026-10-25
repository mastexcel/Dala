import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { MIN_AGE, TEST_PHASE, ageOn, type AuthFactor } from '@dala/shared';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, forbidden, unauthorized } from '../lib/errors';
import { signAccessToken } from '../lib/jwt';
import { randomToken, sha256 } from '../lib/crypto';
import { config } from '../config';
import { issueOtp, verifyOtp } from '../services/otp';
import { ensureAccounts } from '../services/ledger';
import { appendAudit } from '../services/audit';
import { assertUserCapacity } from '../services/testPhase';
import { notify } from '../services/notifications';
import { userDTO } from '../lib/serialize';
import { validate } from '../middleware/validate';
import { authLimiter, otpLimiter } from '../middleware/rateLimit';
import { requireAuth, verifyPin, type AuthedRequest } from '../middleware/auth';

export const router = Router();

/** Numéro E.164 d'un pays de l'UEMOA. */
export const phoneSchema = z.string().regex(/^\+22[1-9]\d{7,10}$|^\+245\d{7}$/, 'Numéro UEMOA invalide (format +225XXXXXXXXXX)');
const pinSchema = z.string().regex(/^\d{4,6}$/, 'Le PIN doit contenir 4 à 6 chiffres');
const otpSchema = z.string().regex(/^\d{4,6}$/);

async function issueTokens(userId: string, kycLevel: number, amr: AuthFactor[], deviceId?: string) {
  const refreshToken = randomToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      deviceId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + config.JWT_REFRESH_TTL_DAYS * 86_400_000),
    },
  });
  return { accessToken: signAccessToken({ sub: userId, amr, kyc: kycLevel }), refreshToken };
}

router.post(
  '/otp/request',
  otpLimiter,
  validate(z.object({ phone: phoneSchema, purpose: z.enum(['LOGIN', 'REGISTER', 'PIN_RESET']).default('LOGIN') })),
  asyncHandler(async (req, res) => {
    const { phone, purpose } = req.body as { phone: string; purpose: string };
    const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (purpose === 'REGISTER' && exists) throw conflict('Ce numéro possède déjà un compte', 'PHONE_TAKEN');
    if (purpose !== 'REGISTER' && !exists) throw badRequest('Aucun compte pour ce numéro', 'UNKNOWN_PHONE');
    // Phase de test : on prévient dès l'envoi du code si les inscriptions sont complètes.
    if (purpose === 'REGISTER' && (await prisma.user.count({ where: { status: { not: 'CLOSED' } } })) >= TEST_PHASE.limits.maxUsers) {
      throw conflict(`Les inscriptions sont fermées : la phase de test est limitée à ${TEST_PHASE.limits.maxUsers} utilisateurs.`, 'TEST_LIMIT_REACHED');
    }
    const result = await issueOtp(phone, purpose);
    res.json({ sent: true, expiresAt: result.expiresAt, devCode: result.devCode });
  }),
);

router.post(
  '/register',
  authLimiter,
  validate(
    z.object({
      phone: phoneSchema,
      otp: otpSchema,
      firstName: z.string().trim().min(2).max(50),
      lastName: z.string().trim().min(2).max(50),
      pin: pinSchema,
      email: z.string().email().optional(),
      referralCode: z.string().optional(),
      deviceId: z.string().optional(),
      /** Date de naissance AAAA-MM-JJ : inscription réservée aux personnes majeures. */
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      /** Acceptation de l'avertissement de la phase de test (version du texte affiché). */
      consent: z.object({ version: z.literal(TEST_PHASE.consentVersion), accepted: z.literal(true) }),
    }),
  ),
  asyncHandler(async (req, res) => {
    const b = req.body as {
      phone: string; otp: string; firstName: string; lastName: string; pin: string; email?: string; referralCode?: string; deviceId?: string;
      dateOfBirth: string; consent: { version: string; accepted: true };
    };
    const age = ageOn(b.dateOfBirth);
    if (Number.isNaN(age) || age > 120) throw badRequest('Date de naissance invalide', 'INVALID_BIRTH_DATE');
    if (age < MIN_AGE) throw forbidden(`L'ouverture d'un compte est réservée aux personnes de ${MIN_AGE} ans ou plus.`, 'UNDERAGE');
    await verifyOtp(b.phone, b.otp, 'REGISTER');
    const referrer = b.referralCode ? await prisma.user.findUnique({ where: { referralCode: b.referralCode } }) : null;
    const pinHash = await bcrypt.hash(b.pin, 10);
    const user = await prisma.$transaction(async (tx) => {
      await assertUserCapacity(tx);
      const consentAcceptedAt = new Date();
      const u = await tx.user.create({
        data: {
          phone: b.phone,
          firstName: b.firstName,
          lastName: b.lastName,
          email: b.email,
          pin: pinHash,
          referredBy: referrer?.id,
          dateOfBirth: new Date(`${b.dateOfBirth}T00:00:00Z`),
          consentVersion: b.consent.version,
          consentAcceptedAt,
        },
      });
      await ensureAccounts(tx, u.id);
      await appendAudit(tx, { userId: u.id, action: 'USER_REGISTERED', entity: 'User', entityId: u.id });
      // Acceptation horodatée, chaînée dans la piste d'audit.
      await appendAudit(tx, { userId: u.id, action: 'CONSENT_ACCEPTED', entity: 'User', entityId: u.id, payload: { version: b.consent.version, acceptedAt: consentAcceptedAt.toISOString() } });
      return u;
    });
    if (referrer) await notify(referrer.id, { title: 'Nouveau filleul 🎉', body: `${user.firstName} a rejoint DALA avec votre code.`, type: 'SYSTEM' });
    const tokens = await issueTokens(user.id, user.kycLevel, ['POSSESSION', 'KNOWLEDGE'], b.deviceId);
    res.status(201).json({ user: userDTO(user), ...tokens });
  }),
);

/** Connexion forte : OTP (possession) + PIN (connaissance). */
router.post(
  '/login',
  authLimiter,
  validate(z.object({ phone: phoneSchema, otp: otpSchema, pin: pinSchema, deviceId: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const { phone, otp, pin, deviceId } = req.body as { phone: string; otp: string; pin: string; deviceId?: string };
    await verifyOtp(phone, otp, 'LOGIN');
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw unauthorized('Identifiants invalides');
    if (user.status === 'CLOSED') throw forbidden('Compte clôturé');
    if (!(await verifyPin(user.id, pin))) throw unauthorized('PIN incorrect', 'INVALID_PIN');
    await prisma.$transaction((tx) => appendAudit(tx, { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, payload: { deviceId: deviceId ?? null } }));
    const tokens = await issueTokens(user.id, user.kycLevel, ['POSSESSION', 'KNOWLEDGE'], deviceId);
    res.json({ user: userDTO(user), ...tokens });
  }),
);

/**
 * Rotation du refresh token. `biometric: true` indique un déverrouillage biométrique local
 * (le jeton est stocké dans le trousseau protégé par biométrie) → facteurs possession + inhérence.
 */
router.post(
  '/refresh',
  validate(z.object({ refreshToken: z.string().min(20), biometric: z.boolean().optional(), deviceId: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const { refreshToken, biometric, deviceId } = req.body as { refreshToken: string; biometric?: boolean; deviceId?: string };
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      if (stored && stored.revokedAt) {
        // Réutilisation d'un jeton révoqué : révocation de toute la famille (vol probable).
        await prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      throw unauthorized('Session expirée', 'REFRESH_INVALID');
    }
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const amr: AuthFactor[] = biometric ? ['POSSESSION', 'INHERENCE'] : ['POSSESSION'];
    const tokens = await issueTokens(stored.userId, stored.user.kycLevel, amr, deviceId ?? stored.deviceId ?? undefined);
    res.json({ user: userDTO(stored.user), ...tokens });
  }),
);

router.post(
  '/logout',
  validate(z.object({ refreshToken: z.string() })),
  asyncHandler(async (req, res) => {
    await prisma.refreshToken.updateMany({ where: { tokenHash: sha256((req.body as { refreshToken: string }).refreshToken) }, data: { revokedAt: new Date() } });
    res.status(204).end();
  }),
);

/** Vérification du PIN (ex. avant affichage d'informations sensibles). */
router.post(
  '/pin/verify',
  requireAuth,
  validate(z.object({ pin: pinSchema })),
  asyncHandler(async (req, res) => {
    const ok = await verifyPin((req as AuthedRequest).user.id, (req.body as { pin: string }).pin);
    if (!ok) throw forbidden('PIN incorrect', 'INVALID_PIN');
    res.json({ ok: true });
  }),
);

/** Réinitialisation du PIN via OTP. */
router.post(
  '/pin/reset',
  authLimiter,
  validate(z.object({ phone: phoneSchema, otp: otpSchema, newPin: pinSchema })),
  asyncHandler(async (req, res) => {
    const { phone, otp, newPin } = req.body as { phone: string; otp: string; newPin: string };
    await verifyOtp(phone, otp, 'PIN_RESET');
    const user = await prisma.user.update({ where: { phone }, data: { pin: await bcrypt.hash(newPin, 10), failedPinAttempts: 0 } });
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await prisma.$transaction((tx) => appendAudit(tx, { userId: user.id, action: 'PIN_RESET', entity: 'User', entityId: user.id }));
    await notify(user.id, { title: 'PIN modifié', body: "Votre code PIN a été réinitialisé. Si ce n'est pas vous, contactez le support.", type: 'SECURITY' });
    res.json({ ok: true });
  }),
);
