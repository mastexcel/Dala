/**
 * Base de données de démonstration en mémoire (mode démo, sans backend).
 * Les données reprennent le seed de l'API pour une expérience identique.
 */
import {
  CROWDFUND_VALIDATOR,
  addMonths,
  type BondDTO,
  type FundDTO,
  type LoanDTO,
  type NotificationDTO,
  type ProjectDTO,
  type SavingsGoalDTO,
  type TontineDTO,
  type TransactionDTO,
  type UserProfile,
  type VaultDTO,
  type InvestmentDTO,
  type CrowdfundHoldingDTO,
} from '@dala/shared';

const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export const DEMO_PIN = '1234';
export const DEMO_OTP = '123456';

export const db = {
  user: {
    id: 'u_awa',
    phone: '+2250707000000',
    firstName: 'Awa',
    lastName: 'Koné',
    email: 'awa.kone@example.ci',
    kycLevel: 2,
    avatarUrl: null,
    referralCode: 'AWA2025',
    referralCount: 3,
    creditScore: 72,
  } as UserProfile,
  balances: { MAIN: 247_500, SAVINGS: 850_000, VAULT: 100_000, INVESTMENT: 125_000, CROWDFUND: 75_000 },
  goals: [
    { id: 'g1', name: 'Mariage', targetAmount: 750_000, currentAmount: 520_000, deadline: inDays(180), autoSave: true, frequency: 'WEEKLY', autoAmount: 15_000, icon: 'heart' },
    { id: 'g2', name: 'Études de Kadi', targetAmount: 400_000, currentAmount: 210_000, deadline: inDays(300), autoSave: true, frequency: 'MONTHLY', autoAmount: 25_000, icon: 'graduation' },
    { id: 'g3', name: 'Commerce de pagnes', targetAmount: 150_000, currentAmount: 120_000, deadline: null, autoSave: false, frequency: null, autoAmount: null, icon: 'storefront' },
  ] as SavingsGoalDTO[],
  tontines: [
    {
      id: 't1',
      name: 'Tontine des Commerçantes de Treichville',
      amount: 20_000,
      frequency: 'WEEKLY',
      maxMembers: 5,
      currentCycle: 2,
      totalCycles: 5,
      status: 'ACTIVE',
      nextContributionDate: inDays(6),
      myPosition: 2,
      members: [
        { id: 'm1', userId: 'u1', name: 'Moussa T.', position: 1, hasPaid: true, hasReceived: true },
        { id: 'm2', userId: 'u_awa', name: 'Awa K.', position: 2, hasPaid: false, hasReceived: false },
        { id: 'm3', userId: 'u2', name: 'Fatou D.', position: 3, hasPaid: true, hasReceived: false },
        { id: 'm4', userId: 'u3', name: 'Yao K.', position: 4, hasPaid: false, hasReceived: false },
        { id: 'm5', userId: 'u4', name: 'Aminata C.', position: 5, hasPaid: false, hasReceived: false },
      ],
    },
  ] as TontineDTO[],
  vaults: [
    { id: 'v1', amount: 100_000, rate: 0.045, months: 6, createdAt: ago(45), unlockDate: addMonths(new Date(Date.now() - 45 * DAY), 6).toISOString(), accruedInterest: 555 },
  ] as VaultDTO[],
  investments: [
    { id: 'i1', type: 'TREASURY_BOND', instrumentId: 'bt-ci-364', instrumentName: 'Bon du Trésor CI 364 j', amount: 100_000, rate: 0.06, maturityDate: inDays(300), status: 'ACTIVE', isHalal: false, createdAt: ago(64) },
    { id: 'i2', type: 'SUKUK', instrumentId: 'sk-ci-364', instrumentName: 'Sukuk CI 364 j', amount: 25_000, rate: 0.0585, maturityDate: inDays(330), status: 'ACTIVE', isHalal: true, createdAt: ago(34) },
  ] as InvestmentDTO[],
  holdings: [
    { id: 'h1', projectId: 'p1', projectName: 'AgriTech CI', sector: 'AGRITECH', amount: 50_000, equityPct: 0.0002, estimatedValue: 50_000, status: 'EN_COURS', createdAt: ago(20) },
    { id: 'h2', projectId: 'p2', projectName: 'SolarKit Sahel', sector: 'SOLARTECH', amount: 25_000, equityPct: 0.000167, estimatedValue: 25_000, status: 'EN_COURS', createdAt: ago(4) },
  ] as CrowdfundHoldingDTO[],
  loans: [
    { id: 'l1', amount: 50_000, interestRate: 0.14, fees: 500, totalDue: 51_075, duration: 30, dueDate: ago(60), amountPaid: 51_075, status: 'REPAID', createdAt: ago(90), disbursedAt: ago(90) },
  ] as LoanDTO[],
  transactions: [
    { id: 'tx1', type: 'SAVINGS_IN', amount: -15_000, currency: 'XOF', description: 'Épargne auto · Mariage', reference: 'DLA-DEMO-1', status: 'COMPLETED', createdAt: hoursAgo(2) },
    { id: 'tx2', type: 'INVESTMENT_RETURN', amount: 3_125, currency: 'XOF', description: 'Coupon Bon du Trésor CI', reference: 'DLA-DEMO-2', status: 'COMPLETED', createdAt: hoursAgo(26) },
    { id: 'tx3', type: 'CROWDFUND_IN', amount: -25_000, currency: 'XOF', description: 'Crowdfund · SolarKit Sahel', reference: 'DLA-DEMO-3', status: 'COMPLETED', createdAt: hoursAgo(96) },
    { id: 'tx4', type: 'DEPOSIT', amount: 100_000, currency: 'XOF', description: 'Dépôt Orange Money', reference: 'DLA-DEMO-4', status: 'COMPLETED', createdAt: hoursAgo(120) },
    { id: 'tx5', type: 'TRANSFER_IN', amount: 12_500, currency: 'XOF', description: 'Reçu de Moussa T.', reference: 'DLA-DEMO-5', status: 'COMPLETED', createdAt: hoursAgo(170) },
    { id: 'tx6', type: 'SAVINGS_IN', amount: -20_000, currency: 'XOF', description: 'Cotisation tontine · Treichville', reference: 'DLA-DEMO-6', status: 'COMPLETED', createdAt: hoursAgo(200) },
    { id: 'tx7', type: 'CROWDFUND_IN', amount: -50_000, currency: 'XOF', description: 'Crowdfund · AgriTech CI', reference: 'DLA-DEMO-7', status: 'COMPLETED', createdAt: hoursAgo(480) },
    { id: 'tx8', type: 'INVESTMENT_BUY', amount: -25_000, currency: 'XOF', description: 'Sukuk CI 364 j', reference: 'DLA-DEMO-8', status: 'COMPLETED', createdAt: hoursAgo(820) },
    { id: 'tx9', type: 'LOAN_REPAYMENT', amount: -51_075, currency: 'XOF', description: 'Remboursement prêt DALA', reference: 'DLA-DEMO-9', status: 'COMPLETED', createdAt: ago(62) },
  ] as TransactionDTO[],
  notifications: [
    { id: 'n1', title: 'Coupon reçu', body: '3 125 FCFA de votre Bon du Trésor CI.', type: 'INVEST', isRead: false, createdAt: hoursAgo(26) },
    { id: 'n2', title: 'Bienvenue sur DALA 👋', body: 'Djigui — Ton avenir commence ici.', type: 'SYSTEM', isRead: true, createdAt: ago(240) },
  ] as NotificationDTO[],
};

