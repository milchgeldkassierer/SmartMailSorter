import { useState, useCallback } from 'react';
import { ImapAccount, Email } from '../types';

interface UseSyncParams {
  activeAccountId: string;
  accounts: ImapAccount[];
  onAccountsUpdate?: (accounts: ImapAccount[]) => void;
  onDataUpdate?: (accountId: string, data: { emails: Email[] }) => void;
  dialog: {
    alert: (config: { title: string; message: string; variant?: string }) => Promise<void>;
  };
}

interface UseSyncReturn {
  isSyncing: boolean;
  syncAccount: () => Promise<void>;
}

export const useSync = ({
  activeAccountId,
  accounts,
  onAccountsUpdate,
  onDataUpdate,
  dialog,
}: UseSyncParams): UseSyncReturn => {
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync emails for the active account
  const syncAccount = useCallback(async () => {
    if (!window.electron || !activeAccountId) return;

    setIsSyncing(true);

    try {
      const account = accounts.find((a) => a.id === activeAccountId);
      if (!account) return;

      // Trigger backend sync - pass only accountId for security
      await window.electron.syncAccount(activeAccountId);

      // Refresh emails for the active account
      const emails = await window.electron.getEmails(activeAccountId);

      // Refresh account info (quota, etc.)
      const updatedAccounts = await window.electron.getAccounts();

      // Notify parent components of updates
      if (onAccountsUpdate) {
        onAccountsUpdate(updatedAccounts);
      }

      if (onDataUpdate) {
        onDataUpdate(activeAccountId, { emails });
      }
    } catch (error) {
      console.error('Failed to sync account:', error);
      await dialog.alert({
        title: 'Synchronisierungsfehler',
        message: 'Synchronisierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
        variant: 'danger',
      });
    } finally {
      setIsSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, accounts, onAccountsUpdate, onDataUpdate, dialog.alert]);

  return {
    isSyncing,
    syncAccount,
  };
};
