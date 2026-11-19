import type { AssignableRole, Board, Workspace } from '@realtime-kanban/shared';
import type { FastifyInstance } from 'fastify';

import { registerUser, type TestUser } from './harness.js';

export async function createWorkspace(
  app: FastifyInstance,
  owner: TestUser,
  name = 'Acme',
): Promise<Workspace> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/workspaces',
    headers: owner.headers,
    payload: { name },
  });
  if (response.statusCode !== 201) throw new Error(`create workspace: ${response.body}`);
  return response.json<{ workspace: Workspace }>().workspace;
}

export async function createBoard(
  app: FastifyInstance,
  user: TestUser,
  workspaceId: string,
  title = 'Roadmap',
): Promise<Board> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/workspaces/${workspaceId}/boards`,
    headers: user.headers,
    payload: { title },
  });
  if (response.statusCode !== 201) throw new Error(`create board: ${response.body}`);
  return response.json<{ board: Board }>().board;
}

/** Invites `email` with `role` and accepts with a freshly registered account. */
export async function addMember(
  app: FastifyInstance,
  inviter: TestUser,
  workspaceId: string,
  email: string,
  role: AssignableRole,
  acceptUrlOf: () => string,
): Promise<TestUser> {
  const invite = await app.inject({
    method: 'POST',
    url: `/api/v1/workspaces/${workspaceId}/invitations`,
    headers: inviter.headers,
    payload: { email, role },
  });
  if (invite.statusCode !== 201) throw new Error(`invite: ${invite.body}`);
  const user = await registerUser(app, { email });
  const token = acceptUrlOf().split('/invite/')[1] ?? '';
  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/invitations/${token}/accept`,
    headers: user.headers,
  });
  if (accept.statusCode !== 200) throw new Error(`accept: ${accept.body}`);
  return user;
}

/** Workspace with one user per role. */
export async function workspaceWithAllRoles(app: FastifyInstance, lastAcceptUrl: () => string) {
  const owner = await registerUser(app, { email: 'owner@demo.dev' });
  const workspace = await createWorkspace(app, owner);
  const admin = await addMember(app, owner, workspace.id, 'admin@demo.dev', 'admin', lastAcceptUrl);
  const member = await addMember(
    app,
    owner,
    workspace.id,
    'member@demo.dev',
    'member',
    lastAcceptUrl,
  );
  const viewer = await addMember(
    app,
    owner,
    workspace.id,
    'viewer@demo.dev',
    'viewer',
    lastAcceptUrl,
  );
  const outsider = await registerUser(app, { email: 'outsider@demo.dev' });
  return { workspace, owner, admin, member, viewer, outsider };
}
