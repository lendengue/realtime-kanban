import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardView } from '@realtime-kanban/board-doc';
import { Archive, CheckSquare, PencilLine, Text } from 'lucide-react';
import { memo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { cardDragId } from './dnd';
import type { PresenceUser } from './presence';

interface CardItemProps {
  card: CardView;
  readOnly: boolean;
  /** Other users with this card open and a field focused. */
  editors: PresenceUser[];
  onOpen: (cardId: string) => void;
  onArchive: (cardId: string) => void;
}

export const CardItem = memo(function CardItem({
  card,
  readOnly,
  editors,
  onOpen,
  onArchive,
}: CardItemProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDragId(card.id),
    disabled: readOnly,
  });
  const done = card.checklist.filter((item) => item.done).length;
  const editor = editors[0];

  // Space picks the card up (keyboard drag); Enter opens it.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !isDragging) {
      event.preventDefault();
      onOpen(card.id);
      return;
    }
    if (!readOnly) (listeners?.onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
  };

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(editor && { boxShadow: `0 0 0 2px ${editor.color}` }),
      }}
      className={cn(
        'group relative rounded-md border bg-card p-3 text-sm shadow-xs',
        isDragging && 'opacity-50',
      )}
      data-testid="card"
    >
      <div
        {...(!readOnly && attributes)}
        {...(!readOnly && listeners)}
        role="button"
        tabIndex={0}
        aria-roledescription={readOnly ? undefined : t('board.draggableCard')}
        aria-label={card.title}
        onKeyDown={onKeyDown}
        onClick={() => onOpen(card.id)}
        className={cn(
          'cursor-pointer rounded break-words focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          !readOnly && 'active:cursor-grabbing',
        )}
      >
        {card.title}
      </div>
      {(card.checklist.length > 0 || card.description) && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {card.description && <Text className="size-3" aria-hidden />}
          {card.checklist.length > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="size-3" aria-hidden />
              {done}/{card.checklist.length}
            </span>
          )}
        </div>
      )}
      {editor && (
        <p
          className="mt-2 flex items-center gap-1 text-xs font-medium"
          style={{ color: editor.color }}
          data-testid="card-editing"
        >
          <PencilLine className="size-3" aria-hidden />
          {editors.length > 1
            ? t('board.presence.editingMany', { count: editors.length })
            : t('board.presence.editing', { name: editor.name })}
        </p>
      )}
      {!readOnly && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-7 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          aria-label={`${t('board.archiveCard')}: ${card.title}`}
          onClick={() => onArchive(card.id)}
        >
          <Archive />
        </Button>
      )}
    </li>
  );
});
