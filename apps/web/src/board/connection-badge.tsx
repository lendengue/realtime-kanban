import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { ConnectionStatus } from './use-board-connection';

const dot: Record<ConnectionStatus, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500',
  disconnected: 'bg-zinc-400',
  forbidden: 'bg-destructive',
};

export function ConnectionBadge({ status, synced }: { status: ConnectionStatus; synced: boolean }) {
  const { t } = useTranslation();
  const label =
    status === 'connected' && !synced ? t('board.status.syncing') : t(`board.status.${status}`);
  return (
    <Badge variant="outline" role="status" aria-live="polite" data-testid="connection-status">
      <span className={cn('size-2 rounded-full', dot[status])} aria-hidden />
      {label}
    </Badge>
  );
}
