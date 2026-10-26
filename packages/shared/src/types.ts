export type KycLevel = 1 | 2 | 3;

export type Frequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export type AccountType = 'MAIN' | 'SAVINGS' | 'VAULT' | 'INVESTMENT' | 'CROWDFUND' | 'ESCROW';

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'SAVINGS_IN'
  | 'SAVINGS_OUT'
  | 'INVESTMENT_BUY'
  | 'INVESTMENT_RETURN'
  | 'CROWDFUND_IN'
  | 'CROWDFUND_RETURN'
  | 'LOAN_DISBURSEMENT'
  | 'LOAN_REPAYMENT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ESCROW_HOLD'
  | 'ESCROW_RELEASE'
  | 'ESCROW_REFUND'
  | 'FEE';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type TransactionCategory = 'ALL' | 'SAVINGS' | 'INVEST' | 'CROWDFUND' | 'CREDIT' | 'TRANSFER';

export type LoanStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DISBURSED'
  | 'REPAID'
  | 'OVERDUE'
  | 'DEFAULTED'
  | 'REJECTED';

export type ProjectSector =
  | 'AGRITECH'
  | 'SOLARTECH'
  | 'FOODTECH'
  | 'HEALTHTECH'
  | 'FINTECH'
  | 'EDUTECH'
  | 'LOGISTICS'
  | 'OTHER';

export type ProjectStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VALIDATED'
  | 'ACTIVE'
  | 'FUNDED'
  | 'CLOSED'
  | 'REJECTED';

export type InvestmentType = 'TREASURY_BOND' | 'FCP' | 'SUKUK';

export interface UserProfile {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  kycLevel: KycLevel;
  avatarUrl?: string | null;
  referralCode: string;
  referralCount: number;
  creditScore: number;
}

export interface BalanceSummary {
  total: number;
  main: number;
  savings: number;
  savingsTarget: number;
  vault: number;
  investments: number;
  crowdfund: number;
  /** Fonds bloqués dans des transactions Trusty en cours (acheteur). */
  escrow: number;
  crowdfundActiveProjects: number;
  creditOutstanding: number;
  creditEligible: number;
  monthDelta: number;
  monthDeltaPct: number;
}

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  reference?: string | null;
  status: TransactionStatus;
  createdAt: string;
}

export interface SavingsGoalDTO {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  autoSave: boolean;
  frequency?: Frequency | null;
  autoAmount?: number | null;
  icon: string;
}

export interface TontineMemberDTO {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string | null;
  position: number;
  hasPaid: boolean;
  hasReceived: boolean;
}

export interface TontineDTO {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  maxMembers: number;
  currentCycle: number;
  totalCycles: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  nextContributionDate: string;
  myPosition: number;
  members: TontineMemberDTO[];
}

export interface VaultDTO {
  id: string;
  amount: number;
  rate: number;
  months: number;
  createdAt: string;
  unlockDate: string;
  accruedInterest: number;
}

export interface BondDTO {
  id: string;
  issuerCountry: 'CI' | 'SN' | 'ML' | 'BF' | 'BJ' | 'TG' | 'NE' | 'GW';
  issuerName: string;
  type: InvestmentType;
  rate: number;
  maturityDays: 91 | 182 | 364 | 728 | 1092;
  minAmount: number;
  isHalal: boolean;
  issueDate: string;
  closingDate: string;
  description: string;
}

export interface FundDTO {
  id: string;
  name: string;
  manager: string;
  ytdPerformance: number;
  risk: 'FAIBLE' | 'MOYEN' | 'ELEVE';
  fees: number;
  minAmount: number;
  isHalal: boolean;
}

export interface InvestmentDTO {
  id: string;
  type: InvestmentType;
  instrumentId: string;
  instrumentName: string;
  amount: number;
  rate: number;
  maturityDate: string;
  status: 'ACTIVE' | 'MATURED' | 'WITHDRAWN' | 'CANCELLED';
  isHalal: boolean;
  createdAt: string;
}

export interface PortfolioDTO {
  totalValue: number;
  invested: number;
  ytdReturn: number;
  ytdReturnPct: number;
  history: { date: string; value: number }[];
  investments: InvestmentDTO[];
}

export interface TeamMember {
  name: string;
  role: string;
  photoUrl?: string;
}

export interface ProjectDocument {
  name: string;
  url: string;
  kind: 'BUSINESS_PLAN' | 'VALIDATION' | 'PROJECTIONS' | 'OTHER';
}

export interface ProjectDTO {
  id: string;
  name: string;
  tagline: string;
  sector: ProjectSector;
  description: string;
  problem: string;
  solution: string;
  targetMarket: string;
  fundingGoal: number;
  fundingRaised: number;
  equityMin: number;
  equityMax: number;
  valuation: number;
  deadline: string;
  status: ProjectStatus;
  validatedBy?: string | null;
  imageUrl?: string | null;
  galleryUrls: string[];
  documents: ProjectDocument[];
  teamMembers: TeamMember[];
  investorCount: number;
}

export interface CrowdfundHoldingDTO {
  id: string;
  projectId: string;
  projectName: string;
  sector: ProjectSector;
  amount: number;
  equityPct: number;
  estimatedValue: number;
  status: 'EN_COURS' | 'FINANCE' | 'CLOTURE';
  createdAt: string;
}

export interface LoanQuote {
  amount: number;
  duration: number;
  annualRate: number;
  interest: number;
  fees: number;
  totalDue: number;
  taeg: number;
  dueDate: string;
}

export interface LoanDTO {
  id: string;
  amount: number;
  interestRate: number;
  fees: number;
  totalDue: number;
  duration: number;
  dueDate: string;
  amountPaid: number;
  status: LoanStatus;
  createdAt: string;
  disbursedAt?: string | null;
}

export interface LoanScheduleItem {
  index: number;
  dueDate: string;
  amount: number;
  paid: boolean;
}

export type LoanDecision = 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';

export interface CreditOverview {
  score: number;
  eligibleAmount: number;
  loans: LoanDTO[];
}

export interface NotificationDTO {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

/* ------------------------- Échanges avec l'équipe commerciale ------------------------- */

export type AdvisorTopic = 'PAYMENTS' | 'SAVINGS' | 'CREDIT' | 'OTHER' | 'INVEST' | 'CROWDFUND' | 'BUSINESS';
export type AdvisorSender = 'USER' | 'ADVISOR' | 'SYSTEM';

export interface AdvisorMessageDTO {
  id: string;
  sender: AdvisorSender;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface AdvisorConversationDTO {
  id: string;
  topic: AdvisorTopic;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  advisorName: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
  createdAt: string;
}

export interface AdvisorConversationDetail extends AdvisorConversationDTO {
  messages: AdvisorMessageDTO[];
}

/* ---------------------------- Demandes de paiement ---------------------------- */

export type PaymentRequestStatus = 'OPEN' | 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface PaymentRequestDTO {
  id: string;
  code: string;
  amount: number;
  note: string | null;
  status: PaymentRequestStatus;
  expiresAt: string;
  paidAt: string | null;
  /** Lien à partager : le payeur règle depuis son mobile money, sans compte DALA. */
  url: string;
  createdAt: string;
}
