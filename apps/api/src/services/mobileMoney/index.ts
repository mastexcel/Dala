import { config } from '../../config';
import { badRequest } from '../../lib/errors';
import { moovMoney, mtnMomo, orangeMoney, wave } from './live';
import { sandboxProvider } from './sandbox';
import type { MobileMoneyProvider, MobileMoneyProviderId } from './types';

export * from './types';

export const PROVIDER_IDS: MobileMoneyProviderId[] = ['ORANGE_MONEY', 'MTN_MOMO', 'WAVE', 'MOOV_MONEY'];

const live: Record<MobileMoneyProviderId, MobileMoneyProvider> = {
  ORANGE_MONEY: orangeMoney,
  MTN_MOMO: mtnMomo,
  WAVE: wave,
  MOOV_MONEY: moovMoney,
};

export function getProvider(id: MobileMoneyProviderId): MobileMoneyProvider {
  const p = live[id];
  if (!p) throw badRequest('Opérateur inconnu');
  return config.MOBILE_MONEY_MODE === 'live' ? p : sandboxProvider(p.id, p.name);
}
