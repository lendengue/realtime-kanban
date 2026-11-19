import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { LoadError, Loading, WorkspaceNotFound } from '@/components/page-state';
import { boardsQuery } from '@/lib/queries';
import { useWorkspaceBySlug } from '@/lib/use-workspace';

const routeApi = getRouteApi('/authed/w/$workspaceSlug/b/$boardId');

/** Placeholder until the collaborative board lands in phase 2. */
export function BoardPage() {
  const { t } = useTranslation();
  const { workspaceSlug, boardId } = routeApi.useParams();
  const { workspace, isPending, isError, error, refetch } = useWorkspaceBySlug(workspaceSlug);
  const boards = useQuery({ ...boardsQuery(workspace?.id ?? ''), enabled: Boolean(workspace) });

  if (isPending) return <Loading />;
  if (isError) return <LoadError error={error} onRetry={() => void refetch()} />;
  if (!workspace) return <WorkspaceNotFound />;

  const board = boards.data?.find((candidate) => candidate.id === boardId);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{board?.title ?? '…'}</h1>
      <p className="text-muted-foreground">{t('boards.placeholder')}</p>
    </div>
  );
}
