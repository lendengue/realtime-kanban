import { Link, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Logo } from '@/components/logo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { clearOfflineData } from '@/lib/offline';
import { session } from '@/lib/session';
import { useSession } from '@/lib/use-session';
import { initials } from '@/lib/utils';

export function AppHeader() {
  const { t } = useTranslation();
  const state = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = async () => {
    const current = session.getState();
    const userId = current.status === 'authenticated' ? current.user.id : undefined;
    await api.auth.logout().catch(() => undefined);
    session.signOut();
    queryClient.clear();
    await router.navigate({ to: '/login' });
    // Offline copies of boards stay on the device until sign-out (ADR 0019). Run after leaving
    // the board so its database is closed.
    await clearOfflineData(userId);
  };

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          to="/w"
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo />
        </Link>
        {state.status === 'authenticated' && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={state.user.name}
            >
              <Avatar>
                <AvatarFallback>{initials(state.user.name)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="font-medium">{state.user.name}</div>
                <div className="text-xs font-normal text-muted-foreground">{state.user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void logout()}>
                <LogOut />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
