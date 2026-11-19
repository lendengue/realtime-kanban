import { z } from 'zod';

import { ASSIGNABLE_ROLES, WORKSPACE_ROLES } from '../roles.js';
import { emailSchema } from './auth.js';
import { idSchema, isoDateTimeSchema } from './common.js';

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);
export const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);

export const workspaceNameSchema = z.string().trim().min(1).max(80);

export const workspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  ownerId: idSchema,
  createdAt: isoDateTimeSchema,
  /** Role of the requesting user in this workspace. */
  role: workspaceRoleSchema,
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const createWorkspaceBodySchema = z.object({ name: workspaceNameSchema });
export type CreateWorkspaceBody = z.infer<typeof createWorkspaceBodySchema>;

export const updateWorkspaceBodySchema = z.object({ name: workspaceNameSchema });
export type UpdateWorkspaceBody = z.infer<typeof updateWorkspaceBodySchema>;

export const workspaceListResponseSchema = z.object({ workspaces: z.array(workspaceSchema) });

export const memberSchema = z.object({
  userId: idSchema,
  email: z.email(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role: workspaceRoleSchema,
  joinedAt: isoDateTimeSchema,
});
export type Member = z.infer<typeof memberSchema>;

export const memberListResponseSchema = z.object({ members: z.array(memberSchema) });

export const updateMemberBodySchema = z.object({ role: assignableRoleSchema });
export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>;

export const createInvitationBodySchema = z.object({
  email: emailSchema,
  role: assignableRoleSchema,
});
export type CreateInvitationBody = z.infer<typeof createInvitationBodySchema>;

export const invitationSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  email: z.email(),
  role: assignableRoleSchema,
  expiresAt: isoDateTimeSchema,
});
export type Invitation = z.infer<typeof invitationSchema>;

export const acceptInvitationResponseSchema = z.object({ workspace: workspaceSchema });
