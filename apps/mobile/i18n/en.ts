import type { Dict } from './fr';

export const en: Dict = {
  common: { continue: 'Continue', cancel: 'Cancel', confirm: 'Confirm', back: 'Back', seeAll: 'See all', retry: 'Retry', offline: 'Offline — showing last synced data', error: 'Something went wrong' },
  splash: { slogan: 'Grow your ambitions' },
  onboarding: {
    s1Title: 'Save smartly', s1Body: 'Goals, digital tontines and vaults: set money aside for your plans.',
    s2Title: 'Pay and transfer easily', s2Body: 'Deposits and withdrawals with Orange Money, MTN MoMo and Moov Money, transfers between DALA users.',
    s3Title: 'Credit at your fingertips', s3Body: 'Micro-loans up to 100,000 FCFA, total cost shown before you commit.',
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
