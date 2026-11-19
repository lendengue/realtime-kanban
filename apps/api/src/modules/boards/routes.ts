import { createInitialBoardState } from '@realtime-kanban/board-doc';
import { schema } from '@realtime-kanban/db';
import {
  boardListResponseSchema,
  boardResponseSchema,
  createBoardBodySchema,
  errorResponseSchema,
  idSchema,
  listBoardsQuerySchema,
  updateBoardBodySchema,
  type Permission,
} from '@realtime-kanban/shared';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { AppContext } from '../../context.js';
import { createAuthenticate, requireUserId } from '../../lib/authenticate.js';
import { notFound } from '../../lib/errors.js';
import { toBoard } from '../../lib/mappers.js';
import { requireWorkspacePermission } from '../workspaces/access.js';

const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
};

export function boardRoutes(ctx: AppContext): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    const { db } = ctx;
    app.addHook('preHandler', createAuthenticate(ctx.accessTokens));

    const common = { tags: ['boards'], security: [{ bearerAuth: [] }] };

    /** Loads a board and checks the user's permission in its workspace. */
    const requireBoard = async (boardId: string, userId: string, permission: Permission) => {
      const board = await db.query.boards.findFirst({ where: eq(schema.boards.id, boardId) });
      if (!board) throw notFound('Board');
      try {
        await requireWorkspacePermission(db, board.workspaceId, userId, permission);
      } catch (error) {
        // Do not reveal that the board exists to non-members.
        if (error instanceof Error && 'statusCode' in error && error.statusCode === 404) {
          throw notFound('Board');
        }
        throw error;
      }
      return board;
    };

    const updateBoard = async (
      boardId: string,
      values: Partial<typeof schema.boards.$inferInsert>,
    ) => {
      const [updated] = await db
        .update(schema.boards)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(schema.boards.id, boardId))
        .returning();
      if (!updated) throw notFound('Board');
      return { board: toBoard(updated) };
    };

    app.get(
      '/workspaces/:id/boards',
      {
        schema: {
          ...common,
          summary: 'List boards of a workspace',
          params: z.object({ id: idSchema }),
          querystring: listBoardsQuerySchema,
          response: { 200: boardListResponseSchema, ...errors },
        },
      },
      async (request) => {
        const { id } = request.params;
        await requireWorkspacePermission(db, id, requireUserId(request), 'workspace:view');
        const rows = await db
          .select()
          .from(schema.boards)
          .where(
            and(
              eq(schema.boards.workspaceId, id),
              request.query.archived
                ? isNotNull(schema.boards.archivedAt)
                : isNull(schema.boards.archivedAt),
            ),
          )
          .orderBy(asc(schema.boards.createdAt));
        return { boards: rows.map(toBoard) };
      },
    );

    app.post(
      '/workspaces/:id/boards',
      {
        schema: {
          ...common,
          summary: 'Create a board (owner, admin, member)',
          params: z.object({ id: idSchema }),
          body: createBoardBodySchema,
          response: { 201: boardResponseSchema, ...errors },
        },
      },
      async (request, reply) => {
        const userId = requireUserId(request);
        await requireWorkspacePermission(db, request.params.id, userId, 'boards:manage');
        // The board row and its initial Yjs document (default columns) are created together.
        const board = await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(schema.boards)
            .values({
              workspaceId: request.params.id,
              title: request.body.title,
              createdBy: userId,
            })
            .returning();
          if (!created) throw new Error('Board insert returned no row');
          await tx
            .insert(schema.boardDocuments)
            .values({ boardId: created.id, state: createInitialBoardState(created.title) });
          return created;
        });
        return reply.status(201).send({ board: toBoard(board) });
      },
    );

    const boardParams = z.object({ id: idSchema });

    app.patch(
      '/boards/:id',
      {
        schema: {
          ...common,
          summary: 'Rename a board (owner, admin, member)',
          params: boardParams,
          body: updateBoardBodySchema,
          response: { 200: boardResponseSchema, ...errors },
        },
      },
      async (request) => {
        await requireBoard(request.params.id, requireUserId(request), 'boards:manage');
        return updateBoard(request.params.id, { title: request.body.title });
      },
    );

    app.post(
      '/boards/:id/archive',
      {
        schema: {
          ...common,
          summary: 'Archive a board (owner, admin, member)',
          params: boardParams,
          response: { 200: boardResponseSchema, ...errors },
        },
      },
      async (request) => {
        const board = await requireBoard(
          request.params.id,
          requireUserId(request),
          'boards:manage',
        );
        return updateBoard(board.id, { archivedAt: board.archivedAt ?? new Date() });
      },
    );

    app.post(
      '/boards/:id/restore',
      {
        schema: {
          ...common,
          summary: 'Restore an archived board (owner, admin, member)',
          params: boardParams,
          response: { 200: boardResponseSchema, ...errors },
        },
      },
      async (request) => {
        await requireBoard(request.params.id, requireUserId(request), 'boards:manage');
        return updateBoard(request.params.id, { archivedAt: null });
      },
    );
    done();
  };
}
