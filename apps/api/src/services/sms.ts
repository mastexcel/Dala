import { config } from '../config';
import { logger } from '../lib/logger';

export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

const consoleProvider: SmsProvider = {
  async send(to, message) {
    logger.info({ to, message }, '[SMS console]');
  },
};

const twilioProvider: SmsProvider = {
  async send(to, message) {
    const sid = config.TWILIO_ACCOUNT_SID!;
    const auth = Buffer.from(`${sid}:${config.TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: config.TWILIO_FROM ?? '', Body: message }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}`);
  },
};

const orangeProvider: SmsProvider = {
  async send(to, message) {
    const basic = Buffer.from(`${config.ORANGE_SMS_CLIENT_ID}:${config.ORANGE_SMS_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://api.orange.com/oauth/v3/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const sender = encodeURIComponent(`tel:${config.ORANGE_SMS_SENDER}`);
    const res = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${sender}/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: `tel:${to}`,
          senderAddress: `tel:${config.ORANGE_SMS_SENDER}`,
          senderName: 'DALA',
          outboundSMSTextMessage: { message },
        },
      }),
    });
    if (!res.ok) throw new Error(`Orange SMS ${res.status}`);
  },
};

export const sms: SmsProvider =
  config.SMS_PROVIDER === 'twilio' ? twilioProvider : config.SMS_PROVIDER === 'orange' ? orangeProvider : consoleProvider;
