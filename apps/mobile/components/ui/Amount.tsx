import { formatFCFA } from '@dala/shared';
import { useUiStore } from '@/stores/ui';
import { AppText, type AppTextProps } from './AppText';

interface Props extends Omit<AppTextProps, 'children'> {
  value: number;
  sign?: boolean;
  compact?: boolean;
  /** Respecte le masquage global du solde (œil sur l'accueil). */
  maskable?: boolean;
}

export function Amount({ value, sign, compact, maskable, ...rest }: Props) {
  const hidden = useUiStore((s) => s.balanceHidden) && maskable;
  const text = hidden ? '•••••• FCFA' : formatFCFA(value, { sign, compact });
  return (
    <AppText accessibilityLabel={hidden ? 'Montant masqué' : text.replace('FCFA', 'francs CFA')} {...rest}>
      {text}
    </AppText>
  );
}
