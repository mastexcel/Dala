import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { KYC_LIMITS, KYC_REQUIREMENTS, type KycLevel } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, badRequest } from '../lib/errors';
import { userDTO } from '../lib/serialize';
import { validate } from '../middleware/validate';
import { requireStrongAuth, type AuthedRequest } from '../middleware/auth';
import { monthToDateVolume } from '../middleware/kyc';
import { appendAudit } from '../services/audit';
import { createUploadUrl } from '../services/storage';
import { notify } from '../services/notifications';

export const router = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    const referralCount = await prisma.user.count({ where: { referredBy: user.id } });
    res.json(userDTO(user, referralCount));
  }),
);

/** Modification des données personnelles : authentification forte obligatoire (Art. 84). */
router.patch(
  '/me',
  requireStrongAuth('PROFILE_UPDATE'),
  validate(
    z.object({
      firstName: z.string().trim().min(2).max(50).optional(),
      lastName: z.string().trim().min(2).max(50).optional(),
      email: z.string().email().nullable().optional(),
      avatarUrl: z.string().url().nullable().optional(),
      language: z.enum(['fr', 'en', 'bm']).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: uid(req) }, data: req.body });
      await appendAudit(tx, { userId: u.id, action: 'PROFILE_UPDATED', entity: 'User', entityId: u.id, payload: { fields: Object.keys(req.body) } });
      return u;
    });
    await notify(user.id, { title: 'Profil mis à jour', body: 'Vos informations personnelles ont été modifiées.', type: 'SECURITY' });
    res.json(userDTO(user));
  }),
);

router.put(
  '/me/pin',
  validate(z.object({ currentPin: z.string(), newPin: z.string().regex(/^\d{4,6}$/) })),
  asyncHandler(async (req, res) => {
    const { currentPin, newPin } = req.body as { currentPin: string; newPin: string };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    if (!(await bcrypt.compare(currentPin, user.pin))) throw badRequest('PIN actuel incorrect', 'INVALID_PIN');
    await prisma.user.update({ where: { id: user.id }, data: { pin: await bcrypt.hash(newPin, 10) } });
    await notify(user.id, { title: 'PIN modifié', body: 'Votre code PIN a été changé.', type: 'SECURITY' });
    res.json({ ok: true });
  }),
);

router.put(
  '/me/push-token',
  validate(z.object({ token: z.string().min(10) })),
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: uid(req) }, data: { pushToken: (req.body as { token: string }).token } });
    res.status(204).end();
  }),
);

/** Plafonds : réglementaires (KYC) + personnalisé par l'utilisateur. */
router.get(
  '/me/limits',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    const rule = KYC_LIMITS[user.kycLevel as KycLevel];
    res.json({
      kycLevel: user.kycLevel,
      regulatoryMonthlyLimit: rule.monthlyLimit,
      transfersAllowed: rule.transfersAllowed,
      customMonthlyLimit: user.customMonthlyLimit ? num(user.customMonthlyLimit) : null,
      usedThisMonth: await monthToDateVolume(user.id),
    });
  }),
);

router.put(
  '/me/limits',
  requireStrongAuth('PROFILE_UPDATE'),
  validate(z.object({ customMonthlyLimit: z.number().int().positive().nullable() })),
  asyncHandler(async (req, res) => {
    const { customMonthlyLimit } = req.body as { customMonthlyLimit: number | null };
    await prisma.user.update({ where: { id: uid(req) }, data: { customMonthlyLimit } });
    res.json({ customMonthlyLimit });
  }),
);

router.get('/me/kyc', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  res.json({ level: user.kycLevel, documents: user.kycDocuments ?? {}, requirements: KYC_REQUIREMENTS, limits: KYC_LIMITS });
}));

router.post(
  '/me/kyc/upload-url',
  validate(z.object({ fileName: z.string().min(1).max(120) })),
  asyncHandler(async (req, res) => {
    res.json(await createUploadUrl(uid(req), (req.body as { fileName: string }).fileName));
  }),
);

/**
 * Soumission des pièces KYC. La validation (contrôle documentaire, liveness, screening) est
 * réalisée par le back-office ; le niveau est relevé via /compliance/kyc/:userId/approve.
 */
const kycSubmitSchema = z.discriminatedUnion('targetLevel', [
  z.object({
    targetLevel: z.literal(2),
    idType: z.enum(['CNI', 'PASSEPORT', 'CARTE_CONSULAIRE']),
    idNumber: z.string().min(5),
    idDocumentPath: z.string(),
    selfiePath: z.string(),
    address: z.string().min(5),
    proofOfAddressPath: z.string().optional(),
  }),
  z.object({ targetLevel: z.literal(3), incomeProofPath: z.string(), videoPath: z.string() }),
]);

router.post(
  '/me/kyc',
  validate(kycSubmitSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof kycSubmitSchema>;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    if (body.targetLevel !== user.kycLevel + 1) throw badRequest(`Complétez d'abord le niveau ${user.kycLevel + 1}`);
    const docs = { ...((user.kycDocuments as object) ?? {}), [`level${body.targetLevel}`]: { ...body, status: 'PENDING_REVIEW', submittedAt: new Date().toISOString() } };
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { kycDocuments: docs } });
      await appendAudit(tx, { userId: user.id, action: 'KYC_SUBMITTED', entity: 'User', entityId: user.id, payload: { targetLevel: body.targetLevel } });
    });
    await notify(user.id, { title: 'Documents reçus', body: 'Votre vérification est en cours (24 à 48 h).', type: 'KYC' });
    res.status(202).json({ status: 'PENDING_REVIEW' });
  }),
);

router.get(
  '/me/referrals',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
    const referees = await prisma.user.findMany({ where: { referredBy: user.id }, select: { firstName: true, createdAt: true } });
    res.json({ code: user.referralCode, link: `https://dala.finance/r/${user.referralCode}`, count: referees.length, referees });
  }),
);
