import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/errors';
import { notificationDTO } from '../lib/serialize';
import type { AuthedRequest } from '../middleware/auth';

export const router = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.notification.count({ where: { userId: uid(req), isRead: false } }),
    ]);
    res.json({ items: items.map(notificationDTO), unread });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: uid(req), isRead: false }, data: { isRead: true } });
    res.status(204).end();
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: uid(req) }, data: { isRead: true } });
    res.status(204).end();
  }),
);
