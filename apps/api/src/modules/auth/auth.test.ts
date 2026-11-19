import { schema } from '@realtime-kanban/db';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { refreshCookieOf, registerUser, useTestApp } from '../../test/harness.js';

describe('auth', () => {
  const t = useTestApp();

  const refresh = (token: string) =>
    t.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { realtime_kanban_rt: token },
    });

  const login = (email: string, password: string) =>
    t.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });

  describe('POST /auth/register', () => {
    it('creates the user, returns an access token and sets the refresh cookie', async () => {
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'Alice@Demo.dev', name: 'Alice', password: 'password123' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        accessToken: expect.any(String),
        expiresIn: 900,
        user: { email: 'alice@demo.dev', name: 'Alice', avatarUrl: null },
      });
      expect(refreshCookieOf(response)).toMatchObject({
        httpOnly: true,
        sameSite: 'Lax',
        path: '/api/v1/auth',
      });

      const [stored] = await t.database.db.select().from(schema.users);
      expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('rejects a duplicate e-mail regardless of case', async () => {
      await registerUser(t.app, { email: 'alice@demo.dev' });
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'ALICE@demo.dev', name: 'Other', password: 'password123' },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: 'EMAIL_TAKEN' } });
    });

    it('validates the body with the standard error format', async () => {
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'not-an-email', name: '', password: 'short' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.any(String),
          details: expect.any(Array),
        },
      });
    });
  });

  describe('POST /auth/login', () => {
    it('accepts valid credentials and rejects wrong ones with the same error', async () => {
      await registerUser(t.app, { email: 'bob@demo.dev', password: 'password123' });

      const ok = await login('bob@demo.dev', 'password123');
      expect(ok.statusCode).toBe(200);
      expect(refreshCookieOf(ok)?.value).toBeTruthy();

      const wrongPassword = await login('bob@demo.dev', 'nope-nope');
      const unknownUser = await login('ghost@demo.dev', 'password123');
      for (const response of [wrongPassword, unknownUser]) {
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
      }
    });

    it('rate limits to 5 attempts per minute per IP and e-mail', async () => {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt++) {
        statuses.push((await login('limited@demo.dev', 'wrong-password')).statusCode);
      }
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);

      const blocked = await login('limited@demo.dev', 'wrong-password');
      expect(blocked.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });

      // A different e-mail from the same IP has its own budget.
      expect((await login('other@demo.dev', 'wrong-password')).statusCode).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user for a valid access token', async () => {
      const alice = await registerUser(t.app, { email: 'alice@demo.dev', name: 'Alice' });
      const response = await t.app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: alice.headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ user: alice.user });
    });

    it.each([
      ['no header', {}],
      ['a malformed token', { authorization: 'Bearer not-a-jwt' }],
      ['a non-bearer scheme', { authorization: 'Basic abc' }],
    ])('rejects requests with %s', async (_label, headers) => {
      const response = await t.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      const alice = await registerUser(t.app, { email: 'alice@demo.dev' });

      const response = await refresh(alice.refreshToken);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ accessToken: expect.any(String), user: alice.user });

      const rotated = refreshCookieOf(response)?.value;
      expect(rotated).toBeTruthy();
      expect(rotated).not.toBe(alice.refreshToken);
      expect((await refresh(rotated ?? '')).statusCode).toBe(200);
    });

    it('detects reuse of a rotated token and revokes the whole family', async () => {
      const alice = await registerUser(t.app, { email: 'alice@demo.dev' });
      const first = await refresh(alice.refreshToken);
      const legitimateToken = refreshCookieOf(first)?.value ?? '';

      // An attacker replays the old token...
      const replay = await refresh(alice.refreshToken);
      expect(replay.statusCode).toBe(401);
      expect(replay.json()).toMatchObject({ error: { code: 'INVALID_REFRESH_TOKEN' } });
      expect(refreshCookieOf(replay)?.value).toBe('');

      // ...so the legitimate successor is revoked too.
      expect((await refresh(legitimateToken)).statusCode).toBe(401);

      const tokens = await t.database.db
        .select()
        .from(schema.refreshTokens)
        .where(eq(schema.refreshTokens.userId, alice.user.id));
      expect(tokens).toHaveLength(2);
      expect(tokens.every((token) => token.revokedAt !== null)).toBe(true);
    });

    it('does not affect other sessions of the same user', async () => {
      const alice = await registerUser(t.app, { email: 'alice@demo.dev', password: 'password123' });
      const otherDevice =
        refreshCookieOf(await login('alice@demo.dev', 'password123'))?.value ?? '';

      await refresh(alice.refreshToken);
      await refresh(alice.refreshToken); // reuse -> revokes only the first family

      expect((await refresh(otherDevice)).statusCode).toBe(200);
    });

    it('rejects missing, unknown and expired tokens', async () => {
      const alice = await registerUser(t.app, { email: 'alice@demo.dev' });
      await t.database.db
        .update(schema.refreshTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(schema.refreshTokens.userId, alice.user.id));

      const missing = await t.app.inject({ method: 'POST', url: '/api/v1/auth/refresh' });
      for (const response of [
        missing,
        await refresh('unknown-token'),
        await refresh(alice.refreshToken),
      ]) {
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ error: { code: 'INVALID_REFRESH_TOKEN' } });
      }
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const alice = await registerUser(t.app, { email: 'alice@demo.dev' });
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        cookies: { realtime_kanban_rt: alice.refreshToken },
      });
      expect(response.statusCode).toBe(204);
      expect(refreshCookieOf(response)?.value).toBe('');
      expect((await refresh(alice.refreshToken)).statusCode).toBe(401);
    });

    it('succeeds without a cookie', async () => {
      const response = await t.app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
      expect(response.statusCode).toBe(204);
    });
  });
});
