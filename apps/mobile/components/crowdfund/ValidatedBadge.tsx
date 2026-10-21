import { SealCheck } from 'phosphor-react-native';
import { CROWDFUND_VALIDATOR } from '@dala/shared';
import { TEXT_ON_WHITE } from '@/theme';
import { Badge } from '@/components/ui';

export function ValidatedBadge() {
  return <Badge label={`Validé par ${CROWDFUND_VALIDATOR}`} color={TEXT_ON_WHITE.green} icon={<SealCheck size={14} color={TEXT_ON_WHITE.green} weight="fill" />} />;
}
