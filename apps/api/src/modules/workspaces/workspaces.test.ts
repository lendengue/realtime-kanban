import type { Member, Workspace } from '@realtime-kanban/shared';
import { describe, expect, it } from 'vitest';

import { createWorkspace, workspaceWithAllRoles } from '../../test/fixtures.js';
import { registerUser, useTestApp, type TestUser } from '../../test/harness.js';

describe('workspaces', () => {
  const t = useTestApp();

  const request = (
    user: TestUser,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) =>
    t.app.inject({
      method,
      url: `/api/v1${url}`,
      headers: user.headers,
      ...(payload && { payload }),
    });

  it('creates a workspace with a unique slug and makes the creator its owner', async () => {
    const alice = await registerUser(t.app, { email: 'alice@demo.dev' });
    const first = await createWorkspace(t.app, alice, 'Acme Inc.');
    const second = await createWorkspace(t.app, alice, 'Acme Inc.');

    expect(first).toMatchObject({
      name: 'Acme Inc.',
      slug: 'acme-inc',
      role: 'owner',
      ownerId: alice.user.id,
    });
    expect(second.slug).toMatch(/^acme-inc-[0-9a-f]{6}$/);

    const list = await request(alice, 'GET', '/workspaces');
    expect(list.json<{ workspaces: Workspace[] }>().workspaces).toHaveLength(2);
  });

  it('only lists and reveals workspaces the user belongs to', async () => {
    const alice = await registerUser(t.app, { email: 'alice@demo.dev' });
    const bob = await registerUser(t.app, { email: 'bob@demo.dev' });
    const workspace = await createWorkspace(t.app, alice);

    expect((await request(bob, 'GET', '/workspaces')).json()).toEqual({ workspaces: [] });
    const hidden = await request(bob, 'GET', `/workspaces/${workspace.id}`);
    expect(hidden.statusCode).toBe(404);
    expect(hidden.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('requires authentication', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/api/v1/workspaces' });
    expect(response.statusCode).toBe(401);
  });

  describe('permissions by role', () => {
    it('lets owner and admin rename; member and viewer get 403', async () => {
      const s = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
      const rename = (user: TestUser) =>
        request(user, 'PATCH', `/workspaces/${s.workspace.id}`, { name: 'Renamed' });

      expect((await rename(s.owner)).statusCode).toBe(200);
      expect((await rename(s.admin)).json()).toMatchObject({
        workspace: { name: 'Renamed', role: 'admin' },
      });
      expect((await rename(s.member)).statusCode).toBe(403);
      expect((await rename(s.viewer)).statusCode).toBe(403);
      expect((await rename(s.outsider)).statusCode).toBe(404);
    });

    it('lets only the owner delete the workspace', async () => {
      const s = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
      const remove = (user: TestUser) => request(user, 'DELETE', `/workspaces/${s.workspace.id}`);

      expect((await remove(s.admin)).statusCode).toBe(403);
      expect((await remove(s.member)).statusCode).toBe(403);
      expect((await remove(s.owner)).statusCode).toBe(204);
      expect((await request(s.owner, 'GET', `/workspaces/${s.workspace.id}`)).statusCode).toBe(404);
    });
  });

  describe('members', () => {
    it('lists members with their roles to every member', async () => {
      const s = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
      const response = await request(s.viewer, 'GET', `/workspaces/${s.workspace.id}/members`);
      const roles = response.json<{ members: Member[] }>().members.map((m) => [m.email, m.role]);
      expect(roles).toEqual([
        ['owner@demo.dev', 'owner'],
        ['admin@demo.dev', 'admin'],
        ['member@demo.dev', 'member'],
        ['viewer@demo.dev', 'viewer'],
      ]);
    });

    it('lets owner and admin change roles, never the owner role', async () => {
      const s = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
      const setRole = (actor: TestUser, target: TestUser, role: string) =>
        request(actor, 'PATCH', `/workspaces/${s.workspace.id}/members/${target.user.id}`, {
          role,
        });

      expect((await setRole(s.admin, s.viewer, 'member')).json()).toMatchObject({
        member: { userId: s.viewer.user.id, role: 'member' },
      });
      expect((await setRole(s.member, s.viewer, 'admin')).statusCode).toBe(403);
      expect((await setRole(s.admin, s.owner, 'viewer')).statusCode).toBe(403);
      expect((await setRole(s.owner, s.admin, 'owner')).statusCode).toBe(400);
    });

    it('lets managers remove members and anyone leave, but never removes the owner', async () => {
      const s = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
      const removeMember = (actor: TestUser, target: TestUser) =>
        request(actor, 'DELETE', `/workspaces/${s.workspace.id}/members/${target.user.id}`);

      expect((await removeMember(s.member, s.viewer)).statusCode).toBe(403);
      expect((await removeMember(s.admin, s.viewer)).statusCode).toBe(204);
      expect((await removeMember(s.member, s.member)).statusCode).toBe(204);
      expect((await removeMember(s.admin, s.owner)).statusCode).toBe(403);
      expect((await removeMember(s.owner, s.owner)).statusCode).toBe(403);

      const remaining = await request(s.owner, 'GET', `/workspaces/${s.workspace.id}/members`);
      expect(remaining.json<{ members: Member[] }>().members.map((m) => m.role)).toEqual([
        'owner',
        'admin',
      ]);
    });
  });
});
