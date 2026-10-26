import { TEST_PHASE } from './constants';

/**
 * Trusty : transaction sécurisée par séquestre.
 * L'acheteur bloque les fonds ; DALA ne les verse au vendeur qu'une fois le bien livré
 * ou le service rendu. Les règles ci-dessous sont communes à l'API et à l'application.
 *
 * Protocole :
 *  1. L'un des deux (acheteur ou vendeur) propose la transaction : objet, montant, délais.
 *  2. L'autre accepte les conditions.
 *  3. L'acheteur bloque les fonds (PIN) : le vendeur voit qu'ils sont sécurisés et peut livrer.
 *  4. Livraison :
 *     - remise en main propre : l'acheteur donne son code de remise au vendeur, qui le saisit ;
 *       les fonds sont versés aussitôt ;
 *     - à distance : le vendeur déclare la livraison, l'acheteur a un délai de vérification
 *       pour confirmer ou ouvrir un litige. Sans réponse, les fonds sont versés au vendeur.
 *  5. Litige : fonds gelés, un médiateur DALA examine les échanges et décide
 *     (versement au vendeur, remboursement de l'acheteur ou partage).
 *  Sans livraison dans le délai convenu, l'acheteur récupère ses fonds.
 */
export const TRUSTY = {
  name: 'Trusty',
  minAmount: 1_000,
  maxAmount: TEST_PHASE.limits.trustyMax,
  /** Délai de livraison proposé (jours après le blocage des fonds). */
  deliveryDaysOptions: [1, 3, 7, 14, 30],
  defaultDeliveryDays: 7,
  /** Délai de vérification après la déclaration de livraison (heures). */
  inspectionHoursOptions: [24, 48, 72, 168],
  defaultInspectionHours: 48,
  /** Une proposition non acceptée ou non financée expire après ce délai (jours). */
  proposalTtlDays: 7,
  /** Remboursement automatique si rien n'est livré, après le délai de livraison plus cette marge (heures). */
  refundGraceHours: 72,
  /** Tentatives de saisie du code de remise avant blocage. */
  maxCodeAttempts: 5,
  /** Frais Trusty : gratuit pendant la phase de test. */
  feeRate: 0,
} as const;

export type EscrowStatus = 'PROPOSED' | 'ACCEPTED' | 'FUNDED' | 'DELIVERED' | 'DISPUTED' | 'RELEASED' | 'REFUNDED' | 'CANCELLED';
export type EscrowRole = 'BUYER' | 'SELLER';
export type EscrowActor = EscrowRole | 'SYSTEM' | 'MEDIATOR';
export type EscrowAction = 'accept' | 'fund' | 'cancel' | 'deliver' | 'redeem' | 'release' | 'dispute' | 'refund' | 'reclaim' | 'message';

export const ESCROW_STATUS_LABEL: Record<EscrowStatus, string> = {
  PROPOSED: 'En attente d’acceptation',
  ACCEPTED: 'En attente du blocage des fonds',
  FUNDED: 'Fonds bloqués · livraison attendue',
  DELIVERED: 'Livré · vérification en cours',
  DISPUTED: 'Litige · médiation DALA',
  RELEASED: 'Terminée · vendeur payé',
  REFUNDED: 'Remboursée à l’acheteur',
  CANCELLED: 'Annulée',
};

export const ESCROW_CLOSED: EscrowStatus[] = ['RELEASED', 'REFUNDED', 'CANCELLED'];

export interface EscrowEventDTO {
  id: string;
  actor: EscrowActor;
  type: string;
  message: string;
  createdAt: string;
}

export interface EscrowDTO {
  id: string;
  code: string;
  title: string;
  description: string | null;
  amount: number;
  /** Rôle de l'utilisateur qui consulte. */
  role: EscrowRole;
  initiator: EscrowRole;
  status: EscrowStatus;
  counterparty: { name: string; phone: string; completedDeals: number };
  deliveryDays: number;
  inspectionHours: number;
  deliveryDeadline: string | null;
  inspectionEndsAt: string | null;
  fundedAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  deliveryNote: string | null;
  /** Code de remise : visible par l'acheteur seulement, à donner au vendeur à la livraison. */
  releaseCode: string | null;
  codeAttemptsLeft: number;
  resolution: { sellerAmount: number; buyerAmount: number; note: string } | null;
  actions: EscrowAction[];
  events: EscrowEventDTO[];
  createdAt: string;
}

export interface EscrowState {
  status: EscrowStatus;
  initiator: EscrowRole;
  deliveryDeadline: Date | string | null;
  inspectionEndsAt: Date | string | null;
  codeAttempts: number;
}

const time = (d: Date | string | null) => (d ? new Date(d).getTime() : null);

/** Actions possibles pour l'un des deux participants : l'API les vérifie, l'application les affiche. */
export function escrowActions(e: EscrowState, role: EscrowRole, now = new Date()): EscrowAction[] {
  const t = now.getTime();
  const a: EscrowAction[] = [];
  const buyer = role === 'BUYER';
  switch (e.status) {
    case 'PROPOSED':
      if (role !== e.initiator) a.push('accept');
      a.push('cancel');
      break;
    case 'ACCEPTED':
      if (buyer) a.push('fund');
      a.push('cancel');
      break;
    case 'FUNDED':
      if (buyer) {
        a.push('release', 'dispute');
        const deadline = time(e.deliveryDeadline);
        if (deadline !== null && t > deadline) a.push('reclaim');
      } else {
        a.push('deliver', 'refund');
        if (e.codeAttempts < TRUSTY.maxCodeAttempts) a.push('redeem');
      }
      break;
    case 'DELIVERED':
      if (buyer) {
        a.push('release');
        const end = time(e.inspectionEndsAt);
        if (end === null || t <= end) a.push('dispute');
      } else {
        a.push('refund');
        if (e.codeAttempts < TRUSTY.maxCodeAttempts) a.push('redeem');
      }
      break;
    case 'DISPUTED':
      if (!buyer) a.push('refund');
      break;
    default:
      return [];
  }
  a.push('message');
  return a;
}

/** Code de remise à 6 chiffres. */
export function newReleaseCode(random: () => number = Math.random) {
  return String(Math.floor(random() * 1_000_000)).padStart(6, '0');
}
