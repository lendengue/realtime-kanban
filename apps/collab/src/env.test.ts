import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(loadEnv({})).toMatchObject({ HOST: '0.0.0.0', PORT: 1234, LOG_LEVEL: 'info' });
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ PORT: '70000' })).toThrow(/Invalid environment variables/);
  });
});
