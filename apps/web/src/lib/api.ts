import {
  acceptInvitationResponseSchema,
  authResponseSchema,
  boardListResponseSchema,
  boardResponseSchema,
  invitationSchema,
  memberListResponseSchema,
  memberSchema,
  workspaceListResponseSchema,
  workspaceSchema,
  type AssignableRole,
  type CreateInvitationBody,
  type LoginBody,
  type RegisterBody,
} from '@realtime-kanban/shared';
import { z } from 'zod';

import { apiRequest } from './api-client';

const workspaceResponse = z.object({ workspace: workspaceSchema });

export const api = {
  auth: {
    login: (body: LoginBody) =>
      apiRequest('/auth/login', {
        method: 'POST',
        body,
        schema: authResponseSchema,
        retryOnUnauthorized: false,
      }),
    register: (body: RegisterBody) =>
      apiRequest('/auth/register', {
        method: 'POST',
        body,
        schema: authResponseSchema,
        retryOnUnauthorized: false,
      }),
    logout: () => apiRequest('/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
  },
  workspaces: {
    list: async () =>
      (await apiRequest('/workspaces', { schema: workspaceListResponseSchema })).workspaces,
    create: async (name: string) =>
      (
        await apiRequest('/workspaces', {
          method: 'POST',
          body: { name },
          schema: workspaceResponse,
        })
      ).workspace,
    members: async (workspaceId: string) =>
      (await apiRequest(`/workspaces/${workspaceId}/members`, { schema: memberListResponseSchema }))
        .members,
    updateMember: async (workspaceId: string, userId: string, role: AssignableRole) =>
      (
        await apiRequest(`/workspaces/${workspaceId}/members/${userId}`, {
          method: 'PATCH',
          body: { role },
          schema: z.object({ member: memberSchema }),
        })
      ).member,
    removeMember: (workspaceId: string, userId: string) =>
      apiRequest(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
    invite: async (workspaceId: string, body: CreateInvitationBody) =>
      (
        await apiRequest(`/workspaces/${workspaceId}/invitations`, {
          method: 'POST',
          body,
          schema: z.object({ invitation: invitationSchema }),
        })
      ).invitation,
    acceptInvitation: async (token: string) =>
      (
        await apiRequest(`/invitations/${encodeURIComponent(token)}/accept`, {
          method: 'POST',
          schema: acceptInvitationResponseSchema,
        })
      ).workspace,
  },
  boards: {
    list: async (workspaceId: string, archived = false) =>
      (
        await apiRequest(`/workspaces/${workspaceId}/boards?archived=${archived}`, {
          schema: boardListResponseSchema,
        })
      ).boards,
    create: async (workspaceId: string, title: string) =>
      (
        await apiRequest(`/workspaces/${workspaceId}/boards`, {
          method: 'POST',
          body: { title },
          schema: boardResponseSchema,
        })
      ).board,
    archive: async (boardId: string) =>
      (
        await apiRequest(`/boards/${boardId}/archive`, {
          method: 'POST',
          schema: boardResponseSchema,
        })
      ).board,
    restore: async (boardId: string) =>
      (
        await apiRequest(`/boards/${boardId}/restore`, {
          method: 'POST',
          schema: boardResponseSchema,
        })
      ).board,
  },
};
