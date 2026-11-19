import { describe, expect, it } from 'vitest';

import { registerBodySchema } from './auth.js';

describe('registerBodySchema', () => {
  it('normalises the email address', () => {
    const parsed = registerBodySchema.parse({
      email: '  Alice@Demo.DEV ',
      name: 'Alice',
      password: 'password',
    });
    expect(parsed.email).toBe('alice@demo.dev');
  });

  it('rejects short passwords', () => {
    const result = registerBodySchema.safeParse({ email: 'a@b.dev', name: 'A', password: 'short' });
    expect(result.success).toBe(false);
  });
});
