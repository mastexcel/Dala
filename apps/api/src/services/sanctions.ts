import type { User } from '@prisma/client';

/**
 * Screening des listes de sanctions (CENTIF, GAFI, ONU, UE).
 * En production, brancher un fournisseur (ex. listes consolidées ONU/UE téléchargées quotidiennement)
 * via SANCTIONS_LIST_PATH. Ici : liste locale + correspondance approximative sur le nom complet.
 */
const LOCAL_LIST: string[] = (process.env.SANCTIONS_NAMES ?? '')
  .split(';')
  .map((s) => normalize(s))
  .filter(Boolean);

export function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesList(fullName: string, list: string[] = LOCAL_LIST): boolean {
  const n = normalize(fullName);
  if (!n) return false;
  const tokens = new Set(n.split(' '));
  return list.some((entry) => {
    const et = entry.split(' ');
    return et.length > 0 && et.every((t) => tokens.has(t));
  });
}

export async function screenUser(user: Pick<User, 'firstName' | 'lastName'>): Promise<boolean> {
  return matchesList(`${user.firstName} ${user.lastName}`);
}
