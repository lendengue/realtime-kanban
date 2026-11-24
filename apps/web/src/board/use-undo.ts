import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';

import { isEditableTarget } from '@/lib/utils';

export interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const UNDO_EVENTS = ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const;

/**
 * Per-user undo/redo for the board (only this tab's changes are tracked, see
 * `createBoardUndoManager`). Binds Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y, except while typing.
 */
export function useUndo(undoManager: Y.UndoManager, enabled: boolean): UndoState {
  const cache = useRef<{ key: string; value: { canUndo: boolean; canRedo: boolean } } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      for (const event of UNDO_EVENTS) undoManager.on(event, onChange);
      return () => {
        for (const event of UNDO_EVENTS) undoManager.off(event, onChange);
      };
    },
    [undoManager],
  );

  const getSnapshot = useCallback(() => {
    const value = { canUndo: undoManager.canUndo(), canRedo: undoManager.canRedo() };
    const key = `${value.canUndo}:${value.canRedo}`;
    if (cache.current?.key !== key) cache.current = { key, value };
    return cache.current.value;
  }, [undoManager]);

  const { canUndo, canRedo } = useSyncExternalStore(subscribe, getSnapshot);
  const undo = useCallback(() => void undoManager.undo(), [undoManager]);
  const redo = useCallback(() => void undoManager.redo(), [undoManager]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || isEditableTarget(event.target)) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.metaKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, undo, redo]);

  return { canUndo: enabled && canUndo, canRedo: enabled && canRedo, undo, redo };
}
