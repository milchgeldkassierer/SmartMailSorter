import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSync } from '../useSync';
import { ImapAccount, Email, INBOX_FOLDER } from '../../types';

// Mock dialog passed as prop
const mockDialogAlert = vi.fn();
const mockDialog = {
  alert: mockDialogAlert,
};

describe('useSync', () => {
  const mockAccount1: ImapAccount = {
    id: 'account-1',
    name: 'Test Account 1',
    email: 'test1@example.com',
    color: 'blue',
    provider: 'gmail',
  };

  const mockAccount2: ImapAccount = {
    id: 'account-2',
    name: 'Test Account 2',
    email: 'test2@example.com',
    color: 'green',
    provider: 'outlook',
  };

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
    subject: 'Important Meeting',
    body: 'Meeting scheduled for tomorrow',
    date: '2024-01-02T10:00:00Z',
    folder: INBOX_FOLDER,
    isRead: false,
    isFlagged: false,
  };

  const mockElectron = {
    syncAccount: vi.fn(),
    getEmails: vi.fn(),
    getAccounts: vi.fn(),
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup window.electron mock
    (window as unknown as { electron: typeof mockElectron }).electron = mockElectron;

    // Default mock implementations
    mockElectron.syncAccount.mockResolvedValue(undefined);
    mockElectron.getEmails.mockResolvedValue([mockEmail1, mockEmail2]);
    mockElectron.getAccounts.mockResolvedValue([mockAccount1, mockAccount2]);

    // Reset dialog mocks
    mockDialogAlert.mockResolvedValue(undefined);
  });

  describe('Initial State', () => {
    it('should initialize with isSyncing as false', () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );
      expect(result.current.isSyncing).toBe(false);
    });

    it('should provide syncAccount function', () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );
      expect(typeof result.current.syncAccount).toBe('function');
    });

    it('should provide all required properties', () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );
      expect(result.current).toHaveProperty('isSyncing');
      expect(result.current).toHaveProperty('syncAccount');
    });
  });

  describe('syncAccount', () => {
    it('should set isSyncing to true during sync', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      let syncPromise: Promise<void>;
      act(() => {
        syncPromise = result.current.syncAccount();
      });

      expect(result.current.isSyncing).toBe(true);

      await act(async () => {
        await syncPromise;
      });

      expect(result.current.isSyncing).toBe(false);
    });

    it('should call electron.syncAccount with correct accountId', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1, mockAccount2],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.syncAccount).toHaveBeenCalledTimes(1);
      expect(mockElectron.syncAccount).toHaveBeenCalledWith('account-1');
    });

    it('should call electron.getEmails with active account id', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.getEmails).toHaveBeenCalledTimes(1);
      expect(mockElectron.getEmails).toHaveBeenCalledWith('account-1');
    });

    it('should call electron.getAccounts to refresh account info', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.getAccounts).toHaveBeenCalledTimes(1);
    });

    it('should call onAccountsUpdate callback with updated accounts', async () => {
      const onAccountsUpdate = vi.fn();
      const updatedAccounts = [{ ...mockAccount1, name: 'Updated Account 1' }, mockAccount2];
      mockElectron.getAccounts.mockResolvedValue(updatedAccounts);

      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          onAccountsUpdate,
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(onAccountsUpdate).toHaveBeenCalledTimes(1);
      expect(onAccountsUpdate).toHaveBeenCalledWith(updatedAccounts);
    });

    it('should call onDataUpdate callback with emails data', async () => {
      const onDataUpdate = vi.fn();
      const emails = [mockEmail1, mockEmail2];
      mockElectron.getEmails.mockResolvedValue(emails);

      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          onDataUpdate,
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(onDataUpdate).toHaveBeenCalledTimes(1);
      expect(onDataUpdate).toHaveBeenCalledWith('account-1', { emails });
    });

    it('should call both callbacks when provided', async () => {
      const onAccountsUpdate = vi.fn();
      const onDataUpdate = vi.fn();

      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          onAccountsUpdate,
          onDataUpdate,
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(onAccountsUpdate).toHaveBeenCalledTimes(1);
      expect(onDataUpdate).toHaveBeenCalledTimes(1);
    });

    it('should work without callbacks provided', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.syncAccount).toHaveBeenCalledTimes(1);
      expect(mockElectron.getEmails).toHaveBeenCalledTimes(1);
      expect(mockElectron.getAccounts).toHaveBeenCalledTimes(1);
    });

    it('should set isSyncing to false after successful sync', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      expect(result.current.isSyncing).toBe(false);

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should set isSyncing to false on error', async () => {
      mockElectron.syncAccount.mockRejectedValue(new Error('Sync failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(result.current.isSyncing).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should log error to console on sync failure', async () => {
      const error = new Error('Sync failed');
      mockElectron.syncAccount.mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to sync account:', error);

      consoleErrorSpy.mockRestore();
    });

    it('should show alert on sync failure', async () => {
      mockElectron.syncAccount.mockRejectedValue(new Error('Sync failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockDialogAlert).toHaveBeenCalledWith({
        title: 'Synchronisierungsfehler',
        message: 'Synchronisierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
        variant: 'danger',
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle error during getEmails', async () => {
      mockElectron.getEmails.mockRejectedValue(new Error('Failed to get emails'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(result.current.isSyncing).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockDialogAlert).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle error during getAccounts', async () => {
      mockElectron.getAccounts.mockRejectedValue(new Error('Failed to get accounts'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(result.current.isSyncing).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockDialogAlert).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should do nothing if window.electron is not available', async () => {
      (window as unknown as { electron: undefined }).electron = undefined;

      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(result.current.isSyncing).toBe(false);
    });

    it('should do nothing if activeAccountId is empty', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: '',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.syncAccount).not.toHaveBeenCalled();
      expect(result.current.isSyncing).toBe(false);
    });

    it('should return early if account is not found in accounts array', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'non-existent-account',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.syncAccount).not.toHaveBeenCalled();
      expect(mockElectron.getEmails).not.toHaveBeenCalled();
      expect(result.current.isSyncing).toBe(false);
    });

    it('should handle empty accounts array', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.syncAccount).not.toHaveBeenCalled();
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('Hook Stability', () => {
    it('should update syncAccount when activeAccountId changes', () => {
      const { result, rerender } = renderHook((props) => useSync(props), {
        initialProps: {
          activeAccountId: 'account-1',
          accounts: [mockAccount1, mockAccount2],
          dialog: mockDialog,
        },
      });

      const firstSyncAccount = result.current.syncAccount;

      rerender({
        activeAccountId: 'account-2',
        accounts: [mockAccount1, mockAccount2],
        dialog: mockDialog,
      });

      expect(result.current.syncAccount).not.toBe(firstSyncAccount);
    });

    it('should update syncAccount when accounts array changes', () => {
      const { result, rerender } = renderHook((props) => useSync(props), {
        initialProps: {
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        },
      });

      const firstSyncAccount = result.current.syncAccount;

      rerender({
        activeAccountId: 'account-1',
        accounts: [mockAccount1, mockAccount2],
        dialog: mockDialog,
      });

      expect(result.current.syncAccount).not.toBe(firstSyncAccount);
    });

    it('should update syncAccount when callbacks change', () => {
      const onAccountsUpdate1 = vi.fn();
      const onAccountsUpdate2 = vi.fn();

      const { result, rerender } = renderHook((props) => useSync(props), {
        initialProps: {
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          onAccountsUpdate: onAccountsUpdate1,
          dialog: mockDialog,
        },
      });

      const firstSyncAccount = result.current.syncAccount;

      rerender({
        activeAccountId: 'account-1',
        accounts: [mockAccount1],
        onAccountsUpdate: onAccountsUpdate2,
        dialog: mockDialog,
      });

      expect(result.current.syncAccount).not.toBe(firstSyncAccount);
    });
  });

  describe('Multiple Sync Calls', () => {
    it('should handle multiple sync calls in sequence', async () => {
      const { result } = renderHook(() =>
        useSync({
          activeAccountId: 'account-1',
          accounts: [mockAccount1],
          dialog: mockDialog,
        })
      );

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.syncAccount).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.syncAccount).toHaveBeenCalledTimes(2);
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('Account Switching', () => {
    it('should sync different account when activeAccountId changes', async () => {
      mockElectron.syncAccount.mockClear();

      const { result, rerender } = renderHook((props) => useSync(props), {
        initialProps: {
          activeAccountId: 'account-1',
          accounts: [mockAccount1, mockAccount2],
          dialog: mockDialog,
        },
      });

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.syncAccount).toHaveBeenCalledWith('account-1');
      expect(mockElectron.syncAccount).toHaveBeenCalledTimes(1);

      mockElectron.syncAccount.mockClear();

      act(() => {
        rerender({
          activeAccountId: 'account-2',
          accounts: [mockAccount1, mockAccount2],
          dialog: mockDialog,
        });
      });

      await act(async () => {
        await result.current.syncAccount();
      });

      expect(mockElectron.syncAccount).toHaveBeenCalledWith('account-2');
      expect(mockElectron.syncAccount).toHaveBeenCalledTimes(1);
    });
  });
});
