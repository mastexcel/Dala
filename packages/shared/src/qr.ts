import { detectCiOperator } from './compliance';
import type { MobileMoneyOperator } from './constants';

/**
 * Décodage des QR codes scannés depuis DALA.
 * - QR DALA (transfert entre comptes) et liens de demande de paiement DALA ;
 * - QR « EMVCo » (format international repris par la BCEAO pour les paiements instantanés
 *   interopérables de l'UEMOA, et par de nombreux commerçants) ;
 * - numéros de téléphone (tel:, carte de visite, texte brut) : envoi vers le mobile money ;
 * - liens des opérateurs (Wave, Orange Money, MTN MoMo, Moov Money), reconnus et signalés.
 */
export type ScannedCode =
  | { kind: 'dala-transfer'; phone: string; amount?: number }
  | { kind: 'dala-request'; code: string; url: string }
  | { kind: 'phone'; phone: string; amount?: number; operator: MobileMoneyOperator | null; name?: string }
  | {
      kind: 'emv';
      merchantName?: string;
      city?: string;
      amount?: number;
      /** Code devise ISO 4217 (952 = XOF / FCFA). */
      currency?: string;
      country?: string;
      /** Numéro de téléphone trouvé dans les données du compte, s'il y en a un. */
      phone?: string;
      operator: MobileMoneyOperator | null;
      /** Identifiants des réseaux de paiement (GUI) présents dans le QR. */
      networks: string[];
      crcValid: boolean;
    }
  | { kind: 'operator-link'; operator: MobileMoneyOperator; url: string }
  | { kind: 'unknown'; raw: string };

/* --------------------------------- EMVCo --------------------------------- */

export interface Tlv {
  tag: string;
  value: string;
}

