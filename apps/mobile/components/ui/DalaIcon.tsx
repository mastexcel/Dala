import { Image, type ImageStyle, type StyleProp } from 'react-native';

/**
 * Icônes illustrées de la charte DALA (planche design/icon-sheet.png, découpée par
 * design/cut_icons.py). Multicolores : elles s'utilisent sur fond clair et ne se teintent pas.
 */
const ICONS = {
  add: require('@/assets/icons/add.png'),
  autosave: require('@/assets/icons/autosave.png'),
  back: require('@/assets/icons/back.png'),
  bonds: require('@/assets/icons/bonds.png'),
  close: require('@/assets/icons/close.png'),
  contribution: require('@/assets/icons/contribution.png'),
  credit: require('@/assets/icons/credit.png'),
  crowdfund: require('@/assets/icons/crowdfund.png'),
  delete: require('@/assets/icons/delete.png'),
  deposit: require('@/assets/icons/deposit.png'),
  details: require('@/assets/icons/details.png'),
  edit: require('@/assets/icons/edit.png'),
  error: require('@/assets/icons/error.png'),
  explore: require('@/assets/icons/explore.png'),
  fcp: require('@/assets/icons/fcp.png'),
  goals: require('@/assets/icons/goals.png'),
  home: require('@/assets/icons/home.png'),
  info: require('@/assets/icons/info.png'),
  interest: require('@/assets/icons/interest.png'),
  invest: require('@/assets/icons/invest.png'),
  investors: require('@/assets/icons/investors.png'),
  kyc: require('@/assets/icons/kyc.png'),
  menu: require('@/assets/icons/menu.png'),
  more: require('@/assets/icons/more.png'),
  'more-dots': require('@/assets/icons/more-dots.png'),
  'my-loans': require('@/assets/icons/my-loans.png'),
  news: require('@/assets/icons/news.png'),
  next: require('@/assets/icons/next.png'),
  notifications: require('@/assets/icons/notifications.png'),
  pending: require('@/assets/icons/pending.png'),
  performance: require('@/assets/icons/performance.png'),
  portfolio: require('@/assets/icons/portfolio.png'),
  previous: require('@/assets/icons/previous.png'),
  profile: require('@/assets/icons/profile.png'),
  receive: require('@/assets/icons/receive.png'),
  referral: require('@/assets/icons/referral.png'),
  repay: require('@/assets/icons/repay.png'),
  'request-loan': require('@/assets/icons/request-loan.png'),
  savings: require('@/assets/icons/savings.png'),
  scan: require('@/assets/icons/scan.png'),
  schedule: require('@/assets/icons/schedule.png'),
  score: require('@/assets/icons/score.png'),
  security: require('@/assets/icons/security.png'),
  send: require('@/assets/icons/send.png'),
  settings: require('@/assets/icons/settings.png'),
  simulation: require('@/assets/icons/simulation.png'),
  status: require('@/assets/icons/status.png'),
  'submit-project': require('@/assets/icons/submit-project.png'),
  success: require('@/assets/icons/success.png'),
  sukuk: require('@/assets/icons/sukuk.png'),
  tontines: require('@/assets/icons/tontines.png'),
  transfers: require('@/assets/icons/transfers.png'),
  'tx-all': require('@/assets/icons/tx-all.png'),
  'tx-credit': require('@/assets/icons/tx-credit.png'),
  'tx-crowdfund': require('@/assets/icons/tx-crowdfund.png'),
  'tx-invest': require('@/assets/icons/tx-invest.png'),
  'tx-savings': require('@/assets/icons/tx-savings.png'),
  user: require('@/assets/icons/user.png'),
  'validated-projects': require('@/assets/icons/validated-projects.png'),
  vault: require('@/assets/icons/vault.png'),
  warning: require('@/assets/icons/warning.png'),
  withdraw: require('@/assets/icons/withdraw.png'),
} as const;

export type DalaIconName = keyof typeof ICONS;

interface Props {
  name: DalaIconName;
  size?: number;
  /** Atténue l'icône (onglet inactif, élément désactivé). */
  dimmed?: boolean;
  style?: StyleProp<ImageStyle>;
  /** Libellé lu par les lecteurs d'écran ; sans libellé l'icône est décorative. */
  label?: string;
}

export function DalaIcon({ name, size = 32, dimmed, style, label }: Props) {
  return (
    <Image
      source={ICONS[name]}
      style={[{ width: size, height: size, opacity: dimmed ? 0.4 : 1 }, style]}
      resizeMode="contain"
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
