import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchOperations } from '../useBatchOperations';
import { Email, AISettings, LLMProvider, INBOX_FOLDER } from '../../types';

describe('useBatchOperations', () => {
  const mockEmail1: Email = {
    id: '1',
    sender: 'test1@example.com',
    senderEmail: 'test1@example.com',
    subject: 'Test 1',
    body: 'Body 1',
    date: '2024-01-01T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: false,
    hasAttachments: false,
  };

  const mockEmail2: Email = {
    id: '2',
    sender: 'test2@example.com',
    senderEmail: 'test2@example.com',
    subject: 'Test 2',
    body: 'Body 2',
    date: '2024-01-02T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: true,
    isFlagged: false,
    hasAttachments: false,
  };

  const mockEmail3: Email = {
    id: '3',
    sender: 'test3@example.com',
    senderEmail: 'test3@example.com',
    subject: 'Test 3',
    body: 'Body 3',
    date: '2024-01-03T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: true,
    isFlagged: false,
    hasAttachments: false,
  };

  const defaultAISettings: AISettings = {
    provider: LLMProvider.GEMINI,
    model: 'gemini-2.5-flash',
    apiKey: 'test-key',
  };

  const mockDialog = {
    confirm: vi.fn().mockResolvedValue(true),
    alert: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleBatchMarkRead', () => {
    it('should return handleBatchMarkRead function', () => {
      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(),
          currentEmails: [],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag: vi.fn(),
          onClearSelection: vi.fn(),
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      expect(result.current.handleBatchMarkRead).toBeDefined();
      expect(typeof result.current.handleBatchMarkRead).toBe('function');
    });

    it('should mark all as read when any selected email is unread', async () => {
      const onToggleRead = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const unreadEmail: Email = { ...mockEmail1, isRead: false };
      const readEmail: Email = { ...mockEmail2, isRead: true };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1', '2']),
          currentEmails: [unreadEmail, readEmail],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead,
          onToggleFlag: vi.fn(),
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchMarkRead();
      });

      // Should toggle the unread email (id: '1') to make it read
      expect(onToggleRead).toHaveBeenCalledWith('1');
      // Should NOT toggle the already-read email (id: '2')
      expect(onToggleRead).not.toHaveBeenCalledWith('2');
      expect(onToggleRead).toHaveBeenCalledTimes(1);
      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should mark all as unread when all selected emails are read', async () => {
      const onToggleRead = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const readEmail1: Email = { ...mockEmail1, id: '1', isRead: true };
      const readEmail2: Email = { ...mockEmail2, id: '2', isRead: true };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1', '2']),
          currentEmails: [readEmail1, readEmail2],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead,
          onToggleFlag: vi.fn(),
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchMarkRead();
      });

      // Should toggle both emails to mark them as unread
      expect(onToggleRead).toHaveBeenCalledWith('1');
      expect(onToggleRead).toHaveBeenCalledWith('2');
      expect(onToggleRead).toHaveBeenCalledTimes(2);
      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should only toggle emails whose state differs from target', async () => {
      const onToggleRead = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const unreadEmail1: Email = { ...mockEmail1, id: '1', isRead: false };
      const unreadEmail2: Email = { ...mockEmail2, id: '2', isRead: false };
      const unreadEmail3: Email = { ...mockEmail3, id: '3', isRead: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1', '2', '3']),
          currentEmails: [unreadEmail1, unreadEmail2, unreadEmail3],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead,
          onToggleFlag: vi.fn(),
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchMarkRead();
      });

      // All are unread, so all should be toggled to read
      expect(onToggleRead).toHaveBeenCalledWith('1');
      expect(onToggleRead).toHaveBeenCalledWith('2');
      expect(onToggleRead).toHaveBeenCalledWith('3');
      expect(onToggleRead).toHaveBeenCalledTimes(3);
      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should clear selection after successful operation', async () => {
      const onToggleRead = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const unreadEmail: Email = { ...mockEmail1, isRead: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1']),
          currentEmails: [unreadEmail],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead,
          onToggleFlag: vi.fn(),
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchMarkRead();
      });

      expect(onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('should display error alert on failure', async () => {
      const dialogAlert = vi.fn().mockResolvedValue(undefined);
      const testDialog = { ...mockDialog, alert: dialogAlert };
      const onToggleRead = vi.fn().mockRejectedValue(new Error('Network error'));
      const onClearSelection = vi.fn();
      const unreadEmail: Email = { ...mockEmail1, isRead: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1']),
          currentEmails: [unreadEmail],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead,
          onToggleFlag: vi.fn(),
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: testDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchMarkRead();
      });

      expect(dialogAlert).toHaveBeenCalledWith({
        title: 'Fehler',
        message: 'Einige Emails konnten nicht aktualisiert werden',
        variant: 'danger',
      });
    });

    it('should do nothing when selectedIds is empty', async () => {
      const onToggleRead = vi.fn();
      const onClearSelection = vi.fn();

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(),
          currentEmails: [mockEmail1, mockEmail2],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead,
          onToggleFlag: vi.fn(),
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchMarkRead();
      });

      expect(onToggleRead).not.toHaveBeenCalled();
      expect(onClearSelection).not.toHaveBeenCalled();
    });

    it('should handle mixed read/unread selection correctly', async () => {
      const onToggleRead = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const unreadEmail1: Email = { ...mockEmail1, id: '1', isRead: false };
      const readEmail1: Email = { ...mockEmail2, id: '2', isRead: true };
      const unreadEmail2: Email = { ...mockEmail3, id: '3', isRead: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1', '2', '3']),
          currentEmails: [unreadEmail1, readEmail1, unreadEmail2],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead,
          onToggleFlag: vi.fn(),
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchMarkRead();
      });

      // If any email is unread, target state is read
      // So only unread emails should be toggled
      expect(onToggleRead).toHaveBeenCalledWith('1');
      expect(onToggleRead).toHaveBeenCalledWith('3');
      expect(onToggleRead).not.toHaveBeenCalledWith('2');
      expect(onToggleRead).toHaveBeenCalledTimes(2);
      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should not clear selection on failure', async () => {
      const onToggleRead = vi.fn().mockRejectedValue(new Error('Failed'));
      const onClearSelection = vi.fn();
      const dialogAlert = vi.fn().mockResolvedValue(undefined);
      const testDialog = { ...mockDialog, alert: dialogAlert };
      const unreadEmail: Email = { ...mockEmail1, isRead: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1']),
          currentEmails: [unreadEmail],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead,
          onToggleFlag: vi.fn(),
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: testDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchMarkRead();
      });

      // Selection should NOT be cleared on failure
      expect(onClearSelection).not.toHaveBeenCalled();
      expect(dialogAlert).toHaveBeenCalled();
    });
  });

  describe('handleBatchFlag', () => {
    it('should return handleBatchFlag function', () => {
      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(),
          currentEmails: [],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag: vi.fn(),
          onClearSelection: vi.fn(),
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      expect(result.current.handleBatchFlag).toBeDefined();
      expect(typeof result.current.handleBatchFlag).toBe('function');
    });

    it('should flag all when any selected email is unflagged', async () => {
      const onToggleFlag = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const unflaggedEmail: Email = { ...mockEmail1, isFlagged: false };
      const flaggedEmail: Email = { ...mockEmail2, isFlagged: true };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1', '2']),
          currentEmails: [unflaggedEmail, flaggedEmail],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag,
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchFlag();
      });

      // Should toggle the unflagged email (id: '1') to make it flagged
      expect(onToggleFlag).toHaveBeenCalledWith('1');
      // Should NOT toggle the already-flagged email (id: '2')
      expect(onToggleFlag).not.toHaveBeenCalledWith('2');
      expect(onToggleFlag).toHaveBeenCalledTimes(1);
      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should unflag all when all selected emails are flagged', async () => {
      const onToggleFlag = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const flaggedEmail1: Email = { ...mockEmail1, id: '1', isFlagged: true };
      const flaggedEmail2: Email = { ...mockEmail2, id: '2', isFlagged: true };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1', '2']),
          currentEmails: [flaggedEmail1, flaggedEmail2],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag,
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchFlag();
      });

      // Should toggle both emails to unflag them
      expect(onToggleFlag).toHaveBeenCalledWith('1');
      expect(onToggleFlag).toHaveBeenCalledWith('2');
      expect(onToggleFlag).toHaveBeenCalledTimes(2);
      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should only toggle emails whose state differs from target', async () => {
      const onToggleFlag = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const unflaggedEmail1: Email = { ...mockEmail1, id: '1', isFlagged: false };
      const unflaggedEmail2: Email = { ...mockEmail2, id: '2', isFlagged: false };
      const unflaggedEmail3: Email = { ...mockEmail3, id: '3', isFlagged: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1', '2', '3']),
          currentEmails: [unflaggedEmail1, unflaggedEmail2, unflaggedEmail3],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag,
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchFlag();
      });

      // All are unflagged, so all should be toggled to flagged
      expect(onToggleFlag).toHaveBeenCalledWith('1');
      expect(onToggleFlag).toHaveBeenCalledWith('2');
      expect(onToggleFlag).toHaveBeenCalledWith('3');
      expect(onToggleFlag).toHaveBeenCalledTimes(3);
      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should clear selection after successful operation', async () => {
      const onToggleFlag = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const unflaggedEmail: Email = { ...mockEmail1, isFlagged: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1']),
          currentEmails: [unflaggedEmail],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag,
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchFlag();
      });

      expect(onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('should display error alert on failure', async () => {
      const dialogAlert = vi.fn().mockResolvedValue(undefined);
      const testDialog = { ...mockDialog, alert: dialogAlert };
      const onToggleFlag = vi.fn().mockRejectedValue(new Error('Network error'));
      const onClearSelection = vi.fn();
      const unflaggedEmail: Email = { ...mockEmail1, isFlagged: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1']),
          currentEmails: [unflaggedEmail],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag,
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: testDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchFlag();
      });

      expect(dialogAlert).toHaveBeenCalledWith({
        title: 'Fehler',
        message: 'Einige Emails konnten nicht aktualisiert werden',
        variant: 'danger',
      });
    });

    it('should do nothing when selectedIds is empty', async () => {
      const onToggleFlag = vi.fn();
      const onClearSelection = vi.fn();

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(),
          currentEmails: [mockEmail1, mockEmail2],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag,
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchFlag();
      });

      expect(onToggleFlag).not.toHaveBeenCalled();
      expect(onClearSelection).not.toHaveBeenCalled();
    });

    it('should handle mixed flagged/unflagged selection correctly', async () => {
      const onToggleFlag = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      const unflaggedEmail1: Email = { ...mockEmail1, id: '1', isFlagged: false };
      const flaggedEmail1: Email = { ...mockEmail2, id: '2', isFlagged: true };
      const unflaggedEmail2: Email = { ...mockEmail3, id: '3', isFlagged: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1', '2', '3']),
          currentEmails: [unflaggedEmail1, flaggedEmail1, unflaggedEmail2],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag,
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchFlag();
      });

      // If any email is unflagged, target state is flagged
      // So only unflagged emails should be toggled
      expect(onToggleFlag).toHaveBeenCalledWith('1');
      expect(onToggleFlag).toHaveBeenCalledWith('3');
      expect(onToggleFlag).not.toHaveBeenCalledWith('2');
      expect(onToggleFlag).toHaveBeenCalledTimes(2);
      expect(onClearSelection).toHaveBeenCalled();
    });

    it('should not clear selection on failure', async () => {
      const onToggleFlag = vi.fn().mockRejectedValue(new Error('Failed'));
      const onClearSelection = vi.fn();
      const dialogAlert = vi.fn().mockResolvedValue(undefined);
      const testDialog = { ...mockDialog, alert: dialogAlert };
      const unflaggedEmail: Email = { ...mockEmail1, isFlagged: false };

      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(['1']),
          currentEmails: [unflaggedEmail],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag,
          onClearSelection,
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: testDialog,
        })
      );

      await act(async () => {
        await result.current.handleBatchFlag();
      });

      // Selection should NOT be cleared on failure
      expect(onClearSelection).not.toHaveBeenCalled();
      expect(dialogAlert).toHaveBeenCalled();
    });
  });

  describe('Hook Return Values', () => {
    it('should return all required properties', () => {
      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(),
          currentEmails: [],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag: vi.fn(),
          onClearSelection: vi.fn(),
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      expect(result.current).toHaveProperty('isSorting');
      expect(result.current).toHaveProperty('sortProgress');
      expect(result.current).toHaveProperty('canSmartSort');
      expect(result.current).toHaveProperty('handleBatchDelete');
      expect(result.current).toHaveProperty('handleBatchSmartSort');
      expect(result.current).toHaveProperty('handleBatchMarkRead');
      expect(result.current).toHaveProperty('handleBatchFlag');
    });

    it('should initialize with correct default values', () => {
      const { result } = renderHook(() =>
        useBatchOperations({
          selectedIds: new Set(),
          currentEmails: [],
          currentCategories: [],
          aiSettings: defaultAISettings,
          onDeleteEmail: vi.fn(),
          onToggleRead: vi.fn(),
          onToggleFlag: vi.fn(),
          onClearSelection: vi.fn(),
          onUpdateEmails: vi.fn(),
          onUpdateCategories: vi.fn(),
          onOpenSettings: vi.fn(),
          dialog: mockDialog,
        })
      );

      expect(result.current.isSorting).toBe(false);
      expect(result.current.sortProgress).toBe(0);
    });
  });
});
