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
    return {
        ImapFlow: vi.fn().mockImplementation(() => ({
            connect: vi.fn().mockResolvedValue(undefined),
            logout: vi.fn().mockResolvedValue(undefined),
            getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
            list: vi.fn().mockResolvedValue([{ name: 'INBOX', path: 'INBOX' }]),
            search: vi.fn().mockResolvedValue([]),
            messageFlagsAdd: vi.fn().mockResolvedValue(undefined),
            messageFlagsRemove: vi.fn().mockResolvedValue(undefined),
            imap: {
                getQuotaRoot: vi.fn().mockImplementation((inbox, cb) => cb(null, {})),
                expunge: vi.fn().mockResolvedValue(undefined)
            },
            capabilities: new Set(),
            mailbox: { exists: 0 }
        }))
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
});
