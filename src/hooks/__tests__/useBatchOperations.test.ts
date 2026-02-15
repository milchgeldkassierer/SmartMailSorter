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
    model: 'gemini-3-flash-preview',
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
