import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardView } from '@realtime-kanban/board-doc';
import { Archive, CheckSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { cardDragId } from './dnd';

interface CardItemProps {
  card: CardView;
  readOnly: boolean;
  onArchive: (cardId: string) => void;
}

export function CardItem({ card, readOnly, onArchive }: CardItemProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDragId(card.id),
    disabled: readOnly,
  });
  const done = card.checklist.filter((item) => item.done).length;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative rounded-md border bg-card p-3 text-sm shadow-xs',
        isDragging && 'opacity-50',
      )}
      data-testid="card"
    >
      <div
        {...attributes}
        {...listeners}
        aria-roledescription={t('board.draggableCard')}
        aria-label={card.title}
        className={cn(
          'rounded break-words focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          !readOnly && 'cursor-grab active:cursor-grabbing',
        )}
      >
        {card.title}
      </div>
      {card.checklist.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <CheckSquare className="size-3" aria-hidden />
          {done}/{card.checklist.length}
        </div>
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
}
