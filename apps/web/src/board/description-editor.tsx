import { Extension } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { yCursorPlugin } from '@tiptap/y-tiptap';
import { Bold, Italic, List, ListOrdered, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { readPeers } from './presence';

/**
 * The caret plugin reads and writes the awareness field `cursor`, which the board uses for the
 * pointer (spec 4.5); its `cursorStateField` option only changes where it writes. This adapter
 * shows it the `caret` field as `cursor`, and only for peers in the same card, whose positions
 * point into this card's fragment (ADR 0021). Only the members the plugin uses are mapped.
 */
function caretAwareness(awareness: Awareness, cardId: string): Awareness {
  const view = (state: Record<string, unknown> | null, local = false) =>
    state && {
      ...state,
      cursor: local || state.viewingCardId === cardId ? (state.caret ?? null) : null,
    };
  const adapter = {
    get clientID() {
      return awareness.clientID;
    },
    get doc() {
      return awareness.doc;
    },
    getStates: () => {
      const states = new Map<number, Record<string, unknown>>();
      awareness.getStates().forEach((state, clientId) => {
        const mapped = view(state);
        if (mapped) states.set(clientId, mapped);
      });
      return states;
    },
    getLocalState: () => view(awareness.getLocalState(), true),
    setLocalStateField: (field: string, value: unknown) =>
      awareness.setLocalStateField(field === 'cursor' ? 'caret' : field, value),
    on: (event: 'change', handler: () => void) => awareness.on(event, handler),
    off: (event: 'change', handler: () => void) => awareness.off(event, handler),
  };
  // The plugin is typed against the full Awareness class but only uses the members above.
  return adapter as unknown as Awareness;
}

/** Remote carets come from other clients: build them with text nodes and validated colors. */
function renderCaret(user: { name?: unknown; color?: unknown }): HTMLElement {
  const color =
    typeof user.color === 'string' && /^#[0-9a-f]{6}$/i.test(user.color) ? user.color : '#71717a';
  const caret = document.createElement('span');
  caret.className = 'collaboration-caret';
  // Decoration only: screen readers should read the description, not other people's names.
  caret.setAttribute('aria-hidden', 'true');
  caret.style.borderColor = color;
  const label = document.createElement('span');
  label.className = 'collaboration-caret__label';
  label.style.backgroundColor = color;
  label.textContent = typeof user.name === 'string' ? user.name.slice(0, 100) : '';
  caret.append(label);
  return caret;
}

const Carets = Extension.create<{ awareness: Awareness | null; cardId: string }>({
  name: 'collaborationCarets',
  addOptions: () => ({ awareness: null, cardId: '' }),
  addProseMirrorPlugins() {
    const { awareness, cardId } = this.options;
    if (!awareness) return [];
    const valid = (clientId: number) =>
      readPeers(awareness).some((peer) => peer.clientId === clientId);
    return [
      yCursorPlugin(caretAwareness(awareness, cardId), {
        awarenessStateFilter: (own, clientId) => own !== clientId && valid(clientId),
        cursorBuilder: renderCaret,
        selectionBuilder: (user) => {
          const color = /^#[0-9a-f]{6}$/i.test(user.color) ? user.color : '#71717a';
          return { style: `background-color: ${color}33`, class: 'collaboration-selection' };
        },
      }),
    ];
  },
});

interface DescriptionEditorProps {
  fragment: Y.XmlFragment;
  awareness: Awareness;
  cardId: string;
  readOnly: boolean;
}

export function DescriptionEditor({
  fragment,
  awareness,
  cardId,
  readOnly,
}: DescriptionEditorProps) {
  const { t } = useTranslation();
  const editor = useEditor(
    {
      editable: !readOnly,
      extensions: [
        // Collaboration brings its own (per-user, Yjs-based) undo history.
        StarterKit.configure({ undoRedo: false, heading: { levels: [2, 3] } }),
        Collaboration.configure({ fragment }),
        Carets.configure({ awareness, cardId }),
        Placeholder.configure({ placeholder: t('board.cardDialog.descriptionPlaceholder') }),
      ],
      editorProps: {
        attributes: {
          'aria-label': t('board.cardDialog.description'),
          'aria-multiline': 'true',
          role: 'textbox',
          class: 'tiptap-content min-h-32 px-3 py-2 focus-visible:outline-none',
        },
      },
    },
    [fragment, awareness, cardId, readOnly],
  );

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
    }),
  });

  const tools: { key: keyof typeof active; icon: LucideIcon; run: () => void }[] = [
    { key: 'bold', icon: Bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', icon: Italic, run: () => editor.chain().focus().toggleItalic().run() },
    {
      key: 'bulletList',
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: 'orderedList',
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div
      className={cn(
        'rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring',
        readOnly && 'bg-muted/40',
      )}
    >
      {!readOnly && (
        <div
          role="toolbar"
          aria-label={t('board.cardDialog.formatting')}
          className="flex gap-0.5 border-b p-1"
        >
          {tools.map(({ key, icon: Icon, run }) => (
            <Button
              key={key}
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={t(`board.cardDialog.${key}`)}
              aria-pressed={active[key]}
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
            >
              <Icon />
            </Button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} data-testid="description-editor" />
    </div>
  );
}
