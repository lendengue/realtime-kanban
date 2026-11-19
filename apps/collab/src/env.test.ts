import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const required = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', JWT_SECRET: 'x'.repeat(32) };

describe('loadEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    expect(loadEnv(required)).toMatchObject({
      HOST: '0.0.0.0',
      PORT: 1234,
      STORE_DEBOUNCE_MS: 2000,
      STORE_MAX_DEBOUNCE_MS: 10_000,
    });
  });

  it('requires the database url and the shared JWT secret', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...required, JWT_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ ...required, PORT: '70000' })).toThrow(/Invalid environment variables/);
  });
});
