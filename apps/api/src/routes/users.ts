import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { DATA_RETENTION_POLICY, KYC_LIMITS, KYC_REQUIREMENTS, RETENTION_YEARS_AFTER_CLOSURE, TEST_PHASE, type KycLevel } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, forbidden } from '../lib/errors';
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
    if (body.targetLevel > TEST_PHASE.limits.maxKycLevel) throw forbidden(`Le niveau KYC ${body.targetLevel} n'est pas ouvert pendant la phase de test`, 'TEST_LIMIT_REACHED');
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

/* ------------------------- Droits des utilisateurs ------------------------- */

/** Politique de conservation des données. */
router.get('/me/data/retention', (_req, res) => {
  res.json({ policy: DATA_RETENTION_POLICY, yearsAfterClosure: RETENTION_YEARS_AFTER_CLOSURE });
});

/** Export des données personnelles (droit d'accès et de portabilité). */
router.get(
  '/me/data/export',
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, phone: true, firstName: true, lastName: true, email: true, dateOfBirth: true, kycLevel: true,
        language: true, createdAt: true, consentVersion: true, consentAcceptedAt: true, status: true,
      },
    });
    const [accounts, transactions, savings, vaults, tontines, loans, notifications, complaints, conversations] = await Promise.all([
      prisma.account.findMany({ where: { userId }, select: { type: true, balance: true, currency: true } }),
      prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { type: true, amount: true, description: true, reference: true, status: true, createdAt: true } }),
      prisma.savingsGoal.findMany({ where: { userId } }),
      prisma.vault.findMany({ where: { userId } }),
      prisma.tontineMember.findMany({ where: { userId }, include: { tontine: { select: { name: true, amount: true, frequency: true, status: true } } } }),
      prisma.loan.findMany({ where: { userId }, select: { amount: true, totalDue: true, amountPaid: true, duration: true, status: true, createdAt: true, dueDate: true } }),
      prisma.notification.findMany({ where: { userId }, select: { title: true, body: true, createdAt: true } }),
      prisma.complaint.findMany({ where: { userId }, select: { subject: true, message: true, status: true, response: true, createdAt: true } }),
      prisma.advisorConversation.findMany({ where: { userId }, include: { messages: { select: { sender: true, authorName: true, body: true, createdAt: true } } } }),
    ]);
    await prisma.$transaction((tx) => appendAudit(tx, { userId, action: 'DATA_EXPORTED', entity: 'User', entityId: userId }));
    res.setHeader('Content-Disposition', `attachment; filename="dala-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      retention: DATA_RETENTION_POLICY,
      user,
      accounts, transactions, savings, vaults, tontines, loans, notifications, complaints, conversations,
    });
  }),
);

/**
 * Clôture du compte (« suppression ») : l'accès est fermé immédiatement. Les données sont conservées
 * pendant la durée légale (LBC/FT) puis anonymisées par la tâche de purge.
 */
router.post(
  '/me/close',
  requireStrongAuth('PROFILE_UPDATE'),
  asyncHandler(async (req, res) => {
    const userId = uid(req);
    await prisma.$transaction(async (tx) => {
      const balances = await tx.account.aggregate({ where: { userId }, _sum: { balance: true } });
      if (num(balances._sum.balance ?? 0) > 0) throw conflict('Retirez d’abord le solde de tous vos comptes (épargne et coffre-fort compris).', 'BALANCE_NOT_EMPTY');
      const openLoans = await tx.loan.count({ where: { userId, status: { in: ['PENDING', 'APPROVED', 'DISBURSED', 'OVERDUE'] } } });
      if (openLoans) throw conflict('Remboursez votre prêt en cours avant de clôturer le compte.', 'LOAN_OPEN');
      const tontines = await tx.tontineMember.count({ where: { userId, tontine: { status: { in: ['PENDING', 'ACTIVE'] } } } });
      if (tontines) throw conflict('Vous participez à une tontine en cours : attendez sa fin pour clôturer le compte.', 'TONTINE_OPEN');
      const vaults = await tx.vault.count({ where: { userId, released: false } });
      if (vaults) throw conflict('Un coffre-fort est encore bloqué.', 'VAULT_LOCKED');
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.status === 'FROZEN') throw forbidden('Compte gelé : contactez le support.', 'ACCOUNT_FROZEN');
      await tx.user.update({ where: { id: userId }, data: { status: 'CLOSED', closedAt: new Date(), pushToken: null } });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await appendAudit(tx, { userId, action: 'ACCOUNT_CLOSED', entity: 'User', entityId: userId });
    });
    res.json({ status: 'CLOSED', retentionYears: RETENTION_YEARS_AFTER_CLOSURE });
  }),
);
