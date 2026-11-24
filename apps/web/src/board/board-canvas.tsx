import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  archiveCard,
  createCard,
  createColumn,
  deleteColumn,
  moveCard,
  moveColumn,
  renameColumn,
  type BoardView,
} from '@realtime-kanban/board-doc';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';

import { InlineCreateForm } from '@/components/inline-create-form';

import { CardDialog } from './card-dialog';
import { ColumnItem } from './column-item';
import { columnDragId, parseDragId, resolveCardDrop, resolveColumnDrop } from './dnd';
import { local } from './origin';
import { usePeers, type Peer, type PresenceUser } from './presence';
import { RemoteCursors } from './remote-cursors';
import { useBroadcastCursor } from './use-broadcast-cursor';

interface BoardCanvasProps {
  doc: Y.Doc;
  view: BoardView;
  userId: string;
  readOnly: boolean;
  awareness: Awareness;
}

/** Users editing each card (one entry per user, even with several tabs). */
function editorsByCard(peers: Peer[]): Record<string, PresenceUser[]> {
  const result: Record<string, PresenceUser[]> = {};
  for (const { editingCardId, user } of peers) {
    if (!editingCardId) continue;
    const editors = (result[editingCardId] ??= []);
    if (!editors.some((editor) => editor.id === user.id)) editors.push(user);
  }
  return result;
}

/** Space picks up and drops (Enter also drops); Enter on a card that is not dragged opens it. */
const keyboardCodes = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] };

/** Columns only collide with columns; cards collide with cards and columns. */
const collisionDetection: CollisionDetection = (args) => {
  const activeKind = parseDragId(args.active.id)?.kind;
  const droppableContainers = args.droppableContainers.filter(
    (container) => activeKind === 'card' || parseDragId(container.id)?.kind === 'column',
  );
  return closestCorners({ ...args, droppableContainers });
};

export function BoardCanvas({ doc, view, userId, readOnly, awareness }: BoardCanvasProps) {
  const { t } = useTranslation();
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const dragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editors = usePeers(awareness, editorsByCard);
  useBroadcastCursor(awareness, scrollRef);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes }),
  );

  // A pointer drag that ends where it started still fires a click: do not open the card then.
  const openCard = useCallback((cardId: string) => {
    if (!dragging.current) setOpenCardId(cardId);
  }, []);
  const archiveCardLocally = useCallback(
    (cardId: string) => archiveCard(doc, cardId, local),
    [doc],
  );
  const endDrag = () => {
    setActiveTitle(null);
    setTimeout(() => (dragging.current = false));
  };

  const openEntry = openCardId
    ? view.columns
        .flatMap((column) => column.cards.map((card) => ({ card, column })))
        .find(({ card }) => card.id === openCardId)
    : undefined;
  // The open card was archived, moved out of view or removed (e.g. by someone's undo).
  if (openCardId && !openEntry) setOpenCardId(null);

  const titleOf = (dragId: string | number) => {
    const parsed = parseDragId(dragId);
    if (!parsed) return '';
    if (parsed.kind === 'column') return view.columns.find((c) => c.id === parsed.id)?.title ?? '';
    return view.columns.flatMap((c) => c.cards).find((card) => card.id === parsed.id)?.title ?? '';
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    dragging.current = true;
    setActiveTitle(titleOf(active.id));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    endDrag();
    const dragged = parseDragId(active.id);
    if (!dragged || !over) return;
    if (dragged.kind === 'card') {
      const drop = resolveCardDrop(view, dragged.id, String(over.id));
      if (drop) moveCard(doc, drop.cardId, drop.toColumnId, drop.beforeId, drop.afterId, local);
    } else {
      const drop = resolveColumnDrop(view, dragged.id, String(over.id));
      if (drop) moveColumn(doc, drop.columnId, drop.beforeId, drop.afterId, local);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => t('board.announce.pickedUp', { item: titleOf(active.id) }),
          onDragOver: ({ active, over }) =>
            over
              ? t('board.announce.over', { item: titleOf(active.id), target: titleOf(over.id) })
              : undefined,
          onDragEnd: ({ active, over }) =>
            over
              ? t('board.announce.dropped', { item: titleOf(active.id), target: titleOf(over.id) })
              : t('board.announce.cancelled', { item: titleOf(active.id) }),
          onDragCancel: ({ active }) => t('board.announce.cancelled', { item: titleOf(active.id) }),
        },
        screenReaderInstructions: { draggable: t('board.announce.instructions') },
      }}
    >
      <div
        ref={scrollRef}
        className="relative flex h-full items-start gap-4 overflow-x-auto pb-4"
        data-testid="board-canvas"
      >
        <RemoteCursors awareness={awareness} />
        <SortableContext
          items={view.columns.map((column) => columnDragId(column.id))}
          strategy={horizontalListSortingStrategy}
        >
          {view.columns.map((column) => (
            <ColumnItem
              key={column.id}
              column={column}
              readOnly={readOnly}
              editorsByCard={editors}
              onOpenCard={openCard}
              onRename={(columnId, title) => renameColumn(doc, columnId, title, local)}
              onArchive={(columnId) => deleteColumn(doc, columnId, local)}
              onAddCard={(columnId, title) =>
                createCard(doc, { columnId, title, createdBy: userId }, local)
              }
              onArchiveCard={archiveCardLocally}
            />
          ))}
        </SortableContext>

        {!readOnly && (
          <div className="w-72 shrink-0 rounded-lg border border-dashed p-3">
            <InlineCreateForm
              label={t('board.addColumn')}
              placeholder={t('board.columnTitle')}
              pending={false}
              error={null}
              onCreate={(title) => {
                createColumn(doc, { title }, local);
                return Promise.resolve();
              }}
            />
          </div>
        )}
      </div>

      {openEntry && (
        <CardDialog
          doc={doc}
          card={openEntry.card}
          columnTitle={openEntry.column.title}
          awareness={awareness}
          readOnly={readOnly}
          onClose={() => setOpenCardId(null)}
        />
      )}

      <DragOverlay>
        {activeTitle && (
          <div className="w-64 rounded-md border bg-card p-3 text-sm shadow-lg">{activeTitle}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
