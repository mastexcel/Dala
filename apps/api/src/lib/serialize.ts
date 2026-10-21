import type {
  CrowdfundInvestment,
  Investment,
  Loan,
  Notification,
  Project,
  SavingsGoal,
  Transaction,
  User,
  Vault,
} from '@prisma/client';
import type {
  LoanDTO,
  NotificationDTO,
  ProjectDTO,
  ProjectDocument,
  SavingsGoalDTO,
  TeamMember,
  TransactionDTO,
  UserProfile,
  VaultDTO,
  KycLevel,
  InvestmentDTO,
} from '@dala/shared';
import { vaultAccruedInterest } from '@dala/shared';
import { num } from './prisma';

export function userDTO(u: User, referralCount = 0): UserProfile {
  return {
    id: u.id,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    kycLevel: u.kycLevel as KycLevel,
    avatarUrl: u.avatarUrl,
    referralCode: u.referralCode,
    referralCount,
    creditScore: u.creditScore,
  };
}

export function transactionDTO(t: Transaction): TransactionDTO {
  return {
    id: t.id,
    type: t.type,
    amount: num(t.amount),
    currency: t.currency,
    description: t.description,
    reference: t.reference,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  };
}

export function goalDTO(g: SavingsGoal): SavingsGoalDTO {
  return {
    id: g.id,
    name: g.name,
    targetAmount: num(g.targetAmount),
    currentAmount: num(g.currentAmount),
    deadline: g.deadline?.toISOString() ?? null,
    autoSave: g.autoSave,
    frequency: g.frequency,
    autoAmount: g.autoAmount ? num(g.autoAmount) : null,
    icon: g.icon,
  };
}

export function vaultDTO(v: Vault, now = new Date()): VaultDTO {
  const amount = num(v.amount);
  const rate = num(v.rate);
  return {
    id: v.id,
    amount,
    rate,
    months: v.months,
    createdAt: v.createdAt.toISOString(),
    unlockDate: v.unlockDate.toISOString(),
    accruedInterest: vaultAccruedInterest(amount, rate, v.createdAt, v.unlockDate, now),
  };
}

export function loanDTO(l: Loan): LoanDTO {
  return {
    id: l.id,
    amount: num(l.amount),
    interestRate: num(l.interestRate),
    fees: num(l.fees),
    totalDue: num(l.totalDue),
    duration: l.duration,
    dueDate: l.dueDate.toISOString(),
    amountPaid: num(l.amountPaid),
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    disbursedAt: l.disbursedAt?.toISOString() ?? null,
  };
}

export function investmentDTO(i: Investment, instrumentName: string): InvestmentDTO {
  return {
    id: i.id,
    type: i.type,
    instrumentId: i.instrumentId,
    instrumentName,
    amount: num(i.amount),
    rate: num(i.rate),
    maturityDate: i.maturityDate.toISOString(),
    status: i.status,
    isHalal: i.isHalal,
    createdAt: i.createdAt.toISOString(),
  };
}

export function projectDTO(p: Project & { _count?: { investments: number } }): ProjectDTO {
  const firstSentence = p.description.split(/(?<=[.!?])\s/)[0] ?? p.description;
  return {
    id: p.id,
    name: p.name,
    tagline: firstSentence.length > 80 ? `${firstSentence.slice(0, 77)}…` : firstSentence,
    sector: p.sector,
    description: p.description,
    problem: p.problem,
    solution: p.solution,
    targetMarket: p.targetMarket,
    fundingGoal: num(p.fundingGoal),
    fundingRaised: num(p.fundingRaised),
    equityMin: num(p.equityMin),
    equityMax: num(p.equityMax),
    valuation: num(p.valuation),
    deadline: p.deadline.toISOString(),
    status: p.status,
    validatedBy: p.validatedBy,
    imageUrl: p.imageUrl,
    galleryUrls: (p.galleryUrls as string[] | null) ?? [],
    documents: (p.documents as ProjectDocument[] | null) ?? [],
    teamMembers: (p.teamMembers as TeamMember[] | null) ?? [],
    investorCount: p._count?.investments ?? 0,
  };
}

export function holdingStatus(c: CrowdfundInvestment, p: Project): 'EN_COURS' | 'FINANCE' | 'CLOTURE' {
  if (p.status === 'FUNDED') return 'FINANCE';
  if (p.status === 'CLOSED' || c.status === 'REFUNDED' || c.status === 'CANCELLED') return 'CLOTURE';
  return 'EN_COURS';
}

export function notificationDTO(n: Notification): NotificationDTO {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}
