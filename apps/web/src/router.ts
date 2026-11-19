import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';

import { workspacesQuery } from './lib/queries';
import { safeRedirect } from './lib/redirect';
import { session } from './lib/session';
import { AcceptInvitePage } from './routes/accept-invite';
import { BoardPage } from './routes/board';
import { AppLayout, AuthLayout, RootLayout } from './routes/layouts';
import { LoginPage } from './routes/login';
import { MembersPage } from './routes/members';
import { NotFoundPage } from './routes/not-found';
import { RegisterPage } from './routes/register';
import { WorkspacePage } from './routes/workspace';
import { WorkspacesPage } from './routes/workspaces';

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    throw redirect({ to: (await session.ensure()) ? '/w' : '/login' });
  },
});

const authSearch = z.object({ redirect: z.string().optional() });

/** Pathless layout for sign-in pages; signed-in users are sent on. */
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  component: AuthLayout,
  validateSearch: authSearch,
  beforeLoad: async ({ search }) => {
    if (await session.ensure()) throw redirect({ href: safeRedirect(search.redirect) });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/login',
  component: LoginPage,
});
const registerRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/register',
  component: RegisterPage,
});

/** Pathless layout guarding every signed-in page. */
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  component: AppLayout,
  beforeLoad: async ({ location }) => {
    if (!(await session.ensure())) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
});

const workspacesRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/w',
  // Warm the cache; pages render their own loading and error states.
  loader: ({ context }) => {
    void context.queryClient.query(workspacesQuery()).catch(() => undefined);
  },
});
const workspacesIndexRoute = createRoute({
  getParentRoute: () => workspacesRoute,
  path: '/',
  component: WorkspacesPage,
});
const workspaceRoute = createRoute({
  getParentRoute: () => workspacesRoute,
  path: '$workspaceSlug',
});
const workspaceIndexRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/',
  component: WorkspacePage,
});
const membersRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'members',
  component: MembersPage,
});
const boardRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'b/$boardId',
  component: BoardPage,
});
const acceptInviteRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/invite/$token',
  component: AcceptInvitePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute.addChildren([loginRoute, registerRoute]),
  authedRoute.addChildren([
    workspacesRoute.addChildren([
      workspacesIndexRoute,
      workspaceRoute.addChildren([workspaceIndexRoute, membersRoute, boardRoute]),
    ]),
    acceptInviteRoute,
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
