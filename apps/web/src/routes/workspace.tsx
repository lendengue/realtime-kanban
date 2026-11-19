import { can } from '@realtime-kanban/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Archive, ArchiveRestore, LayoutDashboard, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InlineCreateForm } from '@/components/inline-create-form';
import { LoadError, Loading, WorkspaceNotFound } from '@/components/page-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { boardsQuery } from '@/lib/queries';
import { useErrorMessage } from '@/lib/use-error-message';
import { useWorkspaceBySlug } from '@/lib/use-workspace';

const routeApi = getRouteApi('/authed/w/$workspaceSlug/');

export function WorkspacePage() {
  const { t } = useTranslation();
  const { workspaceSlug } = routeApi.useParams();
  const { workspace, isPending, isError, error, refetch } = useWorkspaceBySlug(workspaceSlug);

  if (isPending) return <Loading />;
  if (isError) return <LoadError error={error} onRetry={() => void refetch()} />;
  if (!workspace) return <WorkspaceNotFound />;

  const canManageBoards = can(workspace.role, 'boards:manage');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
          <Badge variant="secondary">{t(`roles.${workspace.role}`)}</Badge>
        </div>
        <Button asChild variant="outline">
          <Link to="/w/$workspaceSlug/members" params={{ workspaceSlug }}>
            <Users />
            {t('workspaces.members')}
          </Link>
        </Button>
      </div>

      <BoardList
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
        canManage={canManageBoards}
      />

      {!canManageBoards && <p className="text-sm text-muted-foreground">{t('boards.readOnly')}</p>}
    </div>
  );
}

function BoardList({
  workspaceId,
  workspaceSlug,
  canManage,
}: {
  workspaceId: string;
  workspaceSlug: string;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage('members');
  const [showArchived, setShowArchived] = useState(false);
  const boards = useQuery(boardsQuery(workspaceId, showArchived));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'boards'] });

  const create = useMutation({
    mutationFn: (title: string) => api.boards.create(workspaceId, title),
    onSuccess: invalidate,
  });
  const toggleArchive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? api.boards.restore(id) : api.boards.archive(id),
    onSuccess: invalidate,
  });

  return (
    <section className="flex flex-col gap-4" aria-labelledby="boards-heading">
      <div className="flex items-center justify-between">
        <h2 id="boards-heading" className="text-lg font-medium">
          {t('workspaces.boards')}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((value) => !value)}>
          {showArchived ? t('boards.showActive') : t('boards.showArchived')}
        </Button>
      </div>

      {boards.isPending && <Loading />}
      {boards.isError && <LoadError error={boards.error} onRetry={() => void boards.refetch()} />}
      {boards.data?.length === 0 && (
        <p className="text-muted-foreground">
          {showArchived ? t('boards.emptyArchived') : t('boards.empty')}
        </p>
      )}

      {boards.data && boards.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.data.map((board) => (
            <li key={board.id} className="flex items-center gap-2 rounded-lg border bg-card p-3">
              {showArchived ? (
                <span className="flex-1 truncate font-medium text-muted-foreground">
                  {board.title}
                </span>
              ) : (
                <Link
                  to="/w/$workspaceSlug/b/$boardId"
                  params={{ workspaceSlug, boardId: board.id }}
                  className="flex flex-1 items-center gap-2 truncate rounded font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <LayoutDashboard className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {board.title}
                </Link>
              )}
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${showArchived ? t('boards.restore') : t('boards.archive')}: ${board.title}`}
                  disabled={toggleArchive.isPending}
                  onClick={() => toggleArchive.mutate({ id: board.id, archived: showArchived })}
                >
                  {showArchived ? <ArchiveRestore /> : <Archive />}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && !showArchived && (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>
              <h3>{t('boards.createTitle')}</h3>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InlineCreateForm
              label={t('boards.titlePlaceholder')}
              placeholder={t('boards.titlePlaceholder')}
              pending={create.isPending}
              error={create.error ? errorMessage(create.error) : null}
              onCreate={(title) => create.mutateAsync(title)}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
