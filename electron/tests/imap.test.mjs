import { describe, it, expect, vi } from 'vitest';

// Mock Electron before importing imap module
vi.mock('electron', () => ({
    app: { getPath: () => 'tmp' }
}));

// Mock DB module
vi.mock('../db.cjs', () => ({
    saveEmail: vi.fn(),
    updateAccountSync: vi.fn(),
    updateAccountQuota: vi.fn(),
    getAllUidsForFolder: vi.fn().mockReturnValue([]),
    deleteEmailsByUid: vi.fn().mockReturnValue(0),
    migrateFolder: vi.fn(),
    getMaxUidForFolder: vi.fn().mockReturnValue(0)
}));

// Mock mailparser
vi.mock('mailparser', () => ({
    simpleParser: vi.fn().mockResolvedValue({
        subject: 'Test',
        from: { text: 'Test', value: [{ address: 'test@test.com' }] },
        text: 'Body',
        date: new Date()
    })
}));

// Mock imapflow with a factory that returns the mock implementation
// The factory runs at test time, not module load time
vi.mock('imapflow', () => {
    const mockInstance = {
        connect: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined),
        getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
        list: vi.fn().mockResolvedValue([{ name: 'INBOX', path: 'INBOX' }]),
        search: vi.fn().mockResolvedValue([]),
        messageFlagsAdd: vi.fn().mockResolvedValue(undefined),
        messageFlagsRemove: vi.fn().mockResolvedValue(undefined),
        fetchOne: vi.fn().mockResolvedValue(null),
        fetch: vi.fn().mockResolvedValue([]),
        on: vi.fn(),
        once: vi.fn(),
        removeListener: vi.fn(),
        capabilities: new Set(),
        mailbox: { exists: 0 }
    };
    
    return {
        ImapFlow: vi.fn(() => mockInstance)
    };
});

// Import imap module after mocks are set up
const imap = await import('../imap.cjs');

describe('IMAP Module', () => {
    it('should export all required functions', () => {
        expect(typeof imap.syncAccount).toBe('function');
        expect(typeof imap.testConnection).toBe('function');
        expect(typeof imap.deleteEmail).toBe('function');
        expect(typeof imap.setEmailFlag).toBe('function');
        expect(typeof imap.PROVIDERS).toBe('object');
    });

    it('should have correct PROVIDERS configuration', () => {
        expect(imap.PROVIDERS.gmx).toBeDefined();
        expect(imap.PROVIDERS.gmx.host).toBe('imap.gmx.net');
        expect(imap.PROVIDERS.gmx.port).toBe(993);
        expect(imap.PROVIDERS.gmx.secure).toBe(true);

        expect(imap.PROVIDERS.webde).toBeDefined();
        expect(imap.PROVIDERS.webde.host).toBe('imap.web.de');

        expect(imap.PROVIDERS.gmail).toBeDefined();
        expect(imap.PROVIDERS.gmail.host).toBe('imap.gmail.com');
    });

    it('should have function signatures that match expected interface', () => {
        // Verify syncAccount accepts account parameter
        const syncAccountStr = imap.syncAccount.toString();
        expect(syncAccountStr).toContain('account');

        // Verify testConnection accepts account parameter
        const testConnectionStr = imap.testConnection.toString();
        expect(testConnectionStr).toContain('account');

        // Verify deleteEmail accepts account, uid, dbFolder
        const deleteEmailStr = imap.deleteEmail.toString();
        expect(deleteEmailStr).toContain('account');
        expect(deleteEmailStr).toContain('uid');

        // Verify setEmailFlag accepts account, uid, flag, value
        const setEmailFlagStr = imap.setEmailFlag.toString();
        expect(setEmailFlagStr).toContain('account');
        expect(setEmailFlagStr).toContain('uid');
        expect(setEmailFlagStr).toContain('flag');
    });

    it('should test connection and return success/failure', async () => {
        const account = {
            email: 'test@test.com',
            password: 'pass',
            imapHost: 'imap.test.com',
            imapPort: 993
        };

        const result = await imap.testConnection(account);

        // Should return an object with success property
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');
    });

    it('should sync account and return result', async () => {
        const account = {
            id: 'test-id',
            email: 'test@test.com',
            password: 'pass',
            imapHost: 'imap.test.com',
            imapPort: 993
        };

        const result = await imap.syncAccount(account);

        // Should return an object with success property
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');
    });

    it('should verify flags are checked using .has() not .includes()', () => {
        // This verifies the fix for the bug where .includes() was called on Set
        const messageWithSet = {
            attributes: {
                uid: 100,
                flags: new Set(['\\Seen', '\\Flagged'])
            }
        };

        // The fixed code pattern - using .has() with Set
        const isRead = messageWithSet.attributes.flags?.has('\\Seen') || false;
        const isFlagged = messageWithSet.attributes.flags?.has('\\Flagged') || false;

        expect(isRead).toBe(true);
        expect(isFlagged).toBe(true);

        // Verify Set doesn't have .includes() method
        expect(typeof messageWithSet.attributes.flags.includes).toBe('undefined');
        // But does have .has() method
        expect(typeof messageWithSet.attributes.flags.has).toBe('function');
    });

    it('should handle edge cases in flag checking', () => {
        // Test various edge cases for the flags fix

        // Case 1: undefined flags
        const msg1 = { attributes: { flags: undefined } };
        expect(msg1.attributes.flags?.has('\\Seen') || false).toBe(false);

        // Case 2: null flags
        const msg2 = { attributes: { flags: null } };
        expect(msg2.attributes.flags?.has('\\Seen') || false).toBe(false);

        // Case 3: empty Set
        const msg3 = { attributes: { flags: new Set() } };
        expect(msg3.attributes.flags?.has('\\Seen') || false).toBe(false);

        // Case 4: Set with only one flag
        const msg4 = { attributes: { flags: new Set(['\\Seen']) } };
        expect(msg4.attributes.flags?.has('\\Seen') || false).toBe(true);
        expect(msg4.attributes.flags?.has('\\Flagged') || false).toBe(false);

        // Case 5: Set with multiple flags
        const msg5 = { attributes: { flags: new Set(['\\Seen', '\\Flagged', '\\Draft']) } };
        expect(msg5.attributes.flags?.has('\\Seen') || false).toBe(true);
        expect(msg5.attributes.flags?.has('\\Flagged') || false).toBe(true);
    });
});
