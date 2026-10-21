import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectSector, TransactionCategory } from '@dala/shared';
import {
  accountApi,
  crowdfundApi,
  investApi,
  loanApi,
  notificationApi,
  savingsApi,
  transactionApi,
  userApi,
} from '@/services/api';

export const qk = {
  summary: ['summary'] as const,
  me: ['me'] as const,
  transactions: (c: TransactionCategory, q?: string) => ['transactions', c, q ?? ''] as const,
  goals: ['goals'] as const,
  tontines: ['tontines'] as const,
  tontine: (id: string) => ['tontines', id] as const,
  vaults: ['vaults'] as const,
  bonds: (halal: boolean) => ['bonds', halal] as const,
  bond: (id: string) => ['bond', id] as const,
  funds: (halal: boolean) => ['funds', halal] as const,
  portfolio: ['portfolio'] as const,
  projects: (s?: ProjectSector) => ['projects', s ?? 'ALL'] as const,
  project: (id: string) => ['project', id] as const,
  cfPortfolio: ['cfPortfolio'] as const,
  credit: ['credit'] as const,
  loan: (id: string) => ['loan', id] as const,
  notifications: ['notifications'] as const,
  limits: ['limits'] as const,
  referrals: ['referrals'] as const,
};

export const useSummary = () => useQuery({ queryKey: qk.summary, queryFn: accountApi.summary });
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: userApi.me });
export const useTransactions = (c: TransactionCategory = 'ALL', q?: string, limit = 30) =>
  useQuery({ queryKey: [...qk.transactions(c, q), limit], queryFn: () => transactionApi.list(c, q, limit) });
export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: savingsApi.goals });
export const useTontines = () => useQuery({ queryKey: qk.tontines, queryFn: savingsApi.tontines });
export const useTontine = (id: string) => useQuery({ queryKey: qk.tontine(id), queryFn: () => savingsApi.tontine(id) });
export const useVaults = () => useQuery({ queryKey: qk.vaults, queryFn: savingsApi.vaults });
export const useBonds = (halal = false) => useQuery({ queryKey: qk.bonds(halal), queryFn: () => investApi.bonds(halal) });
export const useBond = (id: string) => useQuery({ queryKey: qk.bond(id), queryFn: () => investApi.bond(id) });
export const useFunds = (halal = false) => useQuery({ queryKey: qk.funds(halal), queryFn: () => investApi.funds(halal) });
export const usePortfolio = () => useQuery({ queryKey: qk.portfolio, queryFn: investApi.portfolio });
export const useProjects = (s?: ProjectSector) => useQuery({ queryKey: qk.projects(s), queryFn: () => crowdfundApi.projects(s) });
export const useProject = (id: string) => useQuery({ queryKey: qk.project(id), queryFn: () => crowdfundApi.project(id) });
export const useCrowdfundPortfolio = () => useQuery({ queryKey: qk.cfPortfolio, queryFn: crowdfundApi.portfolio });
export const useCredit = () => useQuery({ queryKey: qk.credit, queryFn: loanApi.overview });
export const useLoan = (id: string) => useQuery({ queryKey: qk.loan(id), queryFn: () => loanApi.detail(id) });
export const useNotifications = () => useQuery({ queryKey: qk.notifications, queryFn: notificationApi.list, refetchInterval: 60_000 });
export const useLimits = () => useQuery({ queryKey: qk.limits, queryFn: userApi.limits });
export const useReferrals = () => useQuery({ queryKey: qk.referrals, queryFn: userApi.referrals });

/** Mutation financière : invalide soldes, transactions et notifications après succès. */
export function useFinancialMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, extraKeys: readonly (readonly unknown[])[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [qk.summary, ['transactions'], qk.notifications, ...extraKeys]) {
        void qc.invalidateQueries({ queryKey: key as unknown[] });
      }
    },
  });
}
