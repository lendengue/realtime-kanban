import { queryOptions } from '@tanstack/react-query';

import { api } from './api';

export const queryKeys = {
  workspaces: ['workspaces'] as const,
  members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  boards: (workspaceId: string, archived: boolean) =>
    ['workspaces', workspaceId, 'boards', { archived }] as const,
};

export const workspacesQuery = () =>
  queryOptions({ queryKey: queryKeys.workspaces, queryFn: api.workspaces.list });

export const membersQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: queryKeys.members(workspaceId),
    queryFn: () => api.workspaces.members(workspaceId),
  });

export const boardsQuery = (workspaceId: string, archived = false) =>
  queryOptions({
    queryKey: queryKeys.boards(workspaceId, archived),
    queryFn: () => api.boards.list(workspaceId, archived),
  });
