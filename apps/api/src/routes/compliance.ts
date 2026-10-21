import { Router } from 'express';
import { z } from 'zod';
import { COMPLAINT_RESPONSE_DAYS, CROWDFUND_VALIDATOR } from '@dala/shared';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound } from '../lib/errors';
import { addBusinessDays } from '../lib/businessDays';
import { validate } from '../middleware/validate';
import { requireAdmin, requireAuth, type AuthedRequest } from '../middleware/auth';
import { appendAudit, verifyAuditChain } from '../services/audit';
import { notify } from '../services/notifications';
import { bceaoMonthlyReport, reconcileSafeguarding } from '../services/reporting';

export const router = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;

/* ---------------------- Réclamations (utilisateur) ---------------------- */

const complaintSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(4_000),
  category: z.enum(['TRANSACTION', 'CREDIT', 'INVEST', 'CROWDFUND', 'ACCOUNT', 'OTHER']),
});

router.post(
  '/complaints',
  requireAuth,
  validate(complaintSchema),
  asyncHandler(async (req, res) => {
    const c = await prisma.complaint.create({
      data: { ...(req.body as z.infer<typeof complaintSchema>), userId: uid(req), dueBy: addBusinessDays(new Date(), COMPLAINT_RESPONSE_DAYS) },
    });
    await notify(uid(req), {
      title: 'Réclamation enregistrée',
      body: `Référence ${c.id.slice(-8).toUpperCase()}. Réponse garantie sous ${COMPLAINT_RESPONSE_DAYS} jours ouvrés.`,
      type: 'SYSTEM',
    });
    res.status(201).json(c);
  }),
);

router.get(
  '/complaints',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await prisma.complaint.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' } }));
  }),
);

/* ---------------------------- Back-office ---------------------------- */

const admin = Router();
admin.use(requireAdmin);

admin.get('/reports/bceao', validate(z.object({ year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) }), 'query'),
  asyncHandler(async (req, res) => {
    const { year, month } = req.query as unknown as { year: number; month: number };
    res.json(await bceaoMonthlyReport(year, month));
  }),
);

admin.get('/reconciliation', asyncHandler(async (_req, res) => res.json(await reconcileSafeguarding())));

admin.get('/audit/verify', asyncHandler(async (_req, res) => {
  res.json(verifyAuditChain(await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } })));
}));

admin.get('/aml/alerts', asyncHandler(async (_req, res) => {
  res.json(await prisma.amlAlert.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: 'desc' }, include: { user: { select: { firstName: true, lastName: true, phone: true } } } }));
}));

admin.post('/aml/alerts/:id/resolve', validate(z.object({ unfreeze: z.boolean() })), asyncHandler(async (req, res) => {
  const alert = await prisma.amlAlert.findUnique({ where: { id: req.params.id } });
  if (!alert) throw notFound();
  await prisma.$transaction(async (tx) => {
    await tx.amlAlert.update({ where: { id: alert.id }, data: { resolvedAt: new Date() } });
    if ((req.body as { unfreeze: boolean }).unfreeze) await tx.user.update({ where: { id: alert.userId }, data: { status: 'ACTIVE' } });
    await appendAudit(tx, { action: 'AML_RESOLVED', entity: 'AmlAlert', entityId: alert.id, payload: req.body });
  });
  res.json({ ok: true });
}));

admin.post('/kyc/:userId/approve', validate(z.object({ level: z.union([z.literal(2), z.literal(3)]) })), asyncHandler(async (req, res) => {
  const { level } = req.body as { level: 2 | 3 };
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) throw notFound();
  if (level !== user.kycLevel + 1) throw badRequest('Niveau non séquentiel');
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { kycLevel: level } });
    await appendAudit(tx, { userId: user.id, action: 'KYC_APPROVED', entity: 'User', entityId: user.id, payload: { level } });
  });
  await notify(user.id, { title: `KYC niveau ${level} validé ✅`, body: 'Vos plafonds ont été relevés.', type: 'KYC' });
  res.json({ ok: true });
}));

/** Décision du comité Bridge Investment Partners sur un projet soumis. */
admin.post('/projects/:id/review', validate(z.object({ decision: z.enum(['UNDER_REVIEW', 'ACTIVE', 'REJECTED']), comment: z.string().optional() })), asyncHandler(async (req, res) => {
  const { decision, comment } = req.body as { decision: 'UNDER_REVIEW' | 'ACTIVE' | 'REJECTED'; comment?: string };
  const p = await prisma.project.update({
    where: { id: req.params.id },
    data: { status: decision, validatedBy: decision === 'ACTIVE' ? CROWDFUND_VALIDATOR : null },
  });
  await prisma.$transaction((tx) => appendAudit(tx, { action: `PROJECT_${decision}`, entity: 'Project', entityId: p.id, payload: { comment: comment ?? null } }));
  const labels = { UNDER_REVIEW: 'en cours d\'examen', ACTIVE: `validé par ${CROWDFUND_VALIDATOR} et publié`, REJECTED: 'non retenu' };
  await notify(p.submittedBy, { title: 'Mise à jour de votre projet', body: `« ${p.name} » est ${labels[decision]}.${comment ? ` ${comment}` : ''}`, type: 'CROWDFUND' });
  res.json({ id: p.id, status: p.status });
}));

admin.post('/complaints/:id/respond', validate(z.object({ response: z.string().min(5), status: z.enum(['IN_PROGRESS', 'RESOLVED', 'CLOSED']) })), asyncHandler(async (req, res) => {
  const { response, status } = req.body as { response: string; status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' };
  const c = await prisma.complaint.update({ where: { id: req.params.id }, data: { response, status, respondedAt: new Date() } });
  await notify(c.userId, { title: 'Réponse à votre réclamation', body: response.slice(0, 140), type: 'SYSTEM' });
  res.json(c);
}));

router.use('/admin', admin);
