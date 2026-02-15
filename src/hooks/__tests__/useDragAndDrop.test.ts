import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragAndDrop } from '../useDragAndDrop';

describe('useDragAndDrop', () => {
  const mockOnMoveToSmartCategory = vi.fn();
  const mockOnMoveToFolder = vi.fn();

  const defaultCallbacks = {
    onMoveToSmartCategory: mockOnMoveToSmartCategory,
    onMoveToFolder: mockOnMoveToFolder,
  };

  const createMockDragEvent = (overrides: Partial<React.DragEvent> = {}): React.DragEvent => {
    const dataStore: Record<string, string> = {};
    return {
      preventDefault: vi.fn(),
      dataTransfer: {
        setData: vi.fn((key: string, value: string) => {
          dataStore[key] = value;
        }),
        getData: vi.fn((key: string) => dataStore[key] || ''),
        setDragImage: vi.fn(),
        effectAllowed: 'none',
        dropEffect: 'none',
      },
      relatedTarget: null,
      currentTarget: document.createElement('div'),
      ...overrides,
    } as unknown as React.DragEvent;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with isDragging false', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      expect(result.current.isDragging).toBe(false);
    });

    it('should initialize with empty draggedEmailIds', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      expect(result.current.draggedEmailIds).toEqual([]);
    });

    it('should initialize with null dropTargetCategory', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      expect(result.current.dropTargetCategory).toBeNull();
    });
  });

  describe('onEmailDragStart', () => {
    it('should set isDragging to true and store email id', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const event = createMockDragEvent();

      act(() => {
        result.current.onEmailDragStart('email-1', new Set(), event);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.draggedEmailIds).toEqual(['email-1']);
    });

    it('should include all selected IDs when dragged email is in selection', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const event = createMockDragEvent();
      const selectedIds = new Set(['email-1', 'email-2', 'email-3']);

      act(() => {
        result.current.onEmailDragStart('email-1', selectedIds, event);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.draggedEmailIds).toHaveLength(3);
      expect(result.current.draggedEmailIds).toContain('email-1');
      expect(result.current.draggedEmailIds).toContain('email-2');
      expect(result.current.draggedEmailIds).toContain('email-3');
    });

    it('should only drag single email when it is not in selection', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const event = createMockDragEvent();
      const selectedIds = new Set(['email-2', 'email-3']);

      act(() => {
        result.current.onEmailDragStart('email-1', selectedIds, event);
      });

      expect(result.current.draggedEmailIds).toEqual(['email-1']);
    });

    it('should set dataTransfer data and effectAllowed', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const event = createMockDragEvent();

      act(() => {
        result.current.onEmailDragStart('email-1', new Set(), event);
      });

      expect(event.dataTransfer.setData).toHaveBeenCalledWith(
        'application/json',
        JSON.stringify(['email-1'])
      );
      expect(event.dataTransfer.effectAllowed).toBe('move');
    });
  });

  describe('onCategoryDragOver', () => {
    it('should update dropTargetCategory', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const event = createMockDragEvent();

      act(() => {
        result.current.onCategoryDragOver('Work', event);
      });

      expect(result.current.dropTargetCategory).toBe('Work');
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should set dropEffect to move', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const event = createMockDragEvent();

      act(() => {
        result.current.onCategoryDragOver('Personal', event);
      });

      expect(event.dataTransfer.dropEffect).toBe('move');
    });
  });

  describe('onCategoryDragLeave', () => {
    it('should clear dropTargetCategory when leaving container', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const dragOverEvent = createMockDragEvent();

      act(() => {
        result.current.onCategoryDragOver('Work', dragOverEvent);
      });

      expect(result.current.dropTargetCategory).toBe('Work');

      const leaveEvent = createMockDragEvent({
        relatedTarget: null,
      });

      act(() => {
        result.current.onCategoryDragLeave(leaveEvent);
      });

      expect(result.current.dropTargetCategory).toBeNull();
    });

    it('should not clear when moving to child element', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const dragOverEvent = createMockDragEvent();

      act(() => {
        result.current.onCategoryDragOver('Work', dragOverEvent);
      });

      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);

      const leaveEvent = createMockDragEvent({
        relatedTarget: child,
        currentTarget: parent,
      } as unknown as Partial<React.DragEvent>);

      act(() => {
        result.current.onCategoryDragLeave(leaveEvent);
      });

      expect(result.current.dropTargetCategory).toBe('Work');
    });
  });

  describe('onDragEnd', () => {
    it('should clear all drag state', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const event = createMockDragEvent();

      act(() => {
        result.current.onEmailDragStart('email-1', new Set(['email-1']), event);
      });

      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.onDragEnd();
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.draggedEmailIds).toEqual([]);
      expect(result.current.dropTargetCategory).toBeNull();
    });
  });

  describe('onCategoryDrop', () => {
    it('should call onMoveToSmartCategory for smart category type', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));
      const startEvent = createMockDragEvent();

      act(() => {
        result.current.onEmailDragStart('email-1', new Set(), startEvent);
      });

      const dropEvent = createMockDragEvent();
      (dropEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(['email-1'])
      );

      act(() => {
        result.current.onCategoryDrop('Work', 'smart', dropEvent);
      });

      expect(mockOnMoveToSmartCategory).toHaveBeenCalledWith(['email-1'], 'Work');
      expect(mockOnMoveToFolder).not.toHaveBeenCalled();
      expect(result.current.isDragging).toBe(false);
    });

    it('should call onMoveToFolder for folder type', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));

      const dropEvent = createMockDragEvent();
      (dropEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(['email-1', 'email-2'])
      );

      act(() => {
        result.current.onCategoryDrop('Archive', 'folder', dropEvent);
      });

      expect(mockOnMoveToFolder).toHaveBeenCalledWith(['email-1', 'email-2'], 'Archive');
      expect(mockOnMoveToSmartCategory).not.toHaveBeenCalled();
    });

    it('should ignore drop with invalid data', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));

      const dropEvent = createMockDragEvent();
      (dropEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue('invalid json');

      act(() => {
        result.current.onCategoryDrop('Work', 'smart', dropEvent);
      });

      expect(mockOnMoveToSmartCategory).not.toHaveBeenCalled();
      expect(mockOnMoveToFolder).not.toHaveBeenCalled();
    });

    it('should ignore drop with empty email ids', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));

      const dropEvent = createMockDragEvent();
      (dropEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify([])
      );

      act(() => {
        result.current.onCategoryDrop('Work', 'smart', dropEvent);
      });

      expect(mockOnMoveToSmartCategory).not.toHaveBeenCalled();
    });

    it('should clear state after successful drop', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultCallbacks));

      const dropEvent = createMockDragEvent();
      (dropEvent.dataTransfer.getData as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(['email-1'])
      );

      act(() => {
        result.current.onCategoryDrop('Work', 'smart', dropEvent);
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.draggedEmailIds).toEqual([]);
      expect(result.current.dropTargetCategory).toBeNull();
    });
  });
});
