import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccounts } from '../useAccounts';
import { ImapAccount } from '../../types';

describe('useAccounts', () => {
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

    const mockAccount3: ImapAccount = {
        id: 'account-3',
        name: 'Test Account 3',
        email: 'test3@example.com',
        color: 'purple',
        provider: 'custom',
    };

    beforeEach(() => {
        // Reset any mocks if needed
    });

    describe('Initial State', () => {
        it('should initialize with empty accounts array', () => {
            const { result } = renderHook(() => useAccounts());
            expect(result.current.accounts).toEqual([]);
        });

        it('should initialize with empty activeAccountId', () => {
            const { result } = renderHook(() => useAccounts());
            expect(result.current.activeAccountId).toBe('');
        });

        it('should initialize with undefined activeAccount', () => {
            const { result } = renderHook(() => useAccounts());
            expect(result.current.activeAccount).toBeUndefined();
        });

        it('should provide all required properties and functions', () => {
            const { result } = renderHook(() => useAccounts());
            expect(result.current).toHaveProperty('accounts');
            expect(result.current).toHaveProperty('activeAccountId');
            expect(result.current).toHaveProperty('activeAccount');
            expect(result.current).toHaveProperty('setAccounts');
            expect(result.current).toHaveProperty('setActiveAccountId');
            expect(result.current).toHaveProperty('addAccount');
            expect(result.current).toHaveProperty('removeAccount');
            expect(result.current).toHaveProperty('switchAccount');
        });
    });

    describe('setAccounts', () => {
        it('should set accounts array', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1, mockAccount2]);
            });

            expect(result.current.accounts).toHaveLength(2);
            expect(result.current.accounts[0]).toEqual(mockAccount1);
            expect(result.current.accounts[1]).toEqual(mockAccount2);
        });

        it('should replace existing accounts', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1]);
            });

            act(() => {
                result.current.setAccounts([mockAccount2, mockAccount3]);
            });

            expect(result.current.accounts).toHaveLength(2);
            expect(result.current.accounts[0]).toEqual(mockAccount2);
            expect(result.current.accounts[1]).toEqual(mockAccount3);
        });
    });

    describe('setActiveAccountId', () => {
        it('should set active account id', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setActiveAccountId('account-1');
            });

            expect(result.current.activeAccountId).toBe('account-1');
        });

        it('should update active account when id changes', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1, mockAccount2]);
                result.current.setActiveAccountId('account-1');
            });

            expect(result.current.activeAccount).toEqual(mockAccount1);

            act(() => {
                result.current.setActiveAccountId('account-2');
            });

            expect(result.current.activeAccount).toEqual(mockAccount2);
        });
    });

    describe('activeAccount computed property', () => {
        it('should return undefined when no accounts exist', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setActiveAccountId('account-1');
            });

            expect(result.current.activeAccount).toBeUndefined();
        });

        it('should return correct account based on activeAccountId', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1, mockAccount2]);
                result.current.setActiveAccountId('account-2');
            });

            expect(result.current.activeAccount).toEqual(mockAccount2);
        });

        it('should return undefined when activeAccountId does not match any account', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1, mockAccount2]);
                result.current.setActiveAccountId('non-existent');
            });

            expect(result.current.activeAccount).toBeUndefined();
        });

        it('should update when accounts array changes', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1]);
                result.current.setActiveAccountId('account-1');
            });

            expect(result.current.activeAccount).toEqual(mockAccount1);

            act(() => {
                result.current.setAccounts([mockAccount2]);
            });

            expect(result.current.activeAccount).toBeUndefined();
        });
    });

    describe('addAccount', () => {
        it('should add account to empty list', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.addAccount(mockAccount1);
            });

            expect(result.current.accounts).toHaveLength(1);
            expect(result.current.accounts[0]).toEqual(mockAccount1);
        });

        it('should add account to existing list', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.addAccount(mockAccount1);
            });

            act(() => {
                result.current.addAccount(mockAccount2);
            });

            expect(result.current.accounts).toHaveLength(2);
            expect(result.current.accounts[1]).toEqual(mockAccount2);
        });

        it('should make first account active automatically', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.addAccount(mockAccount1);
            });

            expect(result.current.activeAccountId).toBe('account-1');
            expect(result.current.activeAccount).toEqual(mockAccount1);
        });

        it('should not change active account when adding second account', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.addAccount(mockAccount1);
            });

            act(() => {
                result.current.addAccount(mockAccount2);
            });

            expect(result.current.activeAccountId).toBe('account-1');
            expect(result.current.activeAccount).toEqual(mockAccount1);
        });
    });

    describe('removeAccount', () => {
        it('should remove account from list', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1, mockAccount2]);
            });

            act(() => {
                result.current.removeAccount('account-1');
            });

            expect(result.current.accounts).toHaveLength(1);
            expect(result.current.accounts[0]).toEqual(mockAccount2);
        });

        it('should not affect list when removing non-existent account', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1]);
            });

            act(() => {
                result.current.removeAccount('non-existent');
            });

            expect(result.current.accounts).toHaveLength(1);
            expect(result.current.accounts[0]).toEqual(mockAccount1);
        });

        it('should switch to another account when removing active account', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1, mockAccount2]);
                result.current.setActiveAccountId('account-1');
            });

            act(() => {
                result.current.removeAccount('account-1');
            });

            expect(result.current.activeAccountId).toBe('account-2');
            expect(result.current.activeAccount).toEqual(mockAccount2);
        });

        it('should clear active account when removing the last account', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1]);
                result.current.setActiveAccountId('account-1');
            });

            act(() => {
                result.current.removeAccount('account-1');
            });

            expect(result.current.activeAccountId).toBe('');
            expect(result.current.activeAccount).toBeUndefined();
            expect(result.current.accounts).toHaveLength(0);
        });

        it('should not change active account when removing non-active account', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1, mockAccount2, mockAccount3]);
                result.current.setActiveAccountId('account-1');
            });

            act(() => {
                result.current.removeAccount('account-2');
            });

            expect(result.current.activeAccountId).toBe('account-1');
            expect(result.current.activeAccount).toEqual(mockAccount1);
        });
    });

    describe('switchAccount', () => {
        it('should switch to specified account', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1, mockAccount2]);
                result.current.setActiveAccountId('account-1');
            });

            act(() => {
                result.current.switchAccount('account-2');
            });

            expect(result.current.activeAccountId).toBe('account-2');
            expect(result.current.activeAccount).toEqual(mockAccount2);
        });

        it('should allow switching to non-existent account id', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1]);
                result.current.setActiveAccountId('account-1');
            });

            act(() => {
                result.current.switchAccount('non-existent');
            });

            expect(result.current.activeAccountId).toBe('non-existent');
            expect(result.current.activeAccount).toBeUndefined();
        });

        it('should handle switching between multiple accounts', () => {
            const { result } = renderHook(() => useAccounts());

            act(() => {
                result.current.setAccounts([mockAccount1, mockAccount2, mockAccount3]);
            });

            act(() => {
                result.current.switchAccount('account-1');
            });
            expect(result.current.activeAccount).toEqual(mockAccount1);

            act(() => {
                result.current.switchAccount('account-3');
            });
            expect(result.current.activeAccount).toEqual(mockAccount3);

            act(() => {
                result.current.switchAccount('account-2');
            });
            expect(result.current.activeAccount).toEqual(mockAccount2);
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle complete workflow of adding, switching, and removing accounts', () => {
            const { result } = renderHook(() => useAccounts());

            // Add first account
            act(() => {
                result.current.addAccount(mockAccount1);
            });
            expect(result.current.activeAccountId).toBe('account-1');

            // Add second account
            act(() => {
                result.current.addAccount(mockAccount2);
            });
            expect(result.current.accounts).toHaveLength(2);
            expect(result.current.activeAccountId).toBe('account-1');

            // Switch to second account
            act(() => {
                result.current.switchAccount('account-2');
            });
            expect(result.current.activeAccount).toEqual(mockAccount2);

            // Remove first account
            act(() => {
                result.current.removeAccount('account-1');
            });
            expect(result.current.accounts).toHaveLength(1);
            expect(result.current.activeAccountId).toBe('account-2');

            // Remove last account
            act(() => {
                result.current.removeAccount('account-2');
            });
            expect(result.current.accounts).toHaveLength(0);
            expect(result.current.activeAccountId).toBe('');
        });
    });
});
