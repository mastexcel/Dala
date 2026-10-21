import type { Dict } from './fr';

export const en: Dict = {
  common: { continue: 'Continue', cancel: 'Cancel', confirm: 'Confirm', back: 'Back', seeAll: 'See all', retry: 'Retry', offline: 'Offline — showing last synced data', error: 'Something went wrong' },
  splash: { slogan: 'Djigui — Your future starts here' },
  onboarding: {
    s1Title: 'Save smartly', s1Body: 'Goals, digital tontines and vaults: your money works for your plans.',
    s2Title: 'Invest in your future', s2Body: 'WAEMU Treasury bills up to 6%/yr, mutual funds and Halal options, from 5,000 FCFA.',
    s3Title: 'Financing at your fingertips', s3Body: 'Instant micro-loans and equity in local businesses.',
    start: 'Get started', skip: 'Skip',
  },
  auth: {
    phone: 'Phone number', sendOtp: 'Get OTP code', otp: 'SMS code', pin: 'PIN', login: 'Sign in', createAccount: 'Create account',
    biometric: 'Continue with {{method}}', noAccount: 'No account yet?', haveAccount: 'Already registered?', resend: 'Resend code',
    demoHint: 'Demo mode: OTP 123456 · PIN 1234',
  },
  tabs: { home: 'Home', savings: 'Savings', crowdfund: 'Crowdfund', credit: 'Credit', profile: 'Profile' },
  home: {
    hello: 'Hello, {{name}} 👋', totalBalance: 'Total balance', thisMonth: 'this month', send: 'Send', receive: 'Receive', scan: 'Scan', more: 'More',
    savings: 'Savings', invest: 'Investments', crowdfund: 'Crowdfund', credit: 'Credit', activeProjects: '{{count}} active projects',
    eligible: 'Eligible: {{amount}}', recent: 'Recent transactions',
  },
};
