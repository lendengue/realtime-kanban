import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { AccessTokenService } from './access-token.js';

const secret = 'a-test-secret-that-is-long-enough-1234';

describe('AccessTokenService', () => {
  const service = new AccessTokenService(secret, 900);

  it('signs tokens it can verify', async () => {
    const token = await service.sign({ userId: 'user-1' });
    expect(await service.verify(token)).toEqual({ userId: 'user-1' });
  });

  it('rejects tokens signed with another secret', async () => {
    const other = new AccessTokenService('another-secret-that-is-long-enough-12', 900);
    expect(await service.verify(await other.sign({ userId: 'user-1' }))).toBeNull();
  });

  it('rejects expired tokens and garbage', async () => {
    const expired = new AccessTokenService(secret, -10);
    expect(await service.verify(await expired.sign({ userId: 'user-1' }))).toBeNull();
    expect(await service.verify('not.a.jwt')).toBeNull();
  });

  it('rejects tokens with a wrong audience or no subject', async () => {
    const key = new TextEncoder().encode(secret);
    const wrongAudience = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('realtime-kanban')
      .setAudience('someone-else')
      .setExpirationTime('1m')
      .sign(key);
    const noSubject = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('realtime-kanban')
      .setAudience('realtime-kanban')
      .setExpirationTime('1m')
      .sign(key);
    expect(await service.verify(wrongAudience)).toBeNull();
    expect(await service.verify(noSubject)).toBeNull();
  });
});
