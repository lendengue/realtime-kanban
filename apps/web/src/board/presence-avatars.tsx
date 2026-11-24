import { useTranslation } from 'react-i18next';
import type { Awareness } from 'y-protocols/awareness';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, initials } from '@/lib/utils';

import { uniqueUsers, usePeers, type PresenceUser } from './presence';

export function UserAvatar({
  user,
  label,
  size = 'default',
  className,
}: {
  user: PresenceUser;
  label: string;
  size?: 'default' | 'sm';
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      title={label}
      aria-label={label}
      role="img"
      className={cn('ring-2 ring-background', className)}
      style={{ boxShadow: `0 0 0 2px ${user.color}` }}
    >
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
      <AvatarFallback
        className="text-xs font-medium text-white"
        style={{ backgroundColor: user.color }}
      >
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Everyone with the board open, the current user first. */
export function PresenceAvatars({ awareness, self }: { awareness: Awareness; self: PresenceUser }) {
  const { t } = useTranslation();
  const others = usePeers(awareness, (peers) =>
    uniqueUsers(peers).filter((user) => user.id !== self.id),
  );

  return (
    <ul className="flex items-center -space-x-1.5" aria-label={t('board.presence.online')}>
      <li>
        <UserAvatar user={self} label={t('board.presence.you', { name: self.name })} />
      </li>
      {others.map((user) => (
        <li key={user.id} data-testid="presence-avatar">
          <UserAvatar user={user} label={user.name} />
        </li>
      ))}
    </ul>
  );
}
