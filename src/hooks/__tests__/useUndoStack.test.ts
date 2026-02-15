import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoStack, UndoAction } from '../useUndoStack';

describe('useUndoStack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockAction = (description = 'Test action'): UndoAction => ({
    type: 'move-category',
    emailIds: ['email-1'],
    previousState: new Map([['email-1', { smartCategory: 'Work' }]]),
    description,
    execute: vi.fn(),
  });

  describe('Initial State', () => {
    it('should initialize with canUndo as false', () => {
      const { result } = renderHook(() => useUndoStack());
      expect(result.current.canUndo).toBe(false);
    });

    it('should initialize with lastActionDescription as null', () => {
      const { result } = renderHook(() => useUndoStack());
      expect(result.current.lastActionDescription).toBeNull();
    });

    it('should provide all required properties and functions', () => {
      const { result } = renderHook(() => useUndoStack());
      expect(typeof result.current.pushAction).toBe('function');
      expect(typeof result.current.undo).toBe('function');
      expect(result.current).toHaveProperty('canUndo');
      expect(result.current).toHaveProperty('lastActionDescription');
    });
  });

  describe('pushAction', () => {
    it('should add action to stack and update canUndo', () => {
      const { result } = renderHook(() => useUndoStack());
      const action = createMockAction();

      act(() => {
        result.current.pushAction(action);
      });

      expect(result.current.canUndo).toBe(true);
      expect(result.current.lastActionDescription).toBe('Test action');
    });

    it('should add multiple actions to stack', () => {
      const { result } = renderHook(() => useUndoStack());

      act(() => {
        result.current.pushAction(createMockAction('Action 1'));
      });

      act(() => {
        result.current.pushAction(createMockAction('Action 2'));
      });

      expect(result.current.lastActionDescription).toBe('Action 2');
    });
  });

  describe('undo', () => {
    it('should call execute on the last action and pop it', () => {
      const { result } = renderHook(() => useUndoStack());
      const action = createMockAction();

      act(() => {
        result.current.pushAction(action);
      });

      act(() => {
        result.current.undo();
      });

      expect(action.execute).toHaveBeenCalledTimes(1);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.lastActionDescription).toBeNull();
    });

    it('should do nothing when stack is empty', () => {
      const { result } = renderHook(() => useUndoStack());

      act(() => {
        result.current.undo();
      });

      expect(result.current.canUndo).toBe(false);
    });

    it('should work in LIFO order', () => {
      const { result } = renderHook(() => useUndoStack());
      const action1 = createMockAction('Action 1');
      const action2 = createMockAction('Action 2');
      const action3 = createMockAction('Action 3');

      act(() => {
        result.current.pushAction(action1);
        result.current.pushAction(action2);
        result.current.pushAction(action3);
      });

      act(() => {
        result.current.undo();
      });

      expect(action3.execute).toHaveBeenCalledTimes(1);
      expect(action2.execute).not.toHaveBeenCalled();
      expect(result.current.lastActionDescription).toBe('Action 2');

      act(() => {
        result.current.undo();
      });

      expect(action2.execute).toHaveBeenCalledTimes(1);
      expect(result.current.lastActionDescription).toBe('Action 1');

      act(() => {
        result.current.undo();
      });

      expect(action1.execute).toHaveBeenCalledTimes(1);
      expect(result.current.canUndo).toBe(false);
    });

    it('should silently handle execute failures', () => {
      const { result } = renderHook(() => useUndoStack());
      const action = createMockAction();
      action.execute = vi.fn(() => {
        throw new Error('Undo failed');
      });

      act(() => {
        result.current.pushAction(action);
      });

      act(() => {
        result.current.undo();
      });

      expect(action.execute).toHaveBeenCalled();
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('Stack Limit', () => {
    it('should limit stack to 20 actions', () => {
      const { result } = renderHook(() => useUndoStack());

      act(() => {
        for (let i = 0; i < 25; i++) {
          result.current.pushAction(createMockAction(`Action ${i}`));
        }
      });

      // After 25 pushes, only 20 remain; the last pushed is "Action 24"
      expect(result.current.lastActionDescription).toBe('Action 24');

      // Undo all 20
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.undo();
        });
      }

      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('Ctrl+Z Keyboard Shortcut', () => {
    it('should trigger undo on Ctrl+Z', () => {
      const { result } = renderHook(() => useUndoStack());
      const action = createMockAction();

      act(() => {
        result.current.pushAction(action);
      });

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: false,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(action.execute).toHaveBeenCalledTimes(1);
      expect(result.current.canUndo).toBe(false);
    });

    it('should trigger undo on Meta+Z (Mac)', () => {
      const { result } = renderHook(() => useUndoStack());
      const action = createMockAction();

      act(() => {
        result.current.pushAction(action);
      });

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          metaKey: true,
          shiftKey: false,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(action.execute).toHaveBeenCalledTimes(1);
    });

    it('should not trigger undo on Ctrl+Shift+Z', () => {
      const { result } = renderHook(() => useUndoStack());
      const action = createMockAction();

      act(() => {
        result.current.pushAction(action);
      });

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(action.execute).not.toHaveBeenCalled();
      expect(result.current.canUndo).toBe(true);
    });

    it('should clean up event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useUndoStack());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });
});
