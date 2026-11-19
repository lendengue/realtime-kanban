import { useQuery } from '@tanstack/react-query';

import { workspacesQuery } from './queries';

/** Resolves a workspace from the cached list by its URL slug. */
export function useWorkspaceBySlug(slug: string) {
  const query = useQuery(workspacesQuery());
  return { ...query, workspace: query.data?.find((workspace) => workspace.slug === slug) };
}