const docs = [
  { name: 'Business plan', url: 'https://example.com/bp.pdf', kind: 'BUSINESS_PLAN' as const },
  { name: `Rapport de validation ${CROWDFUND_VALIDATOR}`, url: 'https://example.com/validation.pdf', kind: 'VALIDATION' as const },
  { name: 'Projections financières 5 ans', url: 'https://example.com/proj.pdf', kind: 'PROJECTIONS' as const },
];
const team = [
  { name: 'Mariam Bamba', role: 'Fondatrice & CEO' },
  { name: 'Jean-Marc Aka', role: 'Directeur des opérations' },
  { name: 'Salimata Koné', role: 'Responsable financière' },
];

function project(p: Omit<ProjectDTO, 'status' | 'validatedBy' | 'documents' | 'teamMembers' | 'galleryUrls'>): ProjectDTO {
  return { ...p, status: 'ACTIVE', validatedBy: CROWDFUND_VALIDATOR, documents: docs, teamMembers: team, galleryUrls: p.imageUrl ? [p.imageUrl] : [] };
}

export const projects: ProjectDTO[] = [
  project({ id: 'p1', name: 'AgriTech CI', tagline: 'Coopérative cacao bio', sector: 'AGRITECH', description: 'Coopérative de cacao bio certifiée qui équipe 1 200 producteurs de Soubré en capteurs et en traçabilité. La plateforme connecte directement les planteurs aux chocolatiers.', problem: "Les planteurs perçoivent moins de 10 % de la valeur finale et la traçabilité exigée à l'export est inexistante.", solution: 'Traçabilité par parcelle, prime bio négociée collectivement, préfinancement des intrants.', targetMarket: "Producteurs de cacao de Côte d'Ivoire", fundingGoal: 50_000_000, fundingRaised: 39_000_000, valuation: 250_000_000, equityMin: 0.15, equityMax: 0.25, deadline: inDays(18), imageUrl: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=1200', investorCount: 142 }),
  project({ id: 'p2', name: 'SolarKit Sahel', tagline: 'Kits solaires en paiement à l\'usage', sector: 'SOLARTECH', description: "Kits solaires en paiement à l'usage pour les boutiques rurales, payés par mobile money et entretenus par des techniciennes formées localement.", problem: "60 % des commerces ruraux n'ont pas d'électricité fiable après 18 h.", solution: 'Kits 200 W financés par micro-paiements journaliers via mobile money.', targetMarket: 'Commerces ruraux UEMOA', fundingGoal: 30_000_000, fundingRaised: 12_600_000, valuation: 150_000_000, equityMin: 0.1, equityMax: 0.2, deadline: inDays(32), imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1200', investorCount: 87 }),
  project({ id: 'p3', name: 'Garba Express', tagline: '4 000 repas livrés par jour à Abidjan', sector: 'FOODTECH', description: 'Réseau de cuisines centrales qui livre 4 000 repas par jour aux bureaux du Plateau et de Cocody. Commande WhatsApp et paiement mobile.', problem: "Les salariés manquent d'options de repas abordables, hygiéniques et rapides.", solution: 'Cuisines centrales certifiées et livraison à moto en moins de 30 minutes.', targetMarket: "Salariés d'Abidjan", fundingGoal: 20_000_000, fundingRaised: 17_800_000, valuation: 100_000_000, equityMin: 0.12, equityMax: 0.2, deadline: inDays(6), imageUrl: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=1200', investorCount: 203 }),
  project({ id: 'p4', name: 'SantéPlus Pharma', tagline: 'Médicaments authentifiés, livrés aux officines', sector: 'HEALTHTECH', description: "Plateforme de télé-pharmacie qui vérifie l'authenticité des médicaments et livre les officines partenaires de Bouaké à Korhogo.", problem: 'Les médicaments contrefaits représentent une part importante du marché informel.', solution: "Chaîne d'approvisionnement vérifiée par QR code et livraison aux officines.", targetMarket: 'Pharmacies du centre et du nord', fundingGoal: 75_000_000, fundingRaised: 21_000_000, valuation: 400_000_000, equityMin: 0.1, equityMax: 0.2, deadline: inDays(45), imageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200', investorCount: 64 }),
  project({ id: 'p5', name: 'École Numérique 225', tagline: 'Soutien scolaire sur téléphone basique', sector: 'EDUTECH', description: 'Cours de soutien scolaire en audio et par SMS, accessibles sur téléphone basique. Contenus alignés sur les programmes officiels.', problem: "Plus d'un élève sur deux n'a ni smartphone ni connexion stable.", solution: 'Leçons audio via serveur vocal interactif et quiz par SMS.', targetMarket: 'Élèves du primaire et du collège', fundingGoal: 15_000_000, fundingRaised: 4_500_000, valuation: 75_000_000, equityMin: 0.1, equityMax: 0.2, deadline: inDays(60), imageUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200', investorCount: 31 }),
];

export const bonds: BondDTO[] = [
  { id: 'bt-ci-364', issuerCountry: 'CI', issuerName: "Trésor public de Côte d'Ivoire", type: 'TREASURY_BOND', rate: 0.06, maturityDays: 364, minAmount: 10_000, isHalal: false, issueDate: ago(3), closingDate: inDays(12), description: "Bon assimilable du Trésor émis par la Côte d'Ivoire, intérêts versés à l'échéance." },
  { id: 'bt-sn-182', issuerCountry: 'SN', issuerName: 'Trésor public du Sénégal', type: 'TREASURY_BOND', rate: 0.0575, maturityDays: 182, minAmount: 10_000, isHalal: false, issueDate: ago(1), closingDate: inDays(9), description: 'Bon du Trésor à 6 mois, idéal pour une épargne de précaution rémunérée.' },
  { id: 'bt-ml-91', issuerCountry: 'ML', issuerName: 'Trésor public du Mali', type: 'TREASURY_BOND', rate: 0.055, maturityDays: 91, minAmount: 5_000, isHalal: false, issueDate: ago(2), closingDate: inDays(5), description: 'Bon du Trésor à 3 mois, liquidité rapide.' },
  { id: 'bt-bf-364', issuerCountry: 'BF', issuerName: 'Trésor public du Burkina Faso', type: 'TREASURY_BOND', rate: 0.065, maturityDays: 364, minAmount: 10_000, isHalal: false, issueDate: ago(4), closingDate: inDays(14), description: 'Bon du Trésor à 12 mois au rendement élevé.' },
  { id: 'sk-ci-364', issuerCountry: 'CI', issuerName: "État de Côte d'Ivoire — Sukuk", type: 'SUKUK', rate: 0.0585, maturityDays: 364, minAmount: 10_000, isHalal: true, issueDate: ago(5), closingDate: inDays(20), description: 'Certificat Sukuk adossé à des actifs réels, conforme aux principes de la finance islamique.' },
  { id: 'sk-sn-728', issuerCountry: 'SN', issuerName: 'État du Sénégal — Sukuk', type: 'SUKUK', rate: 0.062, maturityDays: 728, minAmount: 25_000, isHalal: true, issueDate: ago(6), closingDate: inDays(25), description: 'Sukuk Ijara à 2 ans, revenus locatifs distribués semestriellement.' },
];

export const funds: FundDTO[] = [
  { id: 'fcp-monetaire', name: 'FCP DALA Monétaire', manager: 'SGO agréée CREPMF', ytdPerformance: 0.042, risk: 'FAIBLE', fees: 0.005, minAmount: 5_000, isHalal: false },
  { id: 'fcp-obligataire', name: 'FCP Obligations UEMOA', manager: 'SGO agréée CREPMF', ytdPerformance: 0.058, risk: 'FAIBLE', fees: 0.0075, minAmount: 10_000, isHalal: false },
  { id: 'fcp-diversifie', name: 'FCP Croissance BRVM', manager: 'SGO agréée CREPMF', ytdPerformance: 0.091, risk: 'MOYEN', fees: 0.015, minAmount: 25_000, isHalal: false },
  { id: 'fcp-ethique', name: 'FCP Al Baraka Éthique', manager: 'SGO agréée CREPMF', ytdPerformance: 0.067, risk: 'MOYEN', fees: 0.012, minAmount: 10_000, isHalal: true },
];
