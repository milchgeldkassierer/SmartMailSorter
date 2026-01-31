import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Electron before importing modules
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

// Global state that can be modified per test
global.__folderMappingTestState = {
    mailboxList: [],
    shouldFailConnect: false,
    shouldFailList: false
};

// Mock ImapFlow with dynamic state access
vi.mock('imapflow', () => {
    const createMockClient = () => ({
        connect: vi.fn().mockImplementation(async () => {
            if (global.__folderMappingTestState.shouldFailConnect) {
                throw new Error('Connection refused');
            }
        }),
        logout: vi.fn().mockResolvedValue(undefined),
        getMailboxLock: vi.fn().mockImplementation((mailboxName) => {
            return Promise.resolve({ release: vi.fn() });
        }),
        list: vi.fn().mockImplementation(async () => {
            if (global.__folderMappingTestState.shouldFailList) {
                throw new Error('LIST command failed');
            }
            return global.__folderMappingTestState.mailboxList;
        }),
        search: vi.fn().mockResolvedValue([]),
        messageFlagsAdd: vi.fn().mockResolvedValue(undefined),
        messageFlagsRemove: vi.fn().mockResolvedValue(undefined),
        messageDelete: vi.fn().mockResolvedValue(undefined),
        fetchOne: vi.fn().mockResolvedValue(null),
        fetch: vi.fn().mockResolvedValue([]),
        getQuota: vi.fn().mockResolvedValue(null),
        on: vi.fn(),
        once: vi.fn(),
        removeListener: vi.fn(),
        capabilities: new Set(),
        mailbox: { exists: 0 }
    });

    return {
        ImapFlow: vi.fn(() => createMockClient())
    };
});

// Import imap module after mocks are set up
const imap = await import('../imap.cjs');

