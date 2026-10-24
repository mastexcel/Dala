import { Router } from 'express';
import { z } from 'zod';
import type { AdvisorConversation, AdvisorMessage } from '@prisma/client';
import { ADVISOR_HOURS, ADVISOR_TOPICS, type AdvisorConversationDTO, type AdvisorMessageDTO } from '@dala/shared';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireAdmin, type AuthedRequest } from '../middleware/auth';
import { emitAdvisorMessage, notify } from '../services/notifications';

/** Échanges écrits entre l'utilisateur et l'équipe commerciale. */
export const router = Router();
/** Poste des conseillers (back-office, clé x-admin-key). */
export const deskRouter = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;

const TOPICS = ['INVEST', 'CROWDFUND', 'SAVINGS', 'CREDIT', 'BUSINESS', 'OTHER'] as const satisfies readonly (keyof typeof ADVISOR_TOPICS)[];
const body = z.string().trim().min(1).max(4_000);

type ConversationWithLast = AdvisorConversation & { messages: AdvisorMessage[]; _count?: { messages: number } };

export function messageDTO(m: AdvisorMessage): AdvisorMessageDTO {
  return { id: m.id, sender: m.sender, authorName: m.authorName, body: m.body, createdAt: m.createdAt.toISOString() };
}

function conversationDTO(c: ConversationWithLast, unread: number): AdvisorConversationDTO {
  const last = c.messages.at(-1) ?? null;
  return {
    id: c.id,
    topic: c.topic,
    subject: c.subject,
    status: c.status,
    advisorName: c.advisorName,
    lastMessage: last?.body ?? null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    unread,
    createdAt: c.createdAt.toISOString(),
  };
}

const unreadFor = (c: AdvisorConversation) =>
  prisma.advisorMessage.count({ where: { conversationId: c.id, sender: { not: 'USER' }, createdAt: { gt: c.userReadAt } } });

/* ------------------------------ Utilisateur ------------------------------ */

router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const list = await prisma.advisorConversation.findMany({
      where: { userId: uid(req) },
      orderBy: { lastMessageAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    res.json(await Promise.all(list.map(async (c) => conversationDTO(c, await unreadFor(c)))));
  }),
);

const createSchema = z.object({ topic: z.enum(TOPICS), subject: z.string().trim().max(120).optional(), message: body });

