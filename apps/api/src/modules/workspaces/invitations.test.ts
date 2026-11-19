import { schema } from '@realtime-kanban/db';
import { describe, expect, it } from 'vitest';

import { createWorkspace, workspaceWithAllRoles } from '../../test/fixtures.js';
import { registerUser, useTestApp, type TestUser } from '../../test/harness.js';

describe('invitations', () => {
  const t = useTestApp();

  const invite = (user: TestUser, workspaceId: string, email: string, role = 'member') =>
    t.app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/invitations`,
      headers: user.headers,
      payload: { email, role },
    });

  const accept = (user: TestUser, token: string) =>
    t.app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${token}/accept`,
      headers: user.headers,
    });

  const tokenOf = (url: string) => url.split('/invite/')[1] ?? '';

  it('e-mails an accept link and adds the invitee with the invited role', async () => {
    const alice = await registerUser(t.app, { email: 'alice@demo.dev' });
    const workspace = await createWorkspace(t.app, alice, 'Acme');

    const response = await invite(alice, workspace.id, 'Bob@Demo.dev', 'viewer');
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      invitation: { workspaceId: workspace.id, email: 'bob@demo.dev', role: 'viewer' },
    });

    const [mail] = t.mailer.messages;
    expect(mail).toMatchObject({ to: 'bob@demo.dev', subject: expect.stringContaining('Acme') });
    expect(t.lastAcceptUrl()).toMatch(/^http:\/\/localhost:5173\/invite\/[\w-]{43}$/);

    // The raw token is never stored.
    const [stored] = await t.database.db.select().from(schema.invitations);
    expect(stored?.tokenHash).not.toBe(tokenOf(t.lastAcceptUrl()));

    const bob = await registerUser(t.app, { email: 'bob@demo.dev' });
    const accepted = await accept(bob, tokenOf(t.lastAcceptUrl()));
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ workspace: { id: workspace.id, role: 'viewer' } });
  });

  it('only lets owner and admin invite', async () => {
    const s = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
    expect((await invite(s.admin, s.workspace.id, 'new@demo.dev')).statusCode).toBe(201);
    expect((await invite(s.member, s.workspace.id, 'new@demo.dev')).statusCode).toBe(403);
    expect((await invite(s.viewer, s.workspace.id, 'new@demo.dev')).statusCode).toBe(403);
    expect((await invite(s.outsider, s.workspace.id, 'new@demo.dev')).statusCode).toBe(404);
  });

  it('cannot invite someone who is already a member or as owner', async () => {
    const s = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
    const existing = await invite(s.owner, s.workspace.id, 'MEMBER@demo.dev');
    expect(existing.statusCode).toBe(409);
    expect(existing.json()).toMatchObject({ error: { code: 'ALREADY_MEMBER' } });
    expect((await invite(s.owner, s.workspace.id, 'x@demo.dev', 'owner')).statusCode).toBe(400);
  });

  it('rejects acceptance by a different e-mail address', async () => {
    const alice = await registerUser(t.app, { email: 'alice@demo.dev' });
    const workspace = await createWorkspace(t.app, alice);
    await invite(alice, workspace.id, 'bob@demo.dev');
    const mallory = await registerUser(t.app, { email: 'mallory@demo.dev' });

    const response = await accept(mallory, tokenOf(t.lastAcceptUrl()));
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'INVITATION_EMAIL_MISMATCH' } });
  });

  it('cannot be used twice, after expiry or with an unknown token', async () => {
    const alice = await registerUser(t.app, { email: 'alice@demo.dev' });
    const workspace = await createWorkspace(t.app, alice);
    const bob = await registerUser(t.app, { email: 'bob@demo.dev' });
    const carol = await registerUser(t.app, { email: 'carol@demo.dev' });

    await invite(alice, workspace.id, 'bob@demo.dev');
    const bobToken = tokenOf(t.lastAcceptUrl());
    expect((await accept(bob, bobToken)).statusCode).toBe(200);
    const reused = await accept(bob, bobToken);
    expect(reused.statusCode).toBe(400);
    expect(reused.json()).toMatchObject({ error: { code: 'INVITATION_INVALID' } });

    await invite(alice, workspace.id, 'carol@demo.dev');
    await t.database.db.update(schema.invitations).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await accept(carol, tokenOf(t.lastAcceptUrl()))).statusCode).toBe(400);

    expect((await accept(carol, 'x'.repeat(43))).statusCode).toBe(400);
  });
});
