import type {
  BalanceSummary,
  BondDTO,
  CreditOverview,
  CrowdfundHoldingDTO,
  Frequency,
  FundDTO,
  LoanDTO,
  LoanDecision,
  LoanQuote,
  LoanScheduleItem,
  NotificationDTO,
  PortfolioDTO,
  ProjectDTO,
  ProjectSector,
  SavingsGoalDTO,
  TontineDTO,
  TransactionCategory,
  TransactionDTO,
  UserProfile,
  VaultDTO,
  InvestmentDTO,
  AdvisorConversationDTO,
  AdvisorConversationDetail,
  AdvisorMessageDTO,
  AdvisorTopic,
  PaymentRequestDTO,
} from '@dala/shared';
import { request } from './client';

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

export type MobileMoneyProvider = 'ORANGE_MONEY' | 'MTN_MOMO' | 'WAVE' | 'MOOV_MONEY';

export const authApi = {
  requestOtp: (phone: string, purpose: 'LOGIN' | 'REGISTER' | 'PIN_RESET' = 'LOGIN') =>
    request<{ sent: boolean; devCode?: string }>('/auth/otp/request', { method: 'POST', body: { phone, purpose }, auth: false }),
  login: (body: { phone: string; otp: string; pin: string; deviceId?: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),
  register: (body: { phone: string; otp: string; firstName: string; lastName: string; pin: string; email?: string; referralCode?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body, auth: false }),
};

export const userApi = {
  me: () => request<UserProfile>('/users/me'),
  update: (body: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'email'>>, pin: string) => request<UserProfile>('/users/me', { method: 'PATCH', body, pin }),
  limits: () =>
    request<{ kycLevel: number; regulatoryMonthlyLimit: number | null; transfersAllowed: boolean; customMonthlyLimit: number | null; usedThisMonth: number }>('/users/me/limits'),
  setLimit: (customMonthlyLimit: number | null, pin: string) => request('/users/me/limits', { method: 'PUT', body: { customMonthlyLimit }, pin }),
  uploadUrl: (fileName: string) => request<{ uploadUrl: string; path: string }>('/users/me/kyc/upload-url', { method: 'POST', body: { fileName } }),
  submitKyc: (body: Record<string, unknown>) => request<{ status: string }>('/users/me/kyc', { method: 'POST', body }),
  referrals: () => request<{ code: string; link: string; count: number; referees: { firstName: string }[] }>('/users/me/referrals'),
  setPushToken: (token: string) => request('/users/me/push-token', { method: 'PUT', body: { token } }),
  retention: () => request<{ policy: string[]; yearsAfterClosure: number }>('/users/me/data/retention'),
  exportData: () => request<Record<string, unknown>>('/users/me/data/export'),
  close: (pin: string) => request<{ status: 'CLOSED'; retentionYears: number }>('/users/me/close', { method: 'POST', pin }),
};

export const accountApi = {
  summary: () => request<BalanceSummary>('/accounts/summary'),
  deposit: (provider: MobileMoneyProvider, amount: number, phone?: string) =>
    request<{ status: string }>('/accounts/deposit', { method: 'POST', body: { provider, amount, phone } }),
  /** Envoi vers le mobile money d'un tiers (tout opérateur ouvert). */
  sendMobileMoney: (provider: MobileMoneyProvider, phone: string, amount: number, pin?: string, note?: string) =>
    request<{ status: string }>('/accounts/send-mobile-money', { method: 'POST', body: { provider, phone, amount, note }, pin }),
  withdraw: (provider: MobileMoneyProvider, amount: number, pin?: string, phone?: string) =>
    request<{ status: string }>('/accounts/withdraw', { method: 'POST', body: { provider, amount, phone }, pin }),
  transfer: (toPhone: string, amount: number, pin?: string, note?: string) =>
    request('/accounts/transfer', { method: 'POST', body: { toPhone, amount, note }, pin }),
};

export interface CreateGoalInput {
  name: string;
  targetAmount: number;
  deadline?: string;
  autoSave: boolean;
  frequency?: Frequency;
  autoAmount?: number;
  icon?: string;
}

export const savingsApi = {
  goals: () => request<SavingsGoalDTO[]>('/savings/goals'),
  createGoal: (body: CreateGoalInput) => request<SavingsGoalDTO>('/savings/goals', { method: 'POST', body }),
  depositGoal: (id: string, amount: number, pin?: string) => request<SavingsGoalDTO>(`/savings/goals/${id}/deposit`, { method: 'POST', body: { amount }, pin }),
  tontines: () => request<TontineDTO[]>('/savings/tontines'),
  tontine: (id: string) => request<TontineDTO>(`/savings/tontines/${id}`),
  contribute: (id: string, pin: string) => request<TontineDTO>(`/savings/tontines/${id}/contribute`, { method: 'POST', pin }),
  vaults: () => request<{ options: { months: number; rate: number }[]; vaults: VaultDTO[] }>('/savings/vaults'),
  createVault: (amount: number, months: 3 | 6 | 12, pin?: string) => request<VaultDTO>('/savings/vaults', { method: 'POST', body: { amount, months }, pin }),
};

export const investApi = {
  bonds: (halal?: boolean) => request<BondDTO[]>('/investments/bonds', { query: { halal } }),
  bond: (id: string) => request<BondDTO>(`/investments/bonds/${id}`),
  funds: (halal?: boolean) => request<FundDTO[]>('/investments/funds', { query: { halal } }),
  portfolio: () => request<PortfolioDTO>('/investments/portfolio'),
  invest: (instrumentId: string, amount: number, pin?: string) =>
    request<InvestmentDTO>('/investments', { method: 'POST', body: { instrumentId, amount, acceptTerms: true }, pin }),
  cancel: (id: string) => request(`/investments/${id}/cancel`, { method: 'POST' }),
};

export interface SubmitProjectInput {
  name: string;
  sector: ProjectSector;
  description: string;
  problem: string;
  solution: string;
  targetMarket: string;
  fundingGoal: number;
  valuation: number;
  equityMin: number;
  equityMax: number;
  deadline: string;
  documents: { name: string; url: string; kind: 'BUSINESS_PLAN' | 'VALIDATION' | 'PROJECTIONS' | 'OTHER' }[];
  teamMembers: { name: string; role: string }[];
}

export const crowdfundApi = {
  projects: (sector?: ProjectSector) => request<ProjectDTO[]>('/crowdfund/projects', { query: { sector } }),
  project: (id: string) => request<ProjectDTO>(`/crowdfund/projects/${id}`),
  invest: (id: string, amount: number, pin?: string) =>
    request<{ id: string; equityPct: number; status: string }>(`/crowdfund/projects/${id}/invest`, { method: 'POST', body: { amount, acceptRisks: true }, pin }),
  portfolio: () => request<{ totalInvested: number; holdings: CrowdfundHoldingDTO[] }>('/crowdfund/portfolio'),
  submit: (body: SubmitProjectInput) => request<{ id: string; status: string }>('/crowdfund/projects', { method: 'POST', body }),
};

export interface LoanDetail extends LoanDTO {
  schedule: LoanScheduleItem[];
  repayments: { id: string; amount: number; paidAt: string }[];
  daysLeft: number;
}

export const loanApi = {
  overview: () => request<CreditOverview>('/loans'),
  quote: (amount: number, duration: number) => request<LoanQuote>('/loans/quote', { query: { amount, duration } }),
  request: (amount: number, duration: number, pin?: string) =>
    request<{ decision: LoanDecision; score: number; loan: LoanDTO; quote: LoanQuote }>('/loans', { method: 'POST', body: { amount, duration, acceptTerms: true }, pin }),
  detail: (id: string) => request<LoanDetail>(`/loans/${id}`),
  repay: (id: string, amount: number, pin?: string) => request<LoanDTO>(`/loans/${id}/repay`, { method: 'POST', body: { amount }, pin }),
};

export const transactionApi = {
  list: (category: TransactionCategory = 'ALL', q?: string, limit = 30) =>
    request<{ items: TransactionDTO[]; nextCursor: string | null }>('/transactions', { query: { category, q, limit } }),
};

export const notificationApi = {
  list: () => request<{ items: NotificationDTO[]; unread: number }>('/notifications'),
  readAll: () => request('/notifications/read-all', { method: 'POST' }),
};

export const complianceApi = {
  complaint: (body: { subject: string; message: string; category: string }) => request('/compliance/complaints', { method: 'POST', body }),
};

export const advisorApi = {
  conversations: () => request<AdvisorConversationDTO[]>('/advisor/conversations'),
  conversation: (id: string) => request<AdvisorConversationDetail>(`/advisor/conversations/${id}`),
  start: (topic: AdvisorTopic, message: string, subject?: string) =>
    request<AdvisorConversationDetail>('/advisor/conversations', { method: 'POST', body: { topic, message, subject } }),
  send: (id: string, body: string) => request<AdvisorMessageDTO>(`/advisor/conversations/${id}/messages`, { method: 'POST', body: { body } }),
};

export const paymentRequestApi = {
  list: () => request<PaymentRequestDTO[]>('/payment-requests'),
  create: (amount: number, note?: string) => request<PaymentRequestDTO>('/payment-requests', { method: 'POST', body: { amount, note } }),
  cancel: (id: string) => request(`/payment-requests/${id}/cancel`, { method: 'POST' }),
  /** Détail public d'une demande (QR ou lien scanné). */
  info: (code: string) =>
    request<PaymentRequestDTO & { beneficiary: string }>(`/pay/${code}`, { auth: false }),
  /** Payer une demande DALA avec son solde (PIN au-delà de 50 000 FCFA). */
  payWithBalance: (code: string, amount: number, pin?: string) =>
    request<{ status: string }>(`/payment-requests/by-code/${code}/pay`, { method: 'POST', body: { amount }, pin }),
  /** Paiement public d'une demande (utilisé par le mode démo pour simuler le payeur). */
  pay: (code: string, provider: MobileMoneyProvider, phone: string) =>
    request<{ status: string }>(`/pay/${code}`, { method: 'POST', body: { provider, phone }, auth: false }),
};
