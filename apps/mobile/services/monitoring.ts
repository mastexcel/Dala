import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Suivi des erreurs (Sentry) et analytique produit (Mixpanel).
 * Tous deux inactifs sans configuration : EXPO_PUBLIC_SENTRY_DSN et EXPO_PUBLIC_MIXPANEL_TOKEN.
 * Aucune donnée personnelle n'est envoyée : ni nom, ni téléphone, ni montant exact.
 */

// Les variables EXPO_PUBLIC_* sont inlinées au build ; configureMonitoring permet de les surcharger (tests).
// Sentry et Mixpanel sont hébergés hors de l'UEMOA : inactifs tant qu'ils ne sont pas déclarés à l'ARTCI.
const declared = (process.env.EXPO_PUBLIC_FOREIGN_PROCESSORS_DECLARED ?? '').split(',').map((s) => s.trim());
const cfg = {
  sentryDsn: declared.includes('sentry') ? process.env.EXPO_PUBLIC_SENTRY_DSN : undefined,
  mixpanelToken: declared.includes('mixpanel') ? process.env.EXPO_PUBLIC_MIXPANEL_TOKEN : undefined,
  mixpanelUrl: process.env.EXPO_PUBLIC_MIXPANEL_URL ?? 'https://api-eu.mixpanel.com/track',
};

export function configureMonitoring(overrides: Partial<typeof cfg>) {
  Object.assign(cfg, overrides);
}

let distinctId: string | null = null;

export function initMonitoring() {
  if (!cfg.sentryDsn) return;
  Sentry.init({
    dsn: cfg.sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeBreadcrumb(b) {
      // Les requêtes réseau peuvent contenir PIN ou OTP : on ne garde que la méthode et le chemin.
      if (b.category === 'xhr' || b.category === 'fetch') {
        const url = String(b.data?.url ?? '').split('?')[0];
        return { ...b, data: { method: b.data?.method, url, status_code: b.data?.status_code } };
      }
      return b;
    },
  });
}

export const withMonitoring = (Root: React.ComponentType<Record<string, unknown>>) => (cfg.sentryDsn ? Sentry.wrap(Root) : Root);

export function identify(userId: string | null) {
  distinctId = userId;
  if (cfg.sentryDsn) Sentry.setUser(userId ? { id: userId } : null);
}

export function captureError(err: unknown) {
  if (cfg.sentryDsn) Sentry.captureException(err);
}

/** Tranche de montant (l'analytique n'a pas besoin du montant exact). */
export function amountBucket(amount: number): string {
  if (amount < 10_000) return '<10k';
  if (amount < 50_000) return '10k-50k';
  if (amount < 200_000) return '50k-200k';
  if (amount < 1_000_000) return '200k-1M';
  return '>1M';
}

export type AnalyticsEvent =
  | 'signup_completed'
  | 'login'
  | 'login_biometric'
  | 'goal_created'
  | 'savings_deposit'
  | 'vault_created'
  | 'tontine_contribution'
  | 'investment_made'
  | 'crowdfund_investment'
  | 'project_submitted'
  | 'loan_requested'
  | 'loan_repaid'
  | 'wallet_operation'
  | 'advisor_contacted'
  | 'assistant_reply';

export function track(event: AnalyticsEvent, props: Record<string, string | number | boolean> = {}) {
  if (!cfg.mixpanelToken) return;
  const payload = {
    event,
    properties: {
      token: cfg.mixpanelToken,
      distinct_id: distinctId ?? 'anonymous',
      time: Math.floor(Date.now() / 1000),
      $os: Platform.OS,
      app_version: Constants.expoConfig?.version ?? 'dev',
      ...props,
    },
  };
  fetch(cfg.mixpanelUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
    body: JSON.stringify([payload]),
  }).catch(() => undefined);
}
