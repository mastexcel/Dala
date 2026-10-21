import type { BondDTO, FundDTO } from '@dala/shared';

/**
 * Catalogue des titres publics UMOA et des FCP distribués.
 * En production : synchronisé depuis le flux UMOA-Titres (émissions en cours, taux, maturités)
 * par une tâche planifiée. Les données ci-dessous servent de référentiel sandbox.
 */
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000).toISOString();
}

const today = new Date();

export const BONDS: BondDTO[] = [
  { id: 'bt-ci-364', issuerCountry: 'CI', issuerName: "Trésor public de Côte d'Ivoire", type: 'TREASURY_BOND', rate: 0.06, maturityDays: 364, minAmount: 10_000, isHalal: false, issueDate: addDays(today, -3), closingDate: addDays(today, 12), description: "Bon assimilable du Trésor émis par la Côte d'Ivoire, intérêts versés à l'échéance." },
  { id: 'bt-sn-182', issuerCountry: 'SN', issuerName: 'Trésor public du Sénégal', type: 'TREASURY_BOND', rate: 0.0575, maturityDays: 182, minAmount: 10_000, isHalal: false, issueDate: addDays(today, -1), closingDate: addDays(today, 9), description: 'Bon du Trésor à 6 mois, idéal pour une épargne de précaution rémunérée.' },
  { id: 'bt-ml-91', issuerCountry: 'ML', issuerName: 'Trésor public du Mali', type: 'TREASURY_BOND', rate: 0.055, maturityDays: 91, minAmount: 5_000, isHalal: false, issueDate: addDays(today, -2), closingDate: addDays(today, 5), description: 'Bon du Trésor à 3 mois, liquidité rapide.' },
  { id: 'bt-bf-364', issuerCountry: 'BF', issuerName: 'Trésor public du Burkina Faso', type: 'TREASURY_BOND', rate: 0.065, maturityDays: 364, minAmount: 10_000, isHalal: false, issueDate: addDays(today, -4), closingDate: addDays(today, 14), description: 'Bon du Trésor à 12 mois au rendement élevé.' },
  { id: 'sk-ci-364', issuerCountry: 'CI', issuerName: "État de Côte d'Ivoire — Sukuk", type: 'SUKUK', rate: 0.0585, maturityDays: 364, minAmount: 10_000, isHalal: true, issueDate: addDays(today, -5), closingDate: addDays(today, 20), description: 'Certificat Sukuk adossé à des actifs réels, conforme aux principes de la finance islamique.' },
  { id: 'sk-sn-728', issuerCountry: 'SN', issuerName: 'État du Sénégal — Sukuk', type: 'SUKUK', rate: 0.062, maturityDays: 728, minAmount: 25_000, isHalal: true, issueDate: addDays(today, -6), closingDate: addDays(today, 25), description: 'Sukuk Ijara à 2 ans, revenus locatifs distribués semestriellement.' },
];

export const FUNDS: FundDTO[] = [
  { id: 'fcp-monetaire', name: 'FCP DALA Monétaire', manager: 'SGO agréée CREPMF', ytdPerformance: 0.042, risk: 'FAIBLE', fees: 0.005, minAmount: 5_000, isHalal: false },
  { id: 'fcp-obligataire', name: 'FCP Obligations UEMOA', manager: 'SGO agréée CREPMF', ytdPerformance: 0.058, risk: 'FAIBLE', fees: 0.0075, minAmount: 10_000, isHalal: false },
  { id: 'fcp-diversifie', name: 'FCP Croissance BRVM', manager: 'SGO agréée CREPMF', ytdPerformance: 0.091, risk: 'MOYEN', fees: 0.015, minAmount: 25_000, isHalal: false },
  { id: 'fcp-ethique', name: 'FCP Al Baraka Éthique', manager: 'SGO agréée CREPMF', ytdPerformance: 0.067, risk: 'MOYEN', fees: 0.012, minAmount: 10_000, isHalal: true },
];

export function findInstrument(id: string): { kind: 'bond'; item: BondDTO } | { kind: 'fund'; item: FundDTO } | null {
  const bond = BONDS.find((b) => b.id === id);
  if (bond) return { kind: 'bond', item: bond };
  const fund = FUNDS.find((f) => f.id === id);
  if (fund) return { kind: 'fund', item: fund };
  return null;
}

export function instrumentName(id: string): string {
  const i = findInstrument(id);
  if (!i) return id;
  return i.kind === 'bond' ? `${i.item.type === 'SUKUK' ? 'Sukuk' : 'Bon du Trésor'} ${i.item.issuerCountry} ${i.item.maturityDays} j` : i.item.name;
}
