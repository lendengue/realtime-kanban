import { getCardDescription, updateCard, type CardView } from '@realtime-kanban/board-doc';
import { lazy, Suspense, useEffect, useMemo, type FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isEditableTarget } from '@/lib/utils';

import { InlineEdit } from './inline-edit';
import { local } from './origin';
import { uniqueUsers, usePeers } from './presence';
import { UserAvatar } from './presence-avatars';

interface CardDialogProps {
  doc: Y.Doc;
  card: CardView;
  columnTitle: string;
  awareness: Awareness;
  readOnly: boolean;
  onClose: () => void;
}

// The rich text editor (TipTap/ProseMirror) is most of the bundle: load it with the first card.
const DescriptionEditor = lazy(() =>
  import('./description-editor').then((module) => ({ default: module.DescriptionEditor })),
);

function useDescription(doc: Y.Doc, cardId: string): Y.XmlFragment | null {
  return useMemo(() => {
    try {
      return getCardDescription(doc, cardId);
    } catch {
      // Not upgraded yet (the server upgrades documents when it loads them).
      return null;
    }
  }, [doc, cardId]);
}

/**
 * Card details: editable title and the collaborative description. While open, this user's
 * presence says which card they are viewing, and editing while a field has focus.
 */
export function CardDialog({
  doc,
  card,
  columnTitle,
  awareness,
  readOnly,
  onClose,
}: CardDialogProps) {
  const { t } = useTranslation();
  const fragment = useDescription(doc, card.id);
  const others = usePeers(awareness, (peers) =>
    uniqueUsers(peers.filter((peer) => peer.viewingCardId === card.id)),
  );

  useEffect(() => {
    awareness.setLocalStateField('viewingCardId', card.id);
    return () => {
      awareness.setLocalStateField('viewingCardId', null);
      awareness.setLocalStateField('editingCardId', null);
    };
  }, [awareness, card.id]);

  const setEditing = (editing: boolean) =>
    awareness.setLocalStateField('editingCardId', editing && !readOnly ? card.id : null);
  const onFocus = (event: FocusEvent) => {
    if (isEditableTarget(event.target)) setEditing(true);
  };
  const onBlur = (event: FocusEvent) => {
    if (!isEditableTarget(event.relatedTarget)) setEditing(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="gap-5 sm:max-w-2xl"
        data-testid="card-dialog"
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl leading-normal">
            <InlineEdit
              value={card.title}
              label={t('board.cardDialog.title')}
              disabled={readOnly}
              className="whitespace-normal"
              onSave={(title) => updateCard(doc, card.id, { title }, local)}
            />
          </DialogTitle>
          <DialogDescription>
            {t('board.cardDialog.inColumn', { column: columnTitle })}
          </DialogDescription>
        </DialogHeader>

        {others.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('board.presence.viewing')}</span>
            <ul className="flex -space-x-1.5">
              {others.map((user) => (
                <li key={user.id}>
                  <UserAvatar user={user} label={user.name} size="sm" />
                </li>
              ))}
            </ul>
          </div>
        )}

        <section className="grid gap-2">
          <h3 className="text-sm font-medium">{t('board.cardDialog.description')}</h3>
          {fragment ? (
            <Suspense fallback={<div className="min-h-32 rounded-md border" />}>
              <DescriptionEditor
                fragment={fragment}
                awareness={awareness}
                cardId={card.id}
                readOnly={readOnly}
              />
            </Suspense>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{card.description}</p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
