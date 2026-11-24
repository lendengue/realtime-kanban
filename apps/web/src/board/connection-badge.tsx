import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { ConnectionStatus } from './use-board-connection';

const dot: Record<ConnectionStatus, string> = {
  online: 'bg-emerald-500',
  syncing: 'bg-sky-500 animate-pulse',
  connecting: 'bg-amber-500',
  offline: 'bg-zinc-400',
  forbidden: 'bg-destructive',
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      role="status"
      aria-live="polite"
      title={t(`board.statusHint.${status}`)}
      data-testid="connection-status"
      data-status={status}
    >
      <span className={cn('size-2 rounded-full', dot[status])} aria-hidden />
      {t(`board.status.${status}`)}
    </Badge>
  );
}
