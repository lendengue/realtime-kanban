import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common.js';

export const boardTitleSchema = z.string().trim().min(1).max(120);

export const boardSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  title: z.string(),
  createdBy: idSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  archivedAt: isoDateTimeSchema.nullable(),
});
export type Board = z.infer<typeof boardSchema>;

export const listBoardsQuerySchema = z.object({
  archived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export const createBoardBodySchema = z.object({ title: boardTitleSchema });
export type CreateBoardBody = z.infer<typeof createBoardBodySchema>;

export const updateBoardBodySchema = z.object({ title: boardTitleSchema });
export type UpdateBoardBody = z.infer<typeof updateBoardBodySchema>;

export const boardResponseSchema = z.object({ board: boardSchema });
export const boardListResponseSchema = z.object({ boards: z.array(boardSchema) });
