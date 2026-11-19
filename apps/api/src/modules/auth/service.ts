import { randomUUID } from 'node:crypto';

import { schema } from '@realtime-kanban/db';
import type { LoginBody, RegisterBody } from '@realtime-kanban/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { AppContext } from '../../context.js';
import { generateToken, hashToken } from '../../lib/crypto.js';
import { AppError } from '../../lib/errors.js';
import { hashPassword, simulatePasswordCheck, verifyPassword } from '../../lib/password.js';

type UserRow = typeof schema.users.$inferSelect;

export interface ClientInfo {
  userAgent: string | undefined;
  ip: string;
}

export interface Session {
  user: UserRow;
  accessToken: string;
  refreshToken: string;
}

export const invalidRefreshToken = () =>
  new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');

export class AuthService {
  constructor(private readonly ctx: AppContext) {}

  async register(body: RegisterBody, client: ClientInfo): Promise<Session> {
    const passwordHash = await hashPassword(body.password);
    const [user] = await this.ctx.db
      .insert(schema.users)
      .values({ email: body.email, name: body.name, passwordHash })
      .onConflictDoNothing({ target: schema.users.email })
      .returning();
    if (!user) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this e-mail already exists');
    }
    return this.createSession(user, client);
  }

  async login(body: LoginBody, client: ClientInfo): Promise<Session> {
    const user = await this.ctx.db.query.users.findFirst({
      where: eq(schema.users.email, body.email),
    });
    if (!user) {
      await simulatePasswordCheck(body.password);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail or password is incorrect');
    }
    if (!(await verifyPassword(user.passwordHash, body.password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail or password is incorrect');
    }
    return this.createSession(user, client);
  }

  /**
   * Exchanges a refresh token for a new one in the same family.
   * Presenting a token that was already rotated or revoked is treated as theft:
   * the whole family is revoked and every session derived from it ends.
   */
  async refresh(refreshToken: string, client: ClientInfo): Promise<Session> {
    const { db } = this.ctx;
    const tokenHash = hashToken(refreshToken);

    const result = await db.transaction(async (tx) => {
      const current = await tx.query.refreshTokens.findFirst({
        where: eq(schema.refreshTokens.tokenHash, tokenHash),
      });
      if (!current) return { kind: 'invalid' } as const;

      if (current.revokedAt) return { kind: 'reused', familyId: current.familyId } as const;
      if (current.expiresAt.getTime() <= Date.now()) return { kind: 'invalid' } as const;

      // Conditional update: if a concurrent request rotated this token first, we lose the race
      // and treat the second use as reuse.
      const revoked = await tx
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(schema.refreshTokens.id, current.id), isNull(schema.refreshTokens.revokedAt)))
        .returning({ id: schema.refreshTokens.id });
      if (revoked.length === 0) return { kind: 'reused', familyId: current.familyId } as const;

      const user = await tx.query.users.findFirst({ where: eq(schema.users.id, current.userId) });
      if (!user) return { kind: 'invalid' } as const;

      const next = generateToken();
      await tx
        .insert(schema.refreshTokens)
        .values(this.tokenRow(user.id, current.familyId, next, client));
      return { kind: 'rotated', user, refreshToken: next } as const;
    });

    if (result.kind === 'reused') {
      await this.revokeFamily(result.familyId);
      throw invalidRefreshToken();
    }
    if (result.kind === 'invalid') throw invalidRefreshToken();

    return {
      user: result.user,
      refreshToken: result.refreshToken,
      accessToken: await this.ctx.accessTokens.sign({ userId: result.user.id }),
    };
  }

  /** Ends the session that owns this refresh token (its whole family). */
  async logout(refreshToken: string): Promise<void> {
    const token = await this.ctx.db.query.refreshTokens.findFirst({
      where: eq(schema.refreshTokens.tokenHash, hashToken(refreshToken)),
    });
    if (token) await this.revokeFamily(token.familyId);
  }

  async getUser(userId: string): Promise<UserRow | undefined> {
    return this.ctx.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  }

  private async createSession(user: UserRow, client: ClientInfo): Promise<Session> {
    const refreshToken = generateToken();
    await this.ctx.db
      .insert(schema.refreshTokens)
      .values(this.tokenRow(user.id, randomUUID(), refreshToken, client));
    return {
      user,
      refreshToken,
      accessToken: await this.ctx.accessTokens.sign({ userId: user.id }),
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.ctx.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(schema.refreshTokens.familyId, familyId), isNull(schema.refreshTokens.revokedAt)),
      );
  }

  private tokenRow(userId: string, familyId: string, token: string, client: ClientInfo) {
    const ttlMs = this.ctx.config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    return {
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
      userAgent: client.userAgent?.slice(0, 512) ?? null,
      ip: client.ip,
    };
  }
}
