import { describe, expect, it } from 'vitest';

import { useTestApp } from './test/harness.js';

describe('service endpoints', () => {
  const t = useTestApp();

  it('GET /health reports the service as healthy', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'api' });
  });

  it('serves the OpenAPI document', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/docs/json' });
    expect(response.statusCode).toBe(200);
    const doc = response.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/api/v1/auth/login', '/api/v1/workspaces/{id}/boards']),
    );
  });

  it('returns the standard error format for unknown routes', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('allows CORS only for the web origin', async () => {
    const allowed = await t.app.inject({
      method: 'OPTIONS',
      url: '/api/v1/workspaces',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await t.app.inject({
      method: 'OPTIONS',
      url: '/api/v1/workspaces',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
