import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from '../useSelection';
import { Email, INBOX_FOLDER } from '../../types';

describe('useSelection', () => {
  const mockEmail1: Email = {
    id: 'email-1',
    sender: 'John Doe',
    senderEmail: 'john@example.com',
    subject: 'Test Email 1',
    body: 'This is a test email body',
    date: '2024-01-01T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: false,
  };

  const mockEmail2: Email = {
    id: 'email-2',
    sender: 'Jane Smith',
    senderEmail: 'jane@example.com',
    subject: 'Test Email 2',
    body: 'Another test email',
    date: '2024-01-02T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: false,
  };

  const mockEmail3: Email = {
    id: 'email-3',
    sender: 'Bob Johnson',
    senderEmail: 'bob@example.com',
    subject: 'Test Email 3',
    body: 'Third test email',
    date: '2024-01-03T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: true,
    isFlagged: false,
  };

  const mockEmail4: Email = {
    id: 'email-4',
    sender: 'Alice Brown',
    senderEmail: 'alice@example.com',
    subject: 'Test Email 4',
    body: 'Fourth test email',
    date: '2024-01-04T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: true,
    isFlagged: false,
  };

  const mockEmail5: Email = {
    id: 'email-5',
    sender: 'Charlie Wilson',
    senderEmail: 'charlie@example.com',
    subject: 'Test Email 5',
    body: 'Fifth test email',
    date: '2024-01-05T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: true,
  };

  const mockEmails = [mockEmail1, mockEmail2, mockEmail3, mockEmail4, mockEmail5];

  const mockOnSelectEmail = vi.fn();

  const defaultProps = {
    filteredEmails: mockEmails,
    onSelectEmail: mockOnSelectEmail,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty selectedIds set', () => {
      const { result } = renderHook(() => useSelection(defaultProps));
      expect(result.current.selectedIds).toBeInstanceOf(Set);
      expect(result.current.selectedIds.size).toBe(0);
    });

    it('should provide all required properties and functions', () => {
      const { result } = renderHook(() => useSelection(defaultProps));
      expect(result.current).toHaveProperty('selectedIds');
      expect(result.current).toHaveProperty('handleSelection');
      expect(result.current).toHaveProperty('handleRowClick');
      expect(result.current).toHaveProperty('handleToggleSelection');
      expect(result.current).toHaveProperty('handleSelectAll');
      expect(result.current).toHaveProperty('clearSelection');
      expect(typeof result.current.handleSelection).toBe('function');
      expect(typeof result.current.handleRowClick).toBe('function');
      expect(typeof result.current.handleToggleSelection).toBe('function');
      expect(typeof result.current.handleSelectAll).toBe('function');
      expect(typeof result.current.clearSelection).toBe('function');
    });
  });

  describe('handleSelection', () => {
    describe('Single Selection', () => {
      it('should add email to selection when not multi or range', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('email-1', false, false);
        });

        expect(result.current.selectedIds.has('email-1')).toBe(true);
        expect(result.current.selectedIds.size).toBe(1);
      });

      it('should toggle email selection when clicking same email twice', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('email-1', false, false);
        });

        expect(result.current.selectedIds.has('email-1')).toBe(true);

        act(() => {
          result.current.handleSelection('email-1', false, false);
        });

        expect(result.current.selectedIds.has('email-1')).toBe(false);
        expect(result.current.selectedIds.size).toBe(0);
      });
    });

    describe('Multi Selection (Ctrl+Click)', () => {
      it('should add multiple emails to selection when multi is true', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('email-1', true, false);
        });

        act(() => {
          result.current.handleSelection('email-2', true, false);
        });

        expect(result.current.selectedIds.has('email-1')).toBe(true);
        expect(result.current.selectedIds.has('email-2')).toBe(true);
        expect(result.current.selectedIds.size).toBe(2);
      });

      it('should toggle individual emails in multi selection', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('email-1', true, false);
        });

        act(() => {
          result.current.handleSelection('email-2', true, false);
        });

        expect(result.current.selectedIds.size).toBe(2);

        act(() => {
          result.current.handleSelection('email-1', true, false);
        });

        expect(result.current.selectedIds.has('email-1')).toBe(false);
        expect(result.current.selectedIds.has('email-2')).toBe(true);
        expect(result.current.selectedIds.size).toBe(1);
      });

      it('should maintain other selections when toggling in multi mode', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('email-1', true, false);
        });

        act(() => {
          result.current.handleSelection('email-2', true, false);
        });

        act(() => {
          result.current.handleSelection('email-3', true, false);
        });

        expect(result.current.selectedIds.size).toBe(3);

        act(() => {
          result.current.handleSelection('email-2', true, false);
        });

        expect(result.current.selectedIds.has('email-1')).toBe(true);
        expect(result.current.selectedIds.has('email-2')).toBe(false);
        expect(result.current.selectedIds.has('email-3')).toBe(true);
        expect(result.current.selectedIds.size).toBe(2);
      });
    });

    describe('Range Selection (Shift+Click)', () => {
      it('should select range of emails when range is true', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        // First select an email to establish lastClickedId
        act(() => {
          result.current.handleSelection('email-1', false, false);
        });

        // Then shift+click on another email
        act(() => {
          result.current.handleSelection('email-4', false, true);
        });

        expect(result.current.selectedIds.has('email-1')).toBe(true);
        expect(result.current.selectedIds.has('email-2')).toBe(true);
        expect(result.current.selectedIds.has('email-3')).toBe(true);
        expect(result.current.selectedIds.has('email-4')).toBe(true);
        expect(result.current.selectedIds.size).toBe(4);
      });

      it('should select range in reverse order', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('email-4', false, false);
        });

        act(() => {
          result.current.handleSelection('email-2', false, true);
        });

        expect(result.current.selectedIds.has('email-2')).toBe(true);
        expect(result.current.selectedIds.has('email-3')).toBe(true);
        expect(result.current.selectedIds.has('email-4')).toBe(true);
        expect(result.current.selectedIds.size).toBe(3);
      });

      it('should handle range selection with only one email (same start and end)', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('email-3', false, false);
        });

        act(() => {
          result.current.handleSelection('email-3', false, true);
        });

        expect(result.current.selectedIds.has('email-3')).toBe(true);
        expect(result.current.selectedIds.size).toBe(1);
      });

      it('should not perform range selection when lastClickedId is null', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('email-3', false, true);
        });

        // Should behave like single selection
        expect(result.current.selectedIds.has('email-3')).toBe(true);
        expect(result.current.selectedIds.size).toBe(1);
      });

      it('should add to existing selection when doing range selection', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('email-1', true, false);
        });

        act(() => {
          result.current.handleSelection('email-5', true, false);
        });

        expect(result.current.selectedIds.size).toBe(2);

        // Now do a range selection from email-2 to email-4
        act(() => {
          result.current.handleSelection('email-2', false, false);
        });

        act(() => {
          result.current.handleSelection('email-4', false, true);
        });

        // Should have email-2, email-3, email-4 selected
        expect(result.current.selectedIds.has('email-2')).toBe(true);
        expect(result.current.selectedIds.has('email-3')).toBe(true);
        expect(result.current.selectedIds.has('email-4')).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should handle selection with empty filteredEmails', () => {
        const { result } = renderHook(() =>
          useSelection({
            filteredEmails: [],
            onSelectEmail: mockOnSelectEmail,
          })
        );

        act(() => {
          result.current.handleSelection('email-1', false, false);
        });

        expect(result.current.selectedIds.has('email-1')).toBe(true);
      });

      it('should handle range selection with empty filteredEmails', () => {
        const { result } = renderHook(() =>
          useSelection({
            filteredEmails: [],
            onSelectEmail: mockOnSelectEmail,
          })
        );

        act(() => {
          result.current.handleSelection('email-1', false, false);
        });

        act(() => {
          result.current.handleSelection('email-2', false, true);
        });

        // When filteredEmails is empty, range selection falls through to single selection
        expect(result.current.selectedIds.size).toBe(2);
        expect(result.current.selectedIds.has('email-1')).toBe(true);
        expect(result.current.selectedIds.has('email-2')).toBe(true);
      });

      it('should handle selection of non-existent email ids', () => {
        const { result } = renderHook(() => useSelection(defaultProps));

        act(() => {
          result.current.handleSelection('non-existent', false, false);
        });

        expect(result.current.selectedIds.has('non-existent')).toBe(true);
      });
    });
  });

  describe('handleRowClick', () => {
    it('should call onSelectEmail when clicked without modifier keys', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      const mockEvent = {
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      } as React.MouseEvent;

      act(() => {
        result.current.handleRowClick('email-1', mockEvent);
      });

      expect(mockOnSelectEmail).toHaveBeenCalledWith('email-1');
      expect(mockOnSelectEmail).toHaveBeenCalledTimes(1);
    });

    it('should perform multi selection when ctrl key is pressed', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      const mockEvent = {
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
      } as React.MouseEvent;

      act(() => {
        result.current.handleRowClick('email-1', mockEvent);
      });

      expect(result.current.selectedIds.has('email-1')).toBe(true);
      expect(mockOnSelectEmail).not.toHaveBeenCalled();
    });

    it('should perform multi selection when meta key is pressed', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      const mockEvent = {
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
      } as React.MouseEvent;

      act(() => {
        result.current.handleRowClick('email-1', mockEvent);
      });

      expect(result.current.selectedIds.has('email-1')).toBe(true);
      expect(mockOnSelectEmail).not.toHaveBeenCalled();
    });

    it('should perform range selection when shift key is pressed', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      // Mock window.getSelection
      const mockGetSelection = vi.fn(() => ({
        removeAllRanges: vi.fn(),
      }));
      global.window.getSelection = mockGetSelection as unknown as typeof window.getSelection;

      // First click to establish lastClickedId
      act(() => {
        result.current.handleSelection('email-1', false, false);
      });

      const mockEvent = {
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
      } as React.MouseEvent;

      act(() => {
        result.current.handleRowClick('email-3', mockEvent);
      });

      expect(result.current.selectedIds.has('email-1')).toBe(true);
      expect(result.current.selectedIds.has('email-2')).toBe(true);
      expect(result.current.selectedIds.has('email-3')).toBe(true);
      expect(mockOnSelectEmail).not.toHaveBeenCalled();
    });

    it('should clear text selection when shift clicking', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      const mockRemoveAllRanges = vi.fn();
      const mockGetSelection = vi.fn(() => ({
        removeAllRanges: mockRemoveAllRanges,
      }));
      global.window.getSelection = mockGetSelection as unknown as typeof window.getSelection;

      const mockEvent = {
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
      } as React.MouseEvent;

      act(() => {
        result.current.handleRowClick('email-1', mockEvent);
      });

      expect(mockGetSelection).toHaveBeenCalled();
      expect(mockRemoveAllRanges).toHaveBeenCalled();
    });
  });

  describe('handleToggleSelection', () => {
    it('should toggle selection without shift key', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      act(() => {
        result.current.handleToggleSelection('email-1');
      });

      expect(result.current.selectedIds.has('email-1')).toBe(true);

      act(() => {
        result.current.handleToggleSelection('email-1');
      });

      expect(result.current.selectedIds.has('email-1')).toBe(false);
    });

    it('should perform range selection with shift key', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      act(() => {
        result.current.handleToggleSelection('email-1');
      });

      act(() => {
        result.current.handleToggleSelection('email-3', true);
      });

      expect(result.current.selectedIds.has('email-1')).toBe(true);
      expect(result.current.selectedIds.has('email-2')).toBe(true);
      expect(result.current.selectedIds.has('email-3')).toBe(true);
      expect(result.current.selectedIds.size).toBe(3);
    });

    it('should handle default shiftKey parameter', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      act(() => {
        result.current.handleToggleSelection('email-1');
      });

      expect(result.current.selectedIds.has('email-1')).toBe(true);
      expect(result.current.selectedIds.size).toBe(1);
    });
  });

  describe('handleSelectAll', () => {
    it('should select all emails when none are selected', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      act(() => {
        result.current.handleSelectAll();
      });

      expect(result.current.selectedIds.size).toBe(5);
      expect(result.current.selectedIds.has('email-1')).toBe(true);
      expect(result.current.selectedIds.has('email-2')).toBe(true);
      expect(result.current.selectedIds.has('email-3')).toBe(true);
      expect(result.current.selectedIds.has('email-4')).toBe(true);
      expect(result.current.selectedIds.has('email-5')).toBe(true);
    });

    it('should deselect all emails when all are selected', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      act(() => {
        result.current.handleSelectAll();
      });

      expect(result.current.selectedIds.size).toBe(5);

      act(() => {
        result.current.handleSelectAll();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });

    it('should select all emails when some are selected', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      act(() => {
        result.current.handleSelection('email-1', false, false);
      });

      act(() => {
        result.current.handleSelection('email-2', true, false);
      });

      expect(result.current.selectedIds.size).toBe(2);

      act(() => {
        result.current.handleSelectAll();
      });

      expect(result.current.selectedIds.size).toBe(5);
    });

    it('should handle select all with empty filteredEmails', () => {
      const { result } = renderHook(() =>
        useSelection({
          filteredEmails: [],
          onSelectEmail: mockOnSelectEmail,
        })
      );

      act(() => {
        result.current.handleSelectAll();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });

    it('should toggle selection correctly with single email', () => {
      const { result } = renderHook(() =>
        useSelection({
          filteredEmails: [mockEmail1],
          onSelectEmail: mockOnSelectEmail,
        })
      );

      act(() => {
        result.current.handleSelectAll();
      });

      expect(result.current.selectedIds.size).toBe(1);
      expect(result.current.selectedIds.has('email-1')).toBe(true);

      act(() => {
        result.current.handleSelectAll();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe('clearSelection', () => {
    it('should clear all selected ids', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      act(() => {
        result.current.handleSelection('email-1', true, false);
      });

      act(() => {
        result.current.handleSelection('email-2', true, false);
      });

      act(() => {
        result.current.handleSelection('email-3', true, false);
      });

      expect(result.current.selectedIds.size).toBe(3);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });

    it('should reset lastClickedId', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      act(() => {
        result.current.handleSelection('email-1', false, false);
      });

      act(() => {
        result.current.clearSelection();
      });

      // After clearing, range selection should not work since lastClickedId is null
      act(() => {
        result.current.handleSelection('email-3', false, true);
      });

      expect(result.current.selectedIds.has('email-3')).toBe(true);
      expect(result.current.selectedIds.size).toBe(1);
    });

    it('should work when selection is already empty', () => {
      const { result } = renderHook(() => useSelection(defaultProps));

      expect(result.current.selectedIds.size).toBe(0);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe('State Persistence', () => {
    it('should maintain selection when filteredEmails prop changes', () => {
      const { result, rerender } = renderHook(
        ({ filteredEmails, onSelectEmail }) => useSelection({ filteredEmails, onSelectEmail }),
        {
          initialProps: {
            filteredEmails: mockEmails,
            onSelectEmail: mockOnSelectEmail,
          },
        }
      );

      act(() => {
        result.current.handleSelection('email-1', false, false);
      });

      act(() => {
        result.current.handleSelection('email-2', true, false);
      });

      expect(result.current.selectedIds.size).toBe(2);

      // Update filteredEmails (e.g., due to search/filter)
      rerender({
        filteredEmails: [mockEmail1, mockEmail3],
        onSelectEmail: mockOnSelectEmail,
      });

      // Selection should persist
      expect(result.current.selectedIds.has('email-1')).toBe(true);
      expect(result.current.selectedIds.has('email-2')).toBe(true);
      expect(result.current.selectedIds.size).toBe(2);
    });

    it('should update range selection based on new filteredEmails order', () => {
      const { result, rerender } = renderHook(
        ({ filteredEmails, onSelectEmail }) => useSelection({ filteredEmails, onSelectEmail }),
        {
          initialProps: {
            filteredEmails: mockEmails,
            onSelectEmail: mockOnSelectEmail,
          },
        }
      );

      act(() => {
        result.current.handleSelection('email-1', false, false);
      });

      // Change the order of filteredEmails
      const reorderedEmails = [mockEmail5, mockEmail4, mockEmail3, mockEmail2, mockEmail1];
      rerender({
        filteredEmails: reorderedEmails,
        onSelectEmail: mockOnSelectEmail,
      });

      // Range selection should work based on new order
      act(() => {
        result.current.handleSelection('email-5', false, true);
      });

      // Should select from email-5 to email-1 based on new order
      expect(result.current.selectedIds.has('email-5')).toBe(true);
      expect(result.current.selectedIds.has('email-4')).toBe(true);
      expect(result.current.selectedIds.has('email-3')).toBe(true);
      expect(result.current.selectedIds.has('email-2')).toBe(true);
      expect(result.current.selectedIds.has('email-1')).toBe(true);
      expect(result.current.selectedIds.size).toBe(5);
    });
  });
});
