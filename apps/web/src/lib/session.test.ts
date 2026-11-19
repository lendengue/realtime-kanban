import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const user = {
  id: '01a1f40a-5112-7531-b90c-95941a0506fb',
  email: 'alice@demo.dev',
  name: 'Alice',
  avatarUrl: null,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const authBody = (accessToken: string) => ({ accessToken, expiresIn: 900, user });

describe('session and api client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('de-duplicates concurrent refreshes so a rotated token is never reused', async () => {
    const { session } = await import('./session');
    fetchMock.mockResolvedValue(json(200, authBody('token-1')));

    const results = await Promise.all([session.refresh(), session.refresh(), session.ensure()]);

    expect(results).toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(session.accessToken).toBe('token-1');
  });

  it('becomes anonymous when the refresh cookie is rejected', async () => {
    const { session } = await import('./session');
    fetchMock.mockResolvedValue(
      json(401, { error: { code: 'INVALID_REFRESH_TOKEN', message: 'nope' } }),
    );

    expect(await session.ensure()).toBe(false);
    expect(session.getState()).toEqual({ status: 'anonymous' });
    // Anonymous state is remembered: no second network call.
    expect(await session.ensure()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes once and retries a request that failed with 401', async () => {
    const { session } = await import('./session');
    const { apiRequest } = await import('./api-client');
    session.signIn(authBody('expired'));

    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } }))
      .mockResolvedValueOnce(json(200, authBody('fresh')))
      .mockResolvedValueOnce(json(200, { ok: true }));

    await expect(apiRequest('/workspaces')).resolves.toBeUndefined();

    const calls = fetchMock.mock.calls.map(([input, init]) => [
      input instanceof Request ? input.url : input.toString(),
      (init?.headers as Record<string, string> | undefined)?.authorization,
    ]);
    expect(calls).toEqual([
      ['http://localhost:3000/api/v1/workspaces', 'Bearer expired'],
      ['http://localhost:3000/api/v1/auth/refresh', undefined],
      ['http://localhost:3000/api/v1/workspaces', 'Bearer fresh'],
    ]);
  });

  it('maps API errors to ApiError with the server code', async () => {
    const { apiRequest, ApiError } = await import('./api-client');
    fetchMock.mockResolvedValue(json(403, { error: { code: 'FORBIDDEN', message: 'no' } }));

    const error = await apiRequest('/workspaces/x', { retryOnUnauthorized: false }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
