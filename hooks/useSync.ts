import { useState, useCallback } from 'react';
import { ImapAccount, Email } from '../types';

interface UseSyncParams {
  activeAccountId: string;
  accounts: ImapAccount[];
  onAccountsUpdate?: (accounts: ImapAccount[]) => void;
  onDataUpdate?: (accountId: string, data: { emails: Email[] }) => void;
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
}: UseSyncParams): UseSyncReturn => {
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync emails for the active account
  const syncAccount = useCallback(async () => {
    if (!window.electron || !activeAccountId) return;

    setIsSyncing(true);

    try {
      const account = accounts.find(a => a.id === activeAccountId);
      if (!account) return;

      // Trigger backend sync
      await window.electron.syncAccount(account);

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
    } finally {
      setIsSyncing(false);
    }
  }, [activeAccountId, accounts, onAccountsUpdate, onDataUpdate]);

  return {
    isSyncing,
    syncAccount,
  };
};