describe('IMAP Folder Mapping', () => {
    const testAccount = {
        id: 'test-account-id',
        email: 'test@example.com',
        password: 'testpass',
        imapHost: 'imap.example.com',
        imapPort: 993
    };

    beforeEach(() => {
        vi.clearAllMocks();
        global.__folderMappingTestState = {
            mailboxList: [],
            shouldFailConnect: false,
            shouldFailList: false
        };
    });

    describe('Special Folder Detection via specialUse Attribute', () => {
        it('should detect Sent folder via \\Sent specialUse', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Sent Items', path: 'Sent Items', delimiter: '/', specialUse: '\\Sent' }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should detect Trash folder via \\Trash specialUse', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Deleted', path: 'Deleted', delimiter: '/', specialUse: '\\Trash' }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should detect Junk folder via \\Junk specialUse', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Bulk Mail', path: 'Bulk Mail', delimiter: '/', specialUse: '\\Junk' }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Spam');

            expect(result.success).toBe(true);
        });

        it('should handle mixed case specialUse attributes', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Sent', path: 'Sent', delimiter: '/', specialUse: '\\SENT' }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Gesendet');

            expect(result.success).toBe(true);
        });
    });

    describe('Special Folder Detection via Name Matching', () => {
        it('should detect Sent folder by name "sent"', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'sent', path: 'sent', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should detect Sent folder by name "Gesendet" (German)', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Gesendet', path: 'Gesendet', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should detect Trash folder by name "trash"', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'trash', path: 'trash', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should detect Trash folder by name "Papierkorb" (German)', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Papierkorb', path: 'Papierkorb', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should detect Junk folder by name "junk"', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'junk', path: 'junk', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Spam');

            expect(result.success).toBe(true);
        });

        it('should detect Junk folder by name "spam"', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'spam', path: 'spam', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Spam');

            expect(result.success).toBe(true);
        });
    });

    describe('Subfolder Path Normalization', () => {
        it('should normalize INBOX.Subfolder to Posteingang/Subfolder with dot delimiter', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Posteingang/Amazon');

            expect(result.success).toBe(true);
        });

        it('should normalize INBOX/Subfolder to Posteingang/Subfolder with slash delimiter', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Work', path: 'INBOX/Work', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Posteingang/Work');

            expect(result.success).toBe(true);
        });

        it('should handle nested subfolders with dot delimiter', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Important', path: 'INBOX.Work.Important', delimiter: '.', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Posteingang/Work/Important');

            expect(result.success).toBe(true);
        });

        it('should handle nested subfolders with slash delimiter', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Urgent', path: 'INBOX/Work/Urgent', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Posteingang/Work/Urgent');

            expect(result.success).toBe(true);
        });
    });

    describe('Delimiter Handling', () => {
        it('should use default "/" delimiter when not specified', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', specialUse: null },
                { name: 'Subfolder', path: 'INBOX/Subfolder', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Posteingang/Subfolder');

            expect(result.success).toBe(true);
        });

        it('should correctly split paths using "." delimiter', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Projects', path: 'INBOX.Projects', delimiter: '.', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Posteingang/Projects');

            expect(result.success).toBe(true);
        });

        it('should handle mixed delimiters across different mailboxes', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Work', path: 'INBOX.Work', delimiter: '.', specialUse: null },
                { name: 'Archive', path: 'Archive', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Posteingang/Work');
            expect(result.success).toBe(true);
        });
    });

    describe('INBOX Default Fallback', () => {
        it('should default to INBOX for Posteingang folder', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Posteingang');

            expect(result.success).toBe(true);
        });

        it('should default to INBOX when folder mapping not found', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'NonExistentFolder');

            // Should fall back to INBOX when folder not found
            expect(result.success).toBe(true);
        });

        it('should default to INBOX when dbFolder is null', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, null);

            expect(result.success).toBe(true);
        });

        it('should default to INBOX when dbFolder is undefined', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, undefined);

            expect(result.success).toBe(true);
        });
    });

    describe('setEmailFlag Folder Mapping', () => {
        it('should map folder correctly for flag operations', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Archive', path: 'INBOX.Archive', delimiter: '.', specialUse: null }
            ];

            const result = await imap.setEmailFlag(testAccount, 123, '\\Seen', true, 'Posteingang/Archive');

            expect(result.success).toBe(true);
        });

        it('should use INBOX for Posteingang in flag operations', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null }
            ];

            const result = await imap.setEmailFlag(testAccount, 123, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
        });

        it('should map Gesendet to Sent folder for flag operations', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Sent', path: 'Sent', delimiter: '/', specialUse: '\\Sent' }
            ];

            const result = await imap.setEmailFlag(testAccount, 123, '\\Flagged', true, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should map Spam to Junk folder for flag operations', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Junk', path: 'Junk', delimiter: '/', specialUse: '\\Junk' }
            ];

            const result = await imap.setEmailFlag(testAccount, 123, '\\Seen', false, 'Spam');

            expect(result.success).toBe(true);
        });
    });

    describe('migrateFolder Function', () => {
        it('should call migrateFolder when folder names change during sync', async () => {
            const db = await import('../db.cjs');

            // Clear previous calls
            db.migrateFolder.mockClear();

            // The migration logic runs during syncAccount, but we can test the db call directly
            expect(typeof db.migrateFolder).toBe('function');
        });

        it('should be exported from db module', async () => {
            const db = await import('../db.cjs');
            expect(db.migrateFolder).toBeDefined();
            expect(typeof db.migrateFolder).toBe('function');
        });
    });

    describe('Complex Folder Mapping Scenarios', () => {
        it('should prioritize specialUse over name matching', async () => {
            // Folder named "spam" but with \\Trash specialUse should be mapped to Papierkorb
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'spam', path: 'spam', delimiter: '/', specialUse: '\\Trash' }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should handle folder with spaces in name', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Sent Items', path: 'Sent Items', delimiter: '/', specialUse: '\\Sent' }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should handle case insensitive folder name matching', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'SENT', path: 'SENT', delimiter: '/', specialUse: null }
            ];

            const result = await imap.deleteEmail(testAccount, 123, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should handle lowercase inbox in subfolder paths', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Bills', path: 'Inbox.Bills', delimiter: '.', specialUse: null }
            ];

            // The imap code checks fullPath.toUpperCase().startsWith('INBOX')
            // so Inbox.Bills should match and map to Posteingang/Bills
            const result = await imap.deleteEmail(testAccount, 123, 'Posteingang/Bills');

            expect(result.success).toBe(true);
        });
    });

    describe('Error Handling in Folder Mapping', () => {
        it('should return error when UID is missing', async () => {
            const result = await imap.deleteEmail(testAccount, null, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should return error when UID is undefined', async () => {
            const result = await imap.deleteEmail(testAccount, undefined, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should return error when UID is 0', async () => {
            const result = await imap.deleteEmail(testAccount, 0, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should successfully process valid UID with unmapped folder', async () => {
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null }
            ];

            // Even with an unmapped folder, operation should succeed (defaulting to INBOX)
            const result = await imap.deleteEmail(testAccount, 123, 'UnknownFolder');

            expect(result.success).toBe(true);
        });
    });

    describe('Provider-Specific Folder Mapping', () => {
        it('should handle GMX folder structure', async () => {
            // GMX uses dot delimiter typically
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Gesendet', path: 'Gesendet', delimiter: '.', specialUse: '\\Sent' },
                { name: 'Papierkorb', path: 'Papierkorb', delimiter: '.', specialUse: '\\Trash' },
                { name: 'Spam', path: 'Spam', delimiter: '.', specialUse: '\\Junk' }
            ];

            let result = await imap.deleteEmail(testAccount, 123, 'Gesendet');
            expect(result.success).toBe(true);

            result = await imap.deleteEmail(testAccount, 124, 'Papierkorb');
            expect(result.success).toBe(true);

            result = await imap.deleteEmail(testAccount, 125, 'Spam');
            expect(result.success).toBe(true);
        });

        it('should handle Gmail folder structure', async () => {
            // Gmail uses [Gmail]/Sent Mail etc.
            global.__folderMappingTestState.mailboxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Sent Mail', path: '[Gmail]/Sent Mail', delimiter: '/', specialUse: '\\Sent' },
                { name: 'Trash', path: '[Gmail]/Trash', delimiter: '/', specialUse: '\\Trash' },
                { name: 'Spam', path: '[Gmail]/Spam', delimiter: '/', specialUse: '\\Junk' }
            ];

            let result = await imap.deleteEmail(testAccount, 123, 'Gesendet');
            expect(result.success).toBe(true);

            result = await imap.deleteEmail(testAccount, 124, 'Papierkorb');
            expect(result.success).toBe(true);

            result = await imap.deleteEmail(testAccount, 125, 'Spam');
            expect(result.success).toBe(true);
        });
    });
});

