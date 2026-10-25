import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Prisma } from '@prisma/client';
import type { AdvisorMessageDTO } from '@dala/shared';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/jwt';
import { config, foreignProcessorAllowed } from '../config';
import { logger } from '../lib/logger';
import { notificationDTO } from '../lib/serialize';

let io: Server | null = null;

/** WebSocket temps réel : chaque utilisateur rejoint la room `user:<id>` après vérification du JWT. */
export function attachRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: config.CORS_ORIGINS.split(',') } });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      socket.data.userId = verifyAccessToken(token).sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId}`);
  });
  return io;
}

async function sendPush(token: string, title: string, body: string, data?: Record<string, string>) {
  // Firebase (Google) est hébergé hors de l'UEMOA : push désactivé tant qu'il n'est pas déclaré.
  if (!config.FCM_SERVER_KEY || !foreignProcessorAllowed('fcm')) return;
  try {
    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { Authorization: `key=${config.FCM_SERVER_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, notification: { title, body }, data }),
    });
  } catch (err) {
    logger.warn({ err }, 'Échec envoi push FCM');
  }
}

export interface NotifyInput {
  title: string;
  body: string;
  type: 'TRANSACTION' | 'SAVINGS' | 'INVEST' | 'CROWDFUND' | 'CREDIT' | 'SECURITY' | 'KYC' | 'SYSTEM';
  data?: Prisma.InputJsonValue;
}

/** Notification immédiate de toute opération (Art. 52-74) : base + WebSocket + push. */
export async function notify(userId: string, input: NotifyInput) {
  const n = await prisma.notification.create({ data: { userId, ...input } });
  io?.to(`user:${userId}`).emit('notification', notificationDTO(n));
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
  // Le contenu (montants, noms) ne quitte pas l'UEMOA : la notification push reste générique.
  if (user?.pushToken) await sendPush(user.pushToken, 'DALA Finance', 'Vous avez une nouvelle notification.', { type: input.type });
  return n;
}

export function emitBalanceChanged(userId: string) {
  io?.to(`user:${userId}`).emit('balance:changed');
}

/** Nouvelle réponse d'un conseiller : la conversation ouverte se met à jour sans attendre. */
export function emitAdvisorMessage(userId: string, conversationId: string, message: AdvisorMessageDTO) {
  io?.to(`user:${userId}`).emit('advisor:message', { conversationId, message });
}
