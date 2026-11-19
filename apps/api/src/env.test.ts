import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const required = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('loadEnv', () => {
  it('applies defaults for optional variables', () => {
    expect(loadEnv(required)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      ACCESS_TOKEN_TTL_SECONDS: 900,
      COOKIE_SECURE: true,
      WEB_ORIGIN: 'http://localhost:5173',
    });
  });

  it('requires a database url and a long enough JWT secret', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...required, JWT_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ ...required, PORT: 'not-a-port' })).toThrow(/Invalid environment/);
  });
});
