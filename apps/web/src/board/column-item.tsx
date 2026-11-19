import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ColumnView } from '@realtime-kanban/board-doc';
import { Archive, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { AddCard } from './add-card';
import { CardItem } from './card-item';
import { cardDragId, columnDragId } from './dnd';
import { InlineEdit } from './inline-edit';

interface ColumnItemProps {
  column: ColumnView;
  readOnly: boolean;
  onRename: (columnId: string, title: string) => void;
  onArchive: (columnId: string) => void;
  onAddCard: (columnId: string, title: string) => void;
  onArchiveCard: (cardId: string) => void;
}

export function ColumnItem({
  column,
  readOnly,
  onRename,
  onArchive,
  onAddCard,
  onArchiveCard,
}: ColumnItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: columnDragId(column.id), disabled: readOnly });
  const overLimit = column.wipLimit !== null && column.cards.length > column.wipLimit;

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={column.title}
      data-testid="column"
      className={cn(
        'flex max-h-full w-72 shrink-0 flex-col gap-3 rounded-lg border bg-muted/60 p-3',
        overLimit && 'border-destructive bg-destructive/10',
        isDragging && 'opacity-50',
      )}
    >
      <header className="flex items-center gap-1">
        {!readOnly && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            aria-roledescription={t('board.draggableColumn')}
            aria-label={t('board.moveColumn', { column: column.title })}
            className="cursor-grab rounded p-0.5 text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
          <InlineEdit
            value={column.title}
            label={t('board.renameColumn')}
            disabled={readOnly}
            onSave={(title) => onRename(column.id, title)}
          />
          <span
            className={cn(
              'text-xs font-normal text-muted-foreground',
              overLimit && 'text-destructive',
            )}
          >
            {column.wipLimit === null
              ? column.cards.length
              : `${column.cards.length}/${column.wipLimit}`}
          </span>
        </h2>
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`${t('board.archiveColumn')}: ${column.title}`}
            onClick={() => onArchive(column.id)}
          >
            <Archive />
          </Button>
        )}
      </header>

      <SortableContext
        items={column.cards.map((card) => cardDragId(card.id))}
        strategy={verticalListSortingStrategy}
      >
        <ul
          className="flex min-h-8 flex-col gap-2 overflow-y-auto"
          aria-label={t('board.cardsIn', { column: column.title })}
        >
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} readOnly={readOnly} onArchive={onArchiveCard} />
          ))}
        </ul>
      </SortableContext>

      {!readOnly && (
        <AddCard columnTitle={column.title} onAdd={(title) => onAddCard(column.id, title)} />
      )}
    </section>
  );
}