router.post(
  '/conversations',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { topic, subject, message } = req.body as z.infer<typeof createSchema>;
    const now = Date.now();
    const c = await prisma.advisorConversation.create({
      data: {
        userId: uid(req),
        topic,
        subject: subject || ADVISOR_TOPICS[topic],
        messages: {
          create: [
            { sender: 'USER', body: message, createdAt: new Date(now) },
            {
              sender: 'SYSTEM',
              // Horodatage décalé : l'accusé de réception s'affiche toujours après le message.
              createdAt: new Date(now + 1),
              body: `Votre demande a bien été transmise à l'équipe commerciale DALA. Un conseiller vous répond ici ${ADVISOR_HOURS}.`,
            },
          ],
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    res.status(201).json({ ...conversationDTO(c, 0), messages: c.messages.map(messageDTO) });
  }),
);

async function ownConversation(req: unknown, id: string) {
  const c = await prisma.advisorConversation.findFirst({ where: { id, userId: uid(req) } });
  if (!c) throw notFound('Conversation introuvable');
  return c;
}

router.get(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    await ownConversation(req, req.params.id);
    // Ouvrir la conversation marque les réponses comme lues.
    const c = await prisma.advisorConversation.update({
      where: { id: req.params.id },
      data: { userReadAt: new Date() },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    res.json({ ...conversationDTO(c, 0), messages: c.messages.map(messageDTO) });
  }),
);

router.post(
  '/conversations/:id/messages',
  validate(z.object({ body })),
  asyncHandler(async (req, res) => {
    const c = await ownConversation(req, req.params.id);
    const now = new Date();
    const [m] = await prisma.$transaction([
      prisma.advisorMessage.create({ data: { conversationId: c.id, sender: 'USER', body: (req.body as { body: string }).body } }),
      // Un nouveau message rouvre une conversation clôturée.
      prisma.advisorConversation.update({ where: { id: c.id }, data: { lastMessageAt: now, userReadAt: now, status: 'OPEN' } }),
    ]);
    res.status(201).json(messageDTO(m));
  }),
);

/* -------------------------------- Conseillers -------------------------------- */

deskRouter.use(requireAdmin);

deskRouter.get(
  '/conversations',
  validate(z.object({ status: z.enum(['OPEN', 'CLOSED']).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const status = req.query.status as 'OPEN' | 'CLOSED' | undefined;
    const list = await prisma.advisorConversation.findMany({
      where: status ? { status } : {},
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        // Aperçu : dernier échange réel, sans l'accusé de réception automatique.
        messages: { where: { sender: { not: 'SYSTEM' } }, orderBy: { createdAt: 'desc' }, take: 1 },
        user: { select: { firstName: true, lastName: true, phone: true, kycLevel: true } },
      },
    });
    // Dernier message du client et dernière réponse d'un conseiller (les messages système ne comptent pas).
    const latest = await prisma.advisorMessage.groupBy({
      by: ['conversationId', 'sender'],
      where: { conversationId: { in: list.map((c) => c.id) }, sender: { in: ['USER', 'ADVISOR'] } },
      _max: { createdAt: true },
    });
    const last = (id: string, sender: 'USER' | 'ADVISOR') =>
      latest.find((l) => l.conversationId === id && l.sender === sender)?._max.createdAt ?? null;
    res.json(
      list.map((c) => {
        const fromUser = last(c.id, 'USER');
        const fromAdvisor = last(c.id, 'ADVISOR');
        return {
          ...conversationDTO(c, 0),
          user: c.user,
          awaitingReply: c.status === 'OPEN' && !!fromUser && (!fromAdvisor || fromUser > fromAdvisor),
        };
      }),
    );
  }),
);

deskRouter.get(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const c = await prisma.advisorConversation.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { firstName: true, lastName: true, phone: true, kycLevel: true } } },
    });
    if (!c) throw notFound('Conversation introuvable');
    res.json({ ...conversationDTO(c, 0), user: c.user, messages: c.messages.map(messageDTO) });
  }),
);

const replySchema = z.object({ body, authorName: z.string().trim().min(2).max(60) });

deskRouter.post(
  '/conversations/:id/messages',
  validate(replySchema),
  asyncHandler(async (req, res) => {
    const { body: text, authorName } = req.body as z.infer<typeof replySchema>;
    const c = await prisma.advisorConversation.findUnique({ where: { id: req.params.id } });
    if (!c) throw notFound('Conversation introuvable');
    if (c.status === 'CLOSED') throw badRequest('Conversation clôturée', 'CONVERSATION_CLOSED');
    const [m] = await prisma.$transaction([
      prisma.advisorMessage.create({ data: { conversationId: c.id, sender: 'ADVISOR', authorName, body: text } }),
      prisma.advisorConversation.update({ where: { id: c.id }, data: { lastMessageAt: new Date(), advisorName: c.advisorName ?? authorName } }),
    ]);
    emitAdvisorMessage(c.userId, c.id, messageDTO(m));
    await notify(c.userId, {
      title: `Réponse de ${authorName}`,
      body: text.length > 120 ? `${text.slice(0, 117)}…` : text,
      type: 'SYSTEM',
      data: { conversationId: c.id },
    });
    res.status(201).json(messageDTO(m));
  }),
);

deskRouter.post(
  '/conversations/:id/close',
  asyncHandler(async (req, res) => {
    const c = await prisma.advisorConversation.findUnique({ where: { id: req.params.id } });
    if (!c) throw notFound('Conversation introuvable');
    await prisma.$transaction([
      prisma.advisorMessage.create({ data: { conversationId: c.id, sender: 'SYSTEM', body: 'Conversation clôturée. Écrivez-nous à tout moment pour la rouvrir.' } }),
      prisma.advisorConversation.update({ where: { id: c.id }, data: { status: 'CLOSED', lastMessageAt: new Date() } }),
    ]);
    res.status(204).end();
  }),
);
