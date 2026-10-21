export type MobileMoneyProviderId = 'ORANGE_MONEY' | 'MTN_MOMO' | 'WAVE' | 'MOOV_MONEY';

export interface PaymentResult {
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  providerReference: string;
  message?: string;
}

export interface MobileMoneyProvider {
  id: MobileMoneyProviderId;
  name: string;
  /** Collecte : débite le wallet mobile money du client vers DALA. */
  deposit(phone: string, amount: number, reference: string): Promise<PaymentResult>;
  /** Décaissement : crédite le wallet mobile money du client. */
  withdraw(phone: string, amount: number, reference: string): Promise<PaymentResult>;
  checkBalance(phone: string): Promise<number>;
}
