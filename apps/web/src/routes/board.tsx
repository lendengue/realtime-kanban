import { setBoardTitle } from '@realtime-kanban/board-doc';
import type { User } from '@realtime-kanban/shared';
import { getRouteApi, Link } from '@tanstack/react-router';
import { ChevronLeft, Eye, Redo2, Undo2 } from 'lucide-react';
import { useMemo } from 'react';
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
import { toPresenceUser, type PresenceUser } from '../board/presence';
import { PresenceAvatars } from '../board/presence-avatars';
import { useBoardConnection, type BoardConnection } from '../board/use-board-connection';
import { useBoardView } from '../board/use-board-view';
import { useUndo } from '../board/use-undo';

const routeApi = getRouteApi('/authed/w/$workspaceSlug/b/$boardId');

export function BoardPage() {
  const session = useSession();
  // The board lives under the authenticated layout, so the user is always known here.
  if (session.status !== 'authenticated') return <Loading />;
  return <BoardRoute user={session.user} />;
}

function BoardRoute({ user }: { user: User }) {
  const { workspaceSlug, boardId } = routeApi.useParams();
  const { workspace, isPending, isError, error, refetch } = useWorkspaceBySlug(workspaceSlug);
  const self = useMemo(() => toPresenceUser(user), [user]);
  const connection = useBoardConnection(boardId, self);

  // With the cached workspace list (offline-first), the board also opens without a network.
  if (isPending) return <Loading />;
  if (isError && !workspace) return <LoadError error={error} onRetry={() => void refetch()} />;
  if (!workspace) return <WorkspaceNotFound />;
  if (!connection) return <Loading />;

  return <Board connection={connection} workspaceSlug={workspaceSlug} self={self} />;
}

function Board({
  connection,
  workspaceSlug,
  self,
}: {
  connection: BoardConnection;
  workspaceSlug: string;
  self: PresenceUser;
}) {
  const { t } = useTranslation();
  const { readOnly, status, ready, doc, awareness, undoManager } = connection;
  const view = useBoardView(doc);
  const { canUndo, canRedo, undo, redo } = useUndo(undoManager, ready && !readOnly);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label={t('common.back')}>
          <Link to="/w/$workspaceSlug" params={{ workspaceSlug }}>
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
          {ready ? (
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
        <ConnectionBadge status={status} />
        {ready && readOnly && status !== 'forbidden' && (
          <Badge variant="secondary">
            <Eye aria-hidden />
            {t('board.readOnly')}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-3">
          {!readOnly && (
            <div className="flex">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('board.undo')}
                title={`${t('board.undo')} (Ctrl+Z)`}
                disabled={!canUndo}
                onClick={undo}
              >
                <Undo2 />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('board.redo')}
                title={`${t('board.redo')} (Ctrl+Shift+Z)`}
                disabled={!canRedo}
                onClick={redo}
              >
                <Redo2 />
              </Button>
            </div>
          )}
          <PresenceAvatars awareness={awareness} self={self} />
        </div>
      </div>

      {status === 'forbidden' ? (
        <p className="text-destructive">{t('board.forbidden')}</p>
      ) : ready ? (
        <BoardCanvas
          doc={doc}
          view={view}
          userId={self.id}
          readOnly={readOnly}
          awareness={awareness}
        />
      ) : (
        <Loading />
      )}
    </div>
  );
}
