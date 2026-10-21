import { Prisma } from '@prisma/client';
import { sha256 } from '../lib/crypto';
import type { Tx } from '../lib/prisma';

export const GENESIS_HASH = '0'.repeat(64);

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: Prisma.InputJsonValue;
}

/** JSON à clés triées : PostgreSQL (jsonb) ne conserve pas l'ordre des clés. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

/** Hash déterministe d'une entrée : toute modification a posteriori casse la chaîne. */
export function computeAuditHash(prevHash: string, entry: AuditEntry, createdAt: Date): string {
  return sha256(
    canonicalJson([prevHash, entry.userId ?? null, entry.action, entry.entity, entry.entityId ?? null, entry.payload ?? null, createdAt.toISOString()]),
  );
}

/**
 * Ajoute une entrée à la piste d'audit chaînée (Art. 48-51).
 * Un verrou consultatif PostgreSQL sérialise les écritures pour garantir l'ordre de la chaîne.
 */
export async function appendAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
  const last = await tx.auditLog.findFirst({ orderBy: { seq: 'desc' }, select: { hash: true } });
  const prevHash = last?.hash ?? GENESIS_HASH;
  const createdAt = new Date();
  await tx.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      payload: entry.payload ?? Prisma.JsonNull,
      prevHash,
      hash: computeAuditHash(prevHash, entry, createdAt),
      createdAt,
    },
  });
}

/** Vérifie l'intégrité de toute la chaîne d'audit. Renvoie la première séquence corrompue. */
export function verifyAuditChain(
  rows: { seq: number; userId: string | null; action: string; entity: string; entityId: string | null; payload: unknown; prevHash: string; hash: string; createdAt: Date }[],
): { valid: true } | { valid: false; brokenAt: number } {
  let prev = GENESIS_HASH;
  for (const r of rows) {
    const expected = computeAuditHash(
      prev,
      { userId: r.userId, action: r.action, entity: r.entity, entityId: r.entityId, payload: (r.payload ?? undefined) as Prisma.InputJsonValue },
      r.createdAt,
    );
    if (r.prevHash !== prev || r.hash !== expected) return { valid: false, brokenAt: r.seq };
    prev = r.hash;
  }
  return { valid: true };
}
