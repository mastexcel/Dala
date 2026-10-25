import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import type { Prisma, TransactionType } from '@prisma/client';
import { formatDate, formatFCFA, LEGAL_NOTICE, TEST_PHASE_NOTICE } from '@dala/shared';
import { prisma, num } from '../lib/prisma';
import { asyncHandler, notFound } from '../lib/errors';
import { transactionDTO } from '../lib/serialize';
import { validate } from '../middleware/validate';
import type { AuthedRequest } from '../middleware/auth';

export const router = Router();
const uid = (req: unknown) => (req as AuthedRequest).user.id;

export const CATEGORY_TYPES: Record<string, TransactionType[]> = {
  SAVINGS: ['SAVINGS_IN', 'SAVINGS_OUT'],
  INVEST: ['INVESTMENT_BUY', 'INVESTMENT_RETURN'],
  CROWDFUND: ['CROWDFUND_IN', 'CROWDFUND_RETURN'],
  CREDIT: ['LOAN_DISBURSEMENT', 'LOAN_REPAYMENT'],
  TRANSFER: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE'],
};

const listSchema = z.object({
  category: z.enum(['ALL', 'SAVINGS', 'INVEST', 'CROWDFUND', 'CREDIT', 'TRANSFER']).default('ALL'),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function whereFor(userId: string, p: z.infer<typeof listSchema>): Prisma.TransactionWhereInput {
  return {
    userId,
    ...(p.category !== 'ALL' ? { type: { in: CATEGORY_TYPES[p.category] } } : {}),
    ...(p.q ? { OR: [{ description: { contains: p.q, mode: 'insensitive' } }, { reference: { contains: p.q, mode: 'insensitive' } }] } : {}),
    ...(p.from || p.to ? { createdAt: { ...(p.from ? { gte: p.from } : {}), ...(p.to ? { lte: p.to } : {}) } } : {}),
  };
}

router.get(
  '/',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const p = req.query as unknown as z.infer<typeof listSchema>;
    const items = await prisma.transaction.findMany({
      where: whereFor(uid(req), p),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: p.limit + 1,
      ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > p.limit;
    const page = hasMore ? items.slice(0, p.limit) : items;
    res.json({ items: page.map(transactionDTO), nextCursor: hasMore ? page[page.length - 1].id : null });
  }),
);

const csvEscape = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

router.get(
  '/export',
  validate(listSchema.extend({ format: z.enum(['csv', 'pdf']).default('csv') }), 'query'),
  asyncHandler(async (req, res) => {
    const p = req.query as unknown as z.infer<typeof listSchema> & { format: 'csv' | 'pdf' };
    const userId = uid(req);
    const [user, items] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.transaction.findMany({ where: whereFor(userId, p), orderBy: { createdAt: 'desc' }, take: 5_000 }),
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    if (p.format === 'csv') {
      const header = 'Date;Référence;Type;Libellé;Montant (FCFA);Statut';
      const rows = items.map((t) =>
        [t.createdAt.toISOString(), t.reference ?? '', t.type, t.description, String(num(t.amount)), t.status].map(csvEscape).join(';'),
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="dala-releve-${stamp}.csv"`);
      // Mention légale (éditeur, phase de test LIF-BCEAO, établissement agréé partenaire) en pied de relevé.
      return res.send(`﻿${[header, ...rows, '', csvEscape(LEGAL_NOTICE)].join('\n')}`);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dala-releve-${stamp}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);
    doc.fillColor('#0F1B3D').fontSize(20).text('DALA Finance — Relevé de transactions');
    doc.moveDown(0.5).fontSize(10).fillColor('#343A40').text(`${user.firstName} ${user.lastName} · ${user.phone}`);
    doc.text(`Édité le ${formatDate(new Date())}`);
    doc.fillColor('#8A6608').text(TEST_PHASE_NOTICE).moveDown();
    for (const t of items) {
      const amount = num(t.amount);
      doc.fillColor('#212529').fontSize(9).text(`${formatDate(t.createdAt)}  ${t.description}`, { continued: true });
      doc.fillColor(amount >= 0 ? '#1B8A6B' : '#E74C3C').text(`  ${formatFCFA(amount, { sign: true })}`, { align: 'right' });
    }
    doc.moveDown().fontSize(7).fillColor('#6C757D').text(LEGAL_NOTICE);
    doc.end();
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const t = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: uid(req) } });
    if (!t) throw notFound();
    res.json({ ...transactionDTO(t), metadata: t.metadata });
  }),
);
