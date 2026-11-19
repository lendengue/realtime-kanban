import {
  acceptInvitationResponseSchema,
  createInvitationBodySchema,
  createWorkspaceBodySchema,
  errorResponseSchema,
  idSchema,
  invitationSchema,
  memberListResponseSchema,
  memberSchema,
  updateMemberBodySchema,
  updateWorkspaceBodySchema,
  workspaceListResponseSchema,
  workspaceSchema,
} from '@realtime-kanban/shared';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { AppContext } from '../../context.js';
import { createAuthenticate, requireUserId } from '../../lib/authenticate.js';
import { WorkspaceService } from './service.js';

const workspaceParams = z.object({ id: idSchema });
const memberParams = z.object({ id: idSchema, userId: idSchema });
const tokenParams = z.object({ token: z.string().min(16).max(128) });

const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

export function workspaceRoutes(ctx: AppContext): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    const workspaces = new WorkspaceService(ctx);
    app.addHook('preHandler', createAuthenticate(ctx.accessTokens));

    const common = { tags: ['workspaces'], security: [{ bearerAuth: [] }] };

    app.get(
      '/workspaces',
      {
        schema: {
          ...common,
          summary: 'List workspaces of the current user',
          response: { 200: workspaceListResponseSchema, ...errors },
        },
      },
      async (request) => ({ workspaces: await workspaces.list(requireUserId(request)) }),
    );

    app.post(
      '/workspaces',
      {
        schema: {
          ...common,
          summary: 'Create a workspace (the creator becomes its owner)',
          body: createWorkspaceBodySchema,
          response: { 201: z.object({ workspace: workspaceSchema }), ...errors },
        },
      },
      async (request, reply) => {
        const workspace = await workspaces.create(requireUserId(request), request.body.name);
        return reply.status(201).send({ workspace });
      },
    );

    app.get(
      '/workspaces/:id',
      {
        schema: {
          ...common,
          summary: 'Get a workspace',
          params: workspaceParams,
          response: { 200: z.object({ workspace: workspaceSchema }), ...errors },
        },
      },
      async (request) => ({
        workspace: await workspaces.get(requireUserId(request), request.params.id),
      }),
    );

    app.patch(
      '/workspaces/:id',
      {
        schema: {
          ...common,
          summary: 'Rename a workspace (owner, admin)',
          params: workspaceParams,
          body: updateWorkspaceBodySchema,
          response: { 200: z.object({ workspace: workspaceSchema }), ...errors },
        },
      },
      async (request) => ({
        workspace: await workspaces.rename(
          requireUserId(request),
          request.params.id,
          request.body.name,
        ),
      }),
    );

    app.delete(
      '/workspaces/:id',
      {
        schema: {
          ...common,
          summary: 'Delete a workspace (owner)',
          params: workspaceParams,
          response: { 204: z.null(), ...errors },
        },
      },
      async (request, reply) => {
        await workspaces.delete(requireUserId(request), request.params.id);
        return reply.status(204).send(null);
      },
    );

    app.get(
      '/workspaces/:id/members',
      {
        schema: {
          ...common,
          tags: ['members'],
          summary: 'List workspace members',
          params: workspaceParams,
          response: { 200: memberListResponseSchema, ...errors },
        },
      },
      async (request) => ({
        members: await workspaces.listMembers(requireUserId(request), request.params.id),
      }),
    );

    app.patch(
      '/workspaces/:id/members/:userId',
      {
        schema: {
          ...common,
          tags: ['members'],
          summary: "Change a member's role (owner, admin)",
          params: memberParams,
          body: updateMemberBodySchema,
          response: { 200: z.object({ member: memberSchema }), ...errors },
        },
      },
      async (request) => ({
        member: await workspaces.updateMemberRole(
          requireUserId(request),
          request.params.id,
          request.params.userId,
          request.body.role,
        ),
      }),
    );

    app.delete(
      '/workspaces/:id/members/:userId',
      {
        schema: {
          ...common,
          tags: ['members'],
          summary: 'Remove a member (owner, admin) or leave the workspace (self)',
          params: memberParams,
          response: { 204: z.null(), ...errors },
        },
      },
      async (request, reply) => {
        await workspaces.removeMember(
          requireUserId(request),
          request.params.id,
          request.params.userId,
        );
        return reply.status(204).send(null);
      },
    );

    app.post(
      '/workspaces/:id/invitations',
      {
        schema: {
          ...common,
          tags: ['invitations'],
          summary: 'Invite someone by e-mail (owner, admin)',
          params: workspaceParams,
          body: createInvitationBodySchema,
          response: { 201: z.object({ invitation: invitationSchema }), ...errors },
        },
      },
      async (request, reply) => {
        const { invitation, acceptUrl } = await workspaces.invite(
          requireUserId(request),
          request.params.id,
          request.body,
        );
        if (ctx.config.NODE_ENV !== 'production') {
          request.log.info({ email: invitation.email, acceptUrl }, 'invitation link (dev only)');
        }
        return reply.status(201).send({ invitation });
      },
    );

    app.post(
      '/invitations/:token/accept',
      {
        schema: {
          ...common,
          tags: ['invitations'],
          summary: 'Accept an invitation as the signed-in user',
          params: tokenParams,
          response: { 200: acceptInvitationResponseSchema, ...errors },
        },
      },
      async (request) => ({
        workspace: await workspaces.acceptInvitation(requireUserId(request), request.params.token),
      }),
    );
    done();
  };
}
