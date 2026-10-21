import { randomToken } from '../../lib/crypto';
import type { MobileMoneyProvider, MobileMoneyProviderId } from './types';

/** Fournisseur sandbox : succès immédiat, sauf montants se terminant par 13 (échec simulé). */
export function sandboxProvider(id: MobileMoneyProviderId, name: string): MobileMoneyProvider {
  const result = (amount: number) =>
    amount % 100 === 13
      ? { status: 'FAILED' as const, providerReference: '', message: 'Solde mobile money insuffisant (simulation)' }
      : { status: 'SUCCESS' as const, providerReference: `${id}-${randomToken(8)}` };
  return {
    id,
    name,
    deposit: async (_phone, amount) => result(amount),
    withdraw: async (_phone, amount) => result(amount),
    checkBalance: async () => 1_000_000,
  };
}
