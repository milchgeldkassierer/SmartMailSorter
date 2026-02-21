import { useState, useEffect, useCallback, useRef } from 'react';

export interface UndoAction {
  type: 'move-category' | 'move-folder' | 'toggle-flag';
  emailIds: string[];
  previousState: Map<string, { smartCategory?: string; folder?: string; isFlagged?: boolean }>;
  description: string;
  execute: () => void | Promise<void>;
}

interface UseUndoStackReturn {
  pushAction: (action: UndoAction) => void;
  undo: () => void;
  canUndo: boolean;
  lastActionDescription: string | null;
}

const MAX_STACK_SIZE = 20;

export const useUndoStack = (): UseUndoStackReturn => {
  const [stack, setStack] = useState<UndoAction[]>([]);
  const stackRef = useRef<UndoAction[]>([]);
  stackRef.current = stack;

  const pushAction = useCallback((action: UndoAction) => {
    setStack((prev) => {
      const next = [...prev, action];
      if (next.length > MAX_STACK_SIZE) {
        return next.slice(next.length - MAX_STACK_SIZE);
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const current = stackRef.current;
    if (current.length === 0) return;
    const action = current[current.length - 1];
    setStack((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)));
    try {
      Promise.resolve(action.execute()).catch(() => {
        // Silently handle async undo failures
      });
    } catch {
      // Silently handle sync undo failures
    }
  }, []);

  const canUndo = stack.length > 0;
  const lastActionDescription = stack.length > 0 ? stack[stack.length - 1].description : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  return {
    pushAction,
    undo,
    canUndo,
    lastActionDescription,
  };
};
