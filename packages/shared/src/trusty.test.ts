import { describe, expect, it } from 'vitest';
import { TRUSTY, escrowActions } from './trusty';

const base = { initiator: 'BUYER' as const, deliveryDeadline: null, inspectionEndsAt: null, codeAttempts: 0 };

describe('Trusty : actions selon l’étape et le rôle', () => {
  it('seul l’autre participant accepte, seul l’acheteur bloque les fonds', () => {
    expect(escrowActions({ ...base, status: 'PROPOSED' }, 'BUYER')).not.toContain('accept');
    expect(escrowActions({ ...base, status: 'PROPOSED' }, 'SELLER')).toContain('accept');
    expect(escrowActions({ ...base, status: 'ACCEPTED' }, 'BUYER')).toContain('fund');
    expect(escrowActions({ ...base, status: 'ACCEPTED' }, 'SELLER')).not.toContain('fund');
  });

  it('fonds bloqués : le vendeur livre, l’acheteur libère et ne récupère qu’après le délai', () => {
    const funded = { ...base, status: 'FUNDED' as const, deliveryDeadline: '2026-11-01T00:00:00Z' };
    expect(escrowActions(funded, 'SELLER')).toEqual(expect.arrayContaining(['deliver', 'redeem', 'refund']));
    expect(escrowActions(funded, 'SELLER')).not.toContain('release');
    expect(escrowActions(funded, 'BUYER', new Date('2026-10-30'))).not.toContain('reclaim');
    expect(escrowActions(funded, 'BUYER', new Date('2026-11-02'))).toContain('reclaim');
  });

  it('litige possible pendant la vérification seulement ; code bloqué après trop d’essais', () => {
    const delivered = { ...base, status: 'DELIVERED' as const, inspectionEndsAt: '2026-11-01T00:00:00Z' };
    expect(escrowActions(delivered, 'BUYER', new Date('2026-10-31'))).toContain('dispute');
    expect(escrowActions(delivered, 'BUYER', new Date('2026-11-02'))).not.toContain('dispute');
    expect(escrowActions({ ...delivered, codeAttempts: TRUSTY.maxCodeAttempts }, 'SELLER')).not.toContain('redeem');
    expect(escrowActions({ ...base, status: 'RELEASED' }, 'BUYER')).toEqual([]);
  });
});
