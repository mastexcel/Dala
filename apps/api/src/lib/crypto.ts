import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

export function randomDigits(length: number): string {
  return Array.from({ length }, () => randomInt(0, 10)).join('');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Référence de transaction lisible : DLA-20260412-8F3K2Q */
export function transactionReference(now = new Date()): string {
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `DLA-${d}-${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;
}
