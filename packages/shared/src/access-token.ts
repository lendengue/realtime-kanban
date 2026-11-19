import { jwtVerify, SignJWT } from 'jose';

const ISSUER = 'realtime-kanban';
const AUDIENCE = 'realtime-kanban';
const ALGORITHM = 'HS256';

export interface AccessTokenClaims {
  userId: string;
}

/**
 * Issues and verifies the short-lived access tokens (HS256). Used by the API to sign and by the
 * collab server to verify, with the same shared secret (ADR 0010).
 */
export class AccessTokenService {
  readonly #key: Uint8Array;

  constructor(
    secret: string,
    readonly ttlSeconds: number,
  ) {
    this.#key = new TextEncoder().encode(secret);
  }

  sign({ userId }: AccessTokenClaims): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.#key);
  }

  /** Returns the claims, or `null` when the token is invalid or expired. */
  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.#key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: [ALGORITHM],
      });
      return payload.sub ? { userId: payload.sub } : null;
    } catch {
      return null;
    }
  }
}
