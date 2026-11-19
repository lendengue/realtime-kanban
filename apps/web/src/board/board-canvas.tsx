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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type * as Y from 'yjs';

import { InlineCreateForm } from '@/components/inline-create-form';

import { ColumnItem } from './column-item';
import { columnDragId, parseDragId, resolveCardDrop, resolveColumnDrop } from './dnd';
import { local } from './origin';

interface BoardCanvasProps {
  doc: Y.Doc;
  view: BoardView;
  userId: string;
  readOnly: boolean;
}

/** Columns only collide with columns; cards collide with cards and columns. */
const collisionDetection: CollisionDetection = (args) => {
  const activeKind = parseDragId(args.active.id)?.kind;
  const droppableContainers = args.droppableContainers.filter(
    (container) => activeKind === 'card' || parseDragId(container.id)?.kind === 'column',
  );
  return closestCorners({ ...args, droppableContainers });
};

export function BoardCanvas({ doc, view, userId, readOnly }: BoardCanvasProps) {
  const { t } = useTranslation();
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (dragId: string | number) => {
    const parsed = parseDragId(dragId);
    if (!parsed) return '';
    if (parsed.kind === 'column') return view.columns.find((c) => c.id === parsed.id)?.title ?? '';
    return view.columns.flatMap((c) => c.cards).find((card) => card.id === parsed.id)?.title ?? '';
  };

  const onDragStart = ({ active }: DragStartEvent) => setActiveTitle(titleOf(active.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTitle(null);
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
      onDragCancel={() => setActiveTitle(null)}
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
      <div className="flex h-full items-start gap-4 overflow-x-auto pb-4">
        <SortableContext
          items={view.columns.map((column) => columnDragId(column.id))}
          strategy={horizontalListSortingStrategy}
        >
          {view.columns.map((column) => (
            <ColumnItem
              key={column.id}
              column={column}
              readOnly={readOnly}
              onRename={(columnId, title) => renameColumn(doc, columnId, title, local)}
              onArchive={(columnId) => deleteColumn(doc, columnId, local)}
              onAddCard={(columnId, title) =>
                createCard(doc, { columnId, title, createdBy: userId }, local)
              }
              onArchiveCard={(cardId) => archiveCard(doc, cardId, local)}
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

      <DragOverlay>
        {activeTitle && (
          <div className="w-64 rounded-md border bg-card p-3 text-sm shadow-lg">{activeTitle}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
