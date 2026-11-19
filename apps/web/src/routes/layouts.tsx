import { Outlet } from '@tanstack/react-router';

import { AppHeader } from '@/components/app-header';
import { Logo } from '@/components/logo';

export function RootLayout() {
  return <Outlet />;
}

export function AppLayout() {
  return (
    <div className="min-h-screen bg-muted/40">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 px-4">
      <Logo />
      <Outlet />
    </div>
  );
}