/** Découpe une chaîne EMVCo en éléments TLV (tag sur 2 chiffres, longueur sur 2 chiffres). */
export function parseTlv(data: string): Tlv[] | null {
  const out: Tlv[] = [];
  let i = 0;
  while (i < data.length) {
    const tag = data.slice(i, i + 2);
    const len = Number(data.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(data.slice(i + 2, i + 4)) || i + 4 + len > data.length) return null;
    out.push({ tag, value: data.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

/** CRC16-CCITT (polynôme 0x1021, valeur initiale 0xFFFF), utilisé par le tag 63 des QR EMVCo. */
export function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const NETWORK_HINTS: { pattern: RegExp; operator: MobileMoneyOperator }[] = [
  { pattern: /orange/i, operator: 'ORANGE_MONEY' },
  { pattern: /mtn|momo/i, operator: 'MTN_MOMO' },
  { pattern: /moov|flooz/i, operator: 'MOOV_MONEY' },
  { pattern: /wave/i, operator: 'WAVE' },
];

/** Numéro de téléphone (ivoirien ou international) contenu dans un texte, au format E.164. */
export function extractPhone(text: string): string | undefined {
  const plus = /\+?(225|221|223|226|229|228|227|245)[\s.-]?(\d[\d\s.-]{6,13}\d)/.exec(text);
  if (plus) return `+${plus[1]}${plus[2].replace(/\D/g, '')}`;
  // Numéro ivoirien local à 10 chiffres (01, 05, 07…).
  const local = /(?:^|\D)(0[157](?:[\s.-]?\d{2}){4})(?:\D|$)/.exec(text);
  if (local) return `+225${local[1].replace(/\D/g, '')}`;
  return undefined;
}

function parseEmv(data: string): ScannedCode | null {
  if (!data.startsWith('000201')) return null;
  const tlv = parseTlv(data);
  if (!tlv) return null;
  const get = (t: string) => tlv.find((e) => e.tag === t)?.value;
  const crcIndex = data.lastIndexOf('6304');
  const crcValid = crcIndex >= 0 && crc16ccitt(data.slice(0, crcIndex + 4)) === data.slice(crcIndex + 4).toUpperCase();

  // Tags 26 à 51 : informations du compte marchand (GUI du réseau + identifiant).
  const networks: string[] = [];
  let phone: string | undefined;
  for (const e of tlv.filter((x) => Number(x.tag) >= 26 && Number(x.tag) <= 51)) {
    const sub = parseTlv(e.value);
    const gui = sub?.find((s) => s.tag === '00')?.value;
    if (gui) networks.push(gui);
    phone ??= extractPhone(sub ? sub.filter((s) => s.tag !== '00').map((s) => s.value).join(' ') : e.value);
  }
  // Tag 62 : données additionnelles (dont le numéro de mobile, sous-tag 02).
  const extra = parseTlv(get('62') ?? '');
  phone ??= extra?.find((s) => s.tag === '02')?.value ? extractPhone(extra!.find((s) => s.tag === '02')!.value) : undefined;

  const hinted = NETWORK_HINTS.find((h) => networks.some((n) => h.pattern.test(n)) || h.pattern.test(get('59') ?? ''))?.operator ?? null;
  const amount = get('54') ? Number(get('54')) : undefined;
  return {
    kind: 'emv',
    merchantName: get('59'),
    city: get('60'),
    amount: amount !== undefined && Number.isFinite(amount) ? Math.round(amount) : undefined,
    currency: get('53'),
    country: get('58'),
    phone,
    operator: phone ? (detectCiOperator(phone) ?? hinted) : hinted,
    networks,
    crcValid,
  };
}

/* ------------------------------ Point d'entrée ------------------------------ */

const OPERATOR_LINKS: { pattern: RegExp; operator: MobileMoneyOperator }[] = [
  { pattern: /^https?:\/\/([a-z0-9-]+\.)*wave\.com\//i, operator: 'WAVE' },
  { pattern: /^https?:\/\/([a-z0-9-]+\.)*orange(money)?[a-z0-9-]*\.(ci|com)\//i, operator: 'ORANGE_MONEY' },
  { pattern: /^https?:\/\/([a-z0-9-]+\.)*mtn[a-z0-9-]*\.(ci|com)\//i, operator: 'MTN_MOMO' },
  { pattern: /^https?:\/\/([a-z0-9-]+\.)*moov[a-z0-9-]*\.(ci|com)\//i, operator: 'MOOV_MONEY' },
];

export function parseScannedCode(input: string): ScannedCode {
  const raw = input.trim();

  // QR DALA : « dala:pay?to=+2250707000000&amount=5000 »
  const dala = /^dala:pay\?(.+)$/i.exec(raw);
  if (dala) {
    const params = new URLSearchParams(dala[1]);
    // Dans une URL, « + » est lu comme une espace : on rétablit l'indicatif international.
    const to = params.get('to')?.trim().replace(/^(\d)/, '+$1');
    const amount = Number(params.get('amount'));
    if (to) return { kind: 'dala-transfer', phone: to, amount: amount > 0 ? amount : undefined };
  }

  // Lien de demande de paiement DALA : « https://…/pay/CODE »
  const request = /^https?:\/\/[^\s]+\/pay\/([A-Z0-9]{6,12})\/?$/i.exec(raw);
  if (request) return { kind: 'dala-request', code: request[1].toUpperCase(), url: raw };

  const emv = parseEmv(raw);
  if (emv) return emv;

  for (const l of OPERATOR_LINKS) if (l.pattern.test(raw)) return { kind: 'operator-link', operator: l.operator, url: raw };

  // tel:, carte de visite (vCard / MECARD) ou numéro en texte brut.
  const name = /(?:^|\n)FN:(.+)/i.exec(raw)?.[1]?.trim() ?? /MECARD:N:([^;]+)/i.exec(raw)?.[1]?.trim();
  const phone = extractPhone(raw.replace(/^tel:/i, ''));
  if (phone) {
    const amount = Number(/(?:amount|montant)=(\d+)/i.exec(raw)?.[1]);
    return { kind: 'phone', phone, operator: detectCiOperator(phone), name, amount: amount > 0 ? amount : undefined };
  }
  return { kind: 'unknown', raw };
}
