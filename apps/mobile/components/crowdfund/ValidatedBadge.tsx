import { CROWDFUND_VALIDATOR } from '@dala/shared';
import { TEXT_ON_WHITE } from '@/theme';
import { Badge, DalaIcon } from '@/components/ui';

export function ValidatedBadge() {
  return <Badge label={`Validé par ${CROWDFUND_VALIDATOR}`} color={TEXT_ON_WHITE.green} icon={<DalaIcon name="validated-projects" size={18} />} />;
}