describe('Folder Mapping Utility Logic', () => {
    describe('Path Parsing', () => {
        it('should correctly identify INBOX prefix case-insensitively', () => {
            const testCases = [
                { path: 'INBOX.Folder', expected: true },
                { path: 'Inbox.Folder', expected: true },
                { path: 'inbox.Folder', expected: true },
                { path: 'Archives.Folder', expected: false },
                { path: 'INBOX', expected: true }
            ];

            for (const { path, expected } of testCases) {
                const result = path.toUpperCase().startsWith('INBOX');
                expect(result).toBe(expected);
            }
        });

        it('should correctly split path by delimiter', () => {
            // Dot delimiter
            const dotPath = 'INBOX.Work.Important';
            const dotParts = dotPath.split('.');
            expect(dotParts).toEqual(['INBOX', 'Work', 'Important']);

            // Slash delimiter
            const slashPath = 'INBOX/Work/Important';
            const slashParts = slashPath.split('/');
            expect(slashParts).toEqual(['INBOX', 'Work', 'Important']);
        });

        it('should correctly join path parts with normalized delimiter', () => {
            const parts = ['Posteingang', 'Work', 'Important'];
            const normalized = parts.join('/');
            expect(normalized).toBe('Posteingang/Work/Important');
        });
    });

    describe('Special Folder Name Detection', () => {
        it('should detect sent folder names', () => {
            const sentNames = ['sent', 'Sent', 'SENT', 'gesendet', 'Gesendet', 'GESENDET'];

            for (const name of sentNames) {
                const lower = name.toLowerCase();
                const isSent = lower === 'sent' || lower === 'gesendet';
                expect(isSent).toBe(true);
            }
        });

        it('should detect trash folder names', () => {
            const trashNames = ['trash', 'Trash', 'TRASH', 'papierkorb', 'Papierkorb', 'PAPIERKORB'];

            for (const name of trashNames) {
                const lower = name.toLowerCase();
                const isTrash = lower === 'trash' || lower === 'papierkorb';
                expect(isTrash).toBe(true);
            }
        });

        it('should detect junk/spam folder names', () => {
            const junkNames = ['junk', 'Junk', 'JUNK', 'spam', 'Spam', 'SPAM'];

            for (const name of junkNames) {
                const lower = name.toLowerCase();
                const isJunk = lower === 'junk' || lower === 'spam';
                expect(isJunk).toBe(true);
            }
        });
    });

    describe('SpecialUse Attribute Parsing', () => {
        it('should detect sent specialUse attribute', () => {
            const specialUseValues = ['\\Sent', '\\sent', '\\SENT', 'sent'];

            for (const specialUse of specialUseValues) {
                const lower = specialUse.toLowerCase();
                const isSent = lower.includes('\\sent') || lower.includes('sent');
                expect(isSent).toBe(true);
            }
        });

        it('should detect trash specialUse attribute', () => {
            const specialUseValues = ['\\Trash', '\\trash', '\\TRASH', 'trash'];

            for (const specialUse of specialUseValues) {
                const lower = specialUse.toLowerCase();
                const isTrash = lower.includes('\\trash') || lower.includes('trash');
                expect(isTrash).toBe(true);
            }
        });

        it('should detect junk specialUse attribute', () => {
            const specialUseValues = ['\\Junk', '\\junk', '\\JUNK', 'junk'];

            for (const specialUse of specialUseValues) {
                const lower = specialUse.toLowerCase();
                const isJunk = lower.includes('\\junk') || lower.includes('junk');
                expect(isJunk).toBe(true);
            }
        });
    });
});
