import { setBoardTitle } from '@realtime-kanban/board-doc';
import { getRouteApi, Link } from '@tanstack/react-router';
import { ChevronLeft, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LoadError, Loading, WorkspaceNotFound } from '@/components/page-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/use-session';
import { useWorkspaceBySlug } from '@/lib/use-workspace';

import { BoardCanvas } from '../board/board-canvas';
import { ConnectionBadge } from '../board/connection-badge';
import { InlineEdit } from '../board/inline-edit';
import { local } from '../board/origin';
import { useBoardConnection, type BoardConnection } from '../board/use-board-connection';
import { useBoardView } from '../board/use-board-view';

const routeApi = getRouteApi('/authed/w/$workspaceSlug/b/$boardId');

export function BoardPage() {
  const { workspaceSlug, boardId } = routeApi.useParams();
  const { workspace, isPending, isError, error, refetch } = useWorkspaceBySlug(workspaceSlug);
  const connection = useBoardConnection(boardId);

  if (isPending) return <Loading />;
  if (isError) return <LoadError error={error} onRetry={() => void refetch()} />;
  if (!workspace) return <WorkspaceNotFound />;
  if (!connection) return <Loading />;

  return <Board connection={connection} workspaceSlug={workspaceSlug} />;
}

function Board({
  connection,
  workspaceSlug,
}: {
  connection: BoardConnection;
  workspaceSlug: string;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const view = useBoardView(connection.doc);
  const userId = session.status === 'authenticated' ? session.user.id : '';
  const { readOnly, status, synced, doc } = connection;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label={t('common.back')}>
          <Link to="/w/$workspaceSlug" params={{ workspaceSlug }}>
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
          {synced ? (
            <InlineEdit
              value={view.title}
              label={t('board.renameBoard')}
              disabled={readOnly}
              onSave={(title) => setBoardTitle(doc, title, local)}
            />
          ) : (
            '…'
          )}
        </h1>
        <ConnectionBadge status={status} synced={synced} />
        {synced && readOnly && (
          <Badge variant="secondary">
            <Eye aria-hidden />
            {t('board.readOnly')}
          </Badge>
        )}
      </div>

      {status === 'forbidden' ? (
        <p className="text-destructive">{t('board.forbidden')}</p>
      ) : synced ? (
        <BoardCanvas doc={doc} view={view} userId={userId} readOnly={readOnly} />
      ) : (
        <Loading />
      )}
    </div>
  );
}
