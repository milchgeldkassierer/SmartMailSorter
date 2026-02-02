import { useState, useMemo } from 'react';
import { ImapAccount } from '../types';

interface UseAccountsReturn {
  accounts: ImapAccount[];
  activeAccountId: string;
  activeAccount: ImapAccount | undefined;
  setAccounts: (accounts: ImapAccount[]) => void;
  setActiveAccountId: (id: string) => void;
  addAccount: (account: ImapAccount) => void;
  removeAccount: (id: string) => void;
  switchAccount: (id: string) => void;
}

export const useAccounts = (): UseAccountsReturn => {
  const [accounts, setAccounts] = useState<ImapAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>('');

  // Computed property for active account
  const activeAccount = useMemo(() => {
    return accounts.find(a => a.id === activeAccountId);
  }, [accounts, activeAccountId]);

  // Add a new account to the list
  const addAccount = (account: ImapAccount) => {
    setAccounts(prev => {
      // If this is the first account, make it active
      if (prev.length === 0) {
        setActiveAccountId(account.id);
      }
      return [...prev, account];
    });
  };

  // Remove an account and switch to another if needed
  const removeAccount = (id: string) => {
    setAccounts(prev => {
      const filtered = prev.filter(a => a.id !== id);
      // If removing the active account, switch to another
      if (activeAccountId === id) {
        const otherAccount = filtered.find(a => a.id !== id);
        if (otherAccount) {
          setActiveAccountId(otherAccount.id);
        } else {
          setActiveAccountId('');
        }
      }
      return filtered;
    });
  };

  // Switch to a different account
  const switchAccount = (id: string) => {
    setActiveAccountId(id);
  };

  return {
    accounts,
    activeAccountId,
    activeAccount,
    setAccounts,
    setActiveAccountId,
    addAccount,
    removeAccount,
    switchAccount,
  };
};
