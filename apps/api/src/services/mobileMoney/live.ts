import { config } from '../../config';
import type { MobileMoneyProvider, PaymentResult } from './types';

/**
 * Adaptateurs production. Chaque opérateur confirme les paiements de façon asynchrone :
 * les appels renvoient PENDING et le statut final arrive sur /webhooks/mobile-money/:provider.
 */

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

function pending(ref: string, ok: boolean, message?: string): PaymentResult {
  return ok ? { status: 'PENDING', providerReference: ref } : { status: 'FAILED', providerReference: ref, message };
}

export const orangeMoney: MobileMoneyProvider = {
  id: 'ORANGE_MONEY',
  name: 'Orange Money',
  async deposit(phone, amount, reference) {
    const res = await postJson('https://api.orange.com/orange-money-webpay/ci/v1/webpayment', { Authorization: `Bearer ${config.ORANGE_MONEY_API_KEY}` }, {
      merchant_key: config.ORANGE_MONEY_API_KEY, currency: 'XOF', order_id: reference, amount, reference: phone, lang: 'fr',
    });
    return pending(reference, res.ok, `Orange Money ${res.status}`);
  },
  async withdraw(phone, amount, reference) {
    const res = await postJson('https://api.orange.com/orange-money-cashin/ci/v1/transfer', { Authorization: `Bearer ${config.ORANGE_MONEY_API_KEY}` }, { msisdn: phone, amount, reference });
    return pending(reference, res.ok, `Orange Money ${res.status}`);
  },
  async checkBalance() {
    return 0;
  },
};

export const mtnMomo: MobileMoneyProvider = {
  id: 'MTN_MOMO',
  name: 'MTN MoMo',
  async deposit(phone, amount, reference) {
    const res = await postJson('https://proxy.momoapi.mtn.com/collection/v1_0/requesttopay', {
      'Ocp-Apim-Subscription-Key': config.MTN_MOMO_SUBSCRIPTION_KEY ?? '', 'X-Reference-Id': reference, 'X-Target-Environment': 'mtnivorycoast',
    }, { amount: String(amount), currency: 'XOF', externalId: reference, payer: { partyIdType: 'MSISDN', partyId: phone.replace('+', '') }, payerMessage: 'DALA Finance', payeeNote: reference });
    return pending(reference, res.status === 202, `MTN ${res.status}`);
  },
  async withdraw(phone, amount, reference) {
    const res = await postJson('https://proxy.momoapi.mtn.com/disbursement/v1_0/transfer', {
      'Ocp-Apim-Subscription-Key': config.MTN_MOMO_SUBSCRIPTION_KEY ?? '', 'X-Reference-Id': reference, 'X-Target-Environment': 'mtnivorycoast',
    }, { amount: String(amount), currency: 'XOF', externalId: reference, payee: { partyIdType: 'MSISDN', partyId: phone.replace('+', '') }, payerMessage: 'DALA Finance', payeeNote: reference });
    return pending(reference, res.status === 202, `MTN ${res.status}`);
  },
  async checkBalance() {
    return 0;
  },
};

export const wave: MobileMoneyProvider = {
  id: 'WAVE',
  name: 'Wave',
  async deposit(_phone, amount, reference) {
    const res = await postJson('https://api.wave.com/v1/checkout/sessions', { Authorization: `Bearer ${config.WAVE_API_KEY}` }, {
      amount: String(amount), currency: 'XOF', client_reference: reference, success_url: 'dala://payments/success', error_url: 'dala://payments/error',
    });
    return pending(reference, res.ok, `Wave ${res.status}`);
  },
  async withdraw(phone, amount, reference) {
    const res = await postJson('https://api.wave.com/v1/payout', { Authorization: `Bearer ${config.WAVE_API_KEY}`, 'idempotency-key': reference }, {
      currency: 'XOF', receive_amount: String(amount), mobile: phone, client_reference: reference,
    });
    return pending(reference, res.ok, `Wave ${res.status}`);
  },
  async checkBalance() {
    return 0;
  },
};

export const moovMoney: MobileMoneyProvider = {
  id: 'MOOV_MONEY',
  name: 'Moov Money',
  async deposit(phone, amount, reference) {
    const res = await postJson('https://api.moov-africa.ci/v1/payments/collect', { Authorization: `Bearer ${config.MOOV_API_KEY}` }, { msisdn: phone, amount, reference });
    return pending(reference, res.ok, `Moov ${res.status}`);
  },
  async withdraw(phone, amount, reference) {
    const res = await postJson('https://api.moov-africa.ci/v1/payments/disburse', { Authorization: `Bearer ${config.MOOV_API_KEY}` }, { msisdn: phone, amount, reference });
    return pending(reference, res.ok, `Moov ${res.status}`);
  },
  async checkBalance() {
    return 0;
  },
};
