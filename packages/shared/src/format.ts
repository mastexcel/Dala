import { CURRENCY_LABEL } from './constants';

/** Espace insécable fine utilisée comme séparateur de milliers (norme française). */
const THIN_NBSP = ' ';

/** Formate un entier avec séparateur de milliers, sans dépendre d'Intl (Hermes). */
export function formatNumber(value: number, decimals = 0): string {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_NBSP);
  return (negative ? '-' : '') + grouped + (dec ? `,${dec}` : '');
}

/** 247500 → "247 500 FCFA". Le FCFA n'a pas de subdivision : arrondi à l'unité. */
export function formatFCFA(value: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const rounded = Math.round(value);
  const sign = opts.sign && rounded > 0 ? '+' : '';
  if (opts.compact) return `${sign}${formatCompact(rounded)} ${CURRENCY_LABEL}`;
  return `${sign}${formatNumber(rounded)} ${CURRENCY_LABEL}`;
}

/** 39 000 000 → "39M", 125 000 → "125k". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const trim = (n: number) => formatNumber(n, n % 1 === 0 ? 0 : 1);
  if (abs >= 1_000_000_000) return `${sign}${trim(Math.round(abs / 100_000_000) / 10)}Md`;
  if (abs >= 1_000_000) return `${sign}${trim(Math.round(abs / 100_000) / 10)}M`;
  if (abs >= 1_000) return `${sign}${trim(Math.round(abs / 100) / 10)}k`;
  return `${sign}${abs}`;
}

/** 0.0532 → "5,32 %" */
export function formatPercent(ratio: number, decimals = 1): string {
  return `${formatNumber(ratio * 100, decimals)}${THIN_NBSP}%`;
}

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** "12 mars 2026" */
export function formatDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

/** Libellé relatif court pour les listes de transactions : "10h", "Hier", "Lun", "12 mars". */
export function formatRelative(input: string | Date, now: Date = new Date()): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
  if (days === 1) return 'Hier';
  if (days < 7) return DAYS_FR[d.getDay()];
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

/** Normalise un numéro local en E.164 : ("+225", "07 07 12 34 56") → "+2250707123456". */
export function toE164(dialCode: string, local: string): string {
  const digits = local.replace(/\D/g, '');
  return `${dialCode}${digits}`;
}

/** Masque un numéro pour l'affichage : +225 07 •• •• 56 */
export function maskPhone(e164: string): string {
  if (e164.length < 8) return e164;
  return `${e164.slice(0, 6)} •• •• ${e164.slice(-2)}`;
}
