import { readBoard, type BoardView } from '@realtime-kanban/board-doc';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';

/** Re-renders with a fresh immutable `BoardView` after every document update. */
export function useBoardView(doc: Y.Doc): BoardView {
  const cache = useRef<{ doc: Y.Doc; view: BoardView } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = () => {
        cache.current = null;
        onChange();
      };
      doc.on('update', handler);
      return () => doc.off('update', handler);
    },
    [doc],
  );

  const getSnapshot = useCallback(() => {
    if (cache.current?.doc !== doc) cache.current = { doc, view: readBoard(doc) };
    return cache.current.view;
  }, [doc]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
