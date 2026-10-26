import { ESCROW_STATUS_LABEL, type EscrowStatus } from '@dala/shared';
import { COLORS, TEXT_ON_WHITE } from '@/theme';

export const ESCROW_STATUS_COLOR: Record<EscrowStatus, string> = {
  PROPOSED: TEXT_ON_WHITE.blue,
  ACCEPTED: TEXT_ON_WHITE.blue,
  FUNDED: TEXT_ON_WHITE.orange,
  DELIVERED: TEXT_ON_WHITE.orange,
  DISPUTED: TEXT_ON_WHITE.red,
  RELEASED: TEXT_ON_WHITE.green,
  REFUNDED: COLORS.darkGray,
  CANCELLED: COLORS.darkGray,
};

export const escrowStatus = (s: EscrowStatus) => ({ label: ESCROW_STATUS_LABEL[s], color: ESCROW_STATUS_COLOR[s] });

/** Les quatre étapes affichées dans le suivi. */
export const ESCROW_STEPS = ['Accord', 'Fonds bloqués', 'Livraison', 'Paiement'] as const;

export function escrowStep(s: EscrowStatus): number {
  switch (s) {
    case 'PROPOSED':
      return 0;
    case 'ACCEPTED':
      return 1;
    case 'FUNDED':
      return 2;
    case 'DELIVERED':
    case 'DISPUTED':
      return 3;
    default:
      return 4;
  }
}

export const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
