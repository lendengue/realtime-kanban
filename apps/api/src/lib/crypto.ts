import { createHash, randomBytes } from 'node:crypto';

/** URL-safe random token with 256 bits of entropy. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are stored hashed; SHA-256 is enough because they are long random values. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
