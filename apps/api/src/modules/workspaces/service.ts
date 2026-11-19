import { schema } from '@realtime-kanban/db';
import type {
  AssignableRole,
  CreateInvitationBody,
  Invitation,
  Member,
  Workspace,
} from '@realtime-kanban/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import type { AppContext } from '../../context.js';
import { generateToken, hashToken } from '../../lib/crypto.js';
import { AppError, forbidden, notFound } from '../../lib/errors.js';
import { toMember, toWorkspace } from '../../lib/mappers.js';
import { slugify, withRandomSuffix } from '../../lib/slug.js';
import { requireWorkspacePermission } from './access.js';

const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean => {
  const cause = error instanceof Error && 'cause' in error ? error.cause : error;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === UNIQUE_VIOLATION
  );
};

export interface InvitationResult {
  invitation: Invitation;
  acceptUrl: string;
}

export class WorkspaceService {
  constructor(private readonly ctx: AppContext) {}

  async list(userId: string): Promise<Workspace[]> {
    const rows = await this.ctx.db
      .select({ workspace: schema.workspaces, role: schema.workspaceMembers.role })
      .from(schema.workspaceMembers)
      .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMembers.workspaceId))
      .where(eq(schema.workspaceMembers.userId, userId))
      .orderBy(asc(schema.workspaces.name));
    return rows.map(({ workspace, role }) => toWorkspace(workspace, role));
  }

  async create(userId: string, name: string): Promise<Workspace> {
    const base = slugify(name);
    // First try the plain slug, then a few random suffixes if it is taken.
    for (const slug of [base, withRandomSuffix(base), withRandomSuffix(base)]) {
      try {
        const workspace = await this.ctx.db.transaction(async (tx) => {
          const [created] = await tx
            .insert(schema.workspaces)
            .values({ name, slug, ownerId: userId })
            .returning();
          if (!created) throw new Error('Workspace insert returned no row');
          await tx
            .insert(schema.workspaceMembers)
            .values({ workspaceId: created.id, userId, role: 'owner' });
          return created;
        });
        return toWorkspace(workspace, 'owner');
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new AppError(409, 'CONFLICT', 'Could not generate a unique workspace slug');
  }

  async get(userId: string, workspaceId: string): Promise<Workspace> {
    const { workspace, role } = await requireWorkspacePermission(
      this.ctx.db,
      workspaceId,
      userId,
      'workspace:view',
    );
    return toWorkspace(workspace, role);
  }

  async rename(userId: string, workspaceId: string, name: string): Promise<Workspace> {
    const { role } = await requireWorkspacePermission(
      this.ctx.db,
      workspaceId,
      userId,
      'workspace:rename',
    );
    const [updated] = await this.ctx.db
      .update(schema.workspaces)
      .set({ name })
      .where(eq(schema.workspaces.id, workspaceId))
      .returning();
    if (!updated) throw notFound('Workspace');
    return toWorkspace(updated, role);
  }

  async delete(userId: string, workspaceId: string): Promise<void> {
    await requireWorkspacePermission(this.ctx.db, workspaceId, userId, 'workspace:delete');
    await this.ctx.db.delete(schema.workspaces).where(eq(schema.workspaces.id, workspaceId));
  }

  async listMembers(userId: string, workspaceId: string): Promise<Member[]> {
    await requireWorkspacePermission(this.ctx.db, workspaceId, userId, 'workspace:view');
    const rows = await this.ctx.db
      .select({ user: schema.users, membership: schema.workspaceMembers })
      .from(schema.workspaceMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId))
      .where(eq(schema.workspaceMembers.workspaceId, workspaceId))
      .orderBy(asc(schema.workspaceMembers.joinedAt));
    return rows.map(({ user, membership }) => toMember(user, membership));
  }

  async updateMemberRole(
    userId: string,
    workspaceId: string,
    targetUserId: string,
    role: AssignableRole,
  ): Promise<Member> {
    await requireWorkspacePermission(this.ctx.db, workspaceId, userId, 'members:manage');
    const target = await this.findMembership(workspaceId, targetUserId);
    if (target.membership.role === 'owner') {
      throw forbidden('The workspace owner role cannot be changed');
    }
    const [updated] = await this.ctx.db
      .update(schema.workspaceMembers)
      .set({ role })
      .where(this.membershipWhere(workspaceId, targetUserId))
      .returning();
    if (!updated) throw notFound('Member');
    return toMember(target.user, updated);
  }

  /** Managers can remove others; any member can remove themselves (leave). The owner cannot be removed. */
  async removeMember(userId: string, workspaceId: string, targetUserId: string): Promise<void> {
    const isSelf = userId === targetUserId;
    await requireWorkspacePermission(
      this.ctx.db,
      workspaceId,
      userId,
      isSelf ? 'workspace:view' : 'members:manage',
    );
    const target = await this.findMembership(workspaceId, targetUserId);
    if (target.membership.role === 'owner') {
      throw forbidden('The workspace owner cannot be removed');
    }
    await this.ctx.db
      .delete(schema.workspaceMembers)
      .where(this.membershipWhere(workspaceId, targetUserId));
  }

  async invite(
    userId: string,
    workspaceId: string,
    body: CreateInvitationBody,
  ): Promise<InvitationResult> {
    const { workspace } = await requireWorkspacePermission(
      this.ctx.db,
      workspaceId,
      userId,
      'members:manage',
    );

    const [existingMember] = await this.ctx.db
      .select({ userId: schema.users.id })
      .from(schema.workspaceMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId))
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, workspaceId),
          eq(schema.users.email, body.email),
        ),
      )
      .limit(1);
    if (existingMember) {
      throw new AppError(409, 'ALREADY_MEMBER', 'This person is already a member of the workspace');
    }

    const token = generateToken();
    const ttlMs = this.ctx.config.INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;
    const [row] = await this.ctx.db
      .insert(schema.invitations)
      .values({
        workspaceId,
        email: body.email,
        role: body.role,
        tokenHash: hashToken(token),
        invitedBy: userId,
        expiresAt: new Date(Date.now() + ttlMs),
      })
      .returning();
    if (!row) throw new Error('Invitation insert returned no row');

    const acceptUrl = new URL(`/invite/${token}`, this.ctx.config.WEB_ORIGIN).toString();
    await this.ctx.mailer.send({
      to: body.email,
      subject: `You have been invited to ${workspace.name} on realtime-kanban`,
      text: `You have been invited to join "${workspace.name}" as ${body.role}.\n\nAccept the invitation: ${acceptUrl}\n\nThis link expires in ${this.ctx.config.INVITATION_TTL_DAYS} days.`,
    });

    return {
      acceptUrl,
      invitation: {
        id: row.id,
        workspaceId: row.workspaceId,
        email: row.email,
        role: body.role,
        expiresAt: row.expiresAt.toISOString(),
      },
    };
  }

  async acceptInvitation(userId: string, token: string): Promise<Workspace> {
    const { db } = this.ctx;
    const invalid = () =>
      new AppError(
        400,
        'INVITATION_INVALID',
        'This invitation is invalid, expired or already used',
      );

    const invitation = await db.query.invitations.findFirst({
      where: eq(schema.invitations.tokenHash, hashToken(token)),
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now()) {
      throw invalid();
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (user?.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AppError(
        403,
        'INVITATION_EMAIL_MISMATCH',
        'This invitation was sent to a different e-mail address',
      );
    }

    return db.transaction(async (tx) => {
      const claimed = await tx
        .update(schema.invitations)
        .set({ acceptedAt: new Date() })
        .where(and(eq(schema.invitations.id, invitation.id), isNull(schema.invitations.acceptedAt)))
        .returning({ id: schema.invitations.id });
      if (claimed.length === 0) throw invalid();

      const inserted = await tx
        .insert(schema.workspaceMembers)
        .values({ workspaceId: invitation.workspaceId, userId, role: invitation.role })
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) {
        throw new AppError(409, 'ALREADY_MEMBER', 'You are already a member of this workspace');
      }

      const workspace = await tx.query.workspaces.findFirst({
        where: eq(schema.workspaces.id, invitation.workspaceId),
      });
      if (!workspace) throw invalid();
      return toWorkspace(workspace, invitation.role);
    });
  }

  private membershipWhere(workspaceId: string, userId: string) {
    return and(
      eq(schema.workspaceMembers.workspaceId, workspaceId),
      eq(schema.workspaceMembers.userId, userId),
    );
  }

  private async findMembership(workspaceId: string, userId: string) {
    const [row] = await this.ctx.db
      .select({ user: schema.users, membership: schema.workspaceMembers })
      .from(schema.workspaceMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId))
      .where(this.membershipWhere(workspaceId, userId))
      .limit(1);
    if (!row) throw notFound('Member');
    return row;
  }
}
