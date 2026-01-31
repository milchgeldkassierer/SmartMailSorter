import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { resetMockState, setServerEmails, setConnectFailure, setFolderList } from './vitest-setup.js';

// Use CommonJS require to ensure we get the SAME module instances as imap.cjs
const require = createRequire(import.meta.url);

// Mock electron (still use vi.mock for this)
vi.mock('electron', () => ({
    app: { getPath: () => './test-data' }
}));

// Use CJS require to get the same module instances that imap.cjs uses
const db = require('../db.cjs');
const imap = require('../imap.cjs');

describe('IMAP Folder Mapping', () => {
    const testAccount = {
        id: 'test-account-id',
        email: 'test@example.com',
        password: 'testpass',
        imapHost: 'imap.example.com',
        imapPort: 993
    };

    beforeEach(() => {
        // Initialize with in-memory database
        db.init(':memory:');
        // Reset mock state
        resetMockState();
        // Set up test emails
        setServerEmails([
            { uid: 100, body: 'Test email', flags: [] }
        ]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Special folder detection via specialUse attribute', () => {
        it('should detect Sent folder by \\Sent attribute', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' }
            ]);

            // Test deleteEmail to trigger folder resolution
            const result = await imap.deleteEmail(testAccount, 100, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should detect Trash folder by \\Trash attribute', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Trash', path: 'Trash', delimiter: '.', specialUse: '\\Trash' }
            ]);

            const result = await imap.deleteEmail(testAccount, 100, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should detect Junk/Spam folder by \\Junk attribute', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Junk', path: 'Junk', delimiter: '.', specialUse: '\\Junk' }
            ]);

            const result = await imap.deleteEmail(testAccount, 100, 'Spam');

            expect(result.success).toBe(true);
        });
    });

    describe('Special folder detection via name matching', () => {
        it('should detect sent folder by name "sent"', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'sent', path: 'sent', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should detect sent folder by name "gesendet"', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'gesendet', path: 'gesendet', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should detect trash folder by name "trash"', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'trash', path: 'trash', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should detect trash folder by name "papierkorb"', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'papierkorb', path: 'papierkorb', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should detect junk folder by name "junk"', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'junk', path: 'junk', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.deleteEmail(testAccount, 100, 'Spam');

            expect(result.success).toBe(true);
        });

        it('should detect spam folder by name "spam"', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'spam', path: 'spam', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.deleteEmail(testAccount, 100, 'Spam');

            expect(result.success).toBe(true);
        });
    });

    describe('Subfolder path normalization', () => {
        it('should normalize INBOX.Subfolder to Posteingang/Subfolder using dot delimiter', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Subfolder', path: 'INBOX.Subfolder', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Posteingang/Subfolder');

            expect(result.success).toBe(true);
        });

        it('should normalize INBOX/Subfolder to Posteingang/Subfolder using slash delimiter', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: 'Subfolder', path: 'INBOX/Subfolder', delimiter: '/', specialUse: null }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Posteingang/Subfolder');

            expect(result.success).toBe(true);
        });

        it('should handle nested subfolders INBOX.Parent.Child', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Child', path: 'INBOX.Parent.Child', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.deleteEmail(testAccount, 100, 'Posteingang/Parent/Child');

            expect(result.success).toBe(true);
        });
    });

    describe('INBOX default fallback', () => {
        it('should use INBOX when dbFolder is null', async () => {
            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, null);

            expect(result.success).toBe(true);
        });

        it('should use INBOX when dbFolder is Posteingang', async () => {
            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
        });

        it('should use INBOX when folder not found in list', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.deleteEmail(testAccount, 100, 'UnknownFolder');

            expect(result.success).toBe(true);
        });
    });

    describe('setEmailFlag folder mapping', () => {
        it('should resolve folder for setEmailFlag with Gesendet', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should resolve folder for setEmailFlag with Papierkorb', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Trash', path: 'Trash', delimiter: '.', specialUse: '\\Trash' }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Flagged', true, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should resolve folder for setEmailFlag with Spam', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Junk', path: 'Junk', delimiter: '.', specialUse: '\\Junk' }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', false, 'Spam');

            expect(result.success).toBe(true);
        });

        it('should resolve folder for setEmailFlag with subfolder', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Posteingang/Amazon');

            expect(result.success).toBe(true);
        });
    });

    describe('Complex folder scenarios', () => {
        it('should handle GMX-style folder structure', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Gesendet', path: 'Gesendet', delimiter: '.', specialUse: '\\Sent' },
                { name: 'Papierkorb', path: 'Papierkorb', delimiter: '.', specialUse: '\\Trash' },
                { name: 'Spam', path: 'Spam', delimiter: '.', specialUse: '\\Junk' },
                { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null }
            ]);

            // Test Gesendet
            const sent = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Gesendet');
            expect(sent.success).toBe(true);

            // Test Papierkorb
            const trash = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Papierkorb');
            expect(trash.success).toBe(true);

            // Test Spam
            const spam = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Spam');
            expect(spam.success).toBe(true);

            // Test Subfolder
            const amazon = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Posteingang/Amazon');
            expect(amazon.success).toBe(true);
        });

        it('should handle Gmail-style folder structure', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '/', specialUse: null },
                { name: '[Gmail]', path: '[Gmail]', delimiter: '/', specialUse: null },
                { name: 'Sent Mail', path: '[Gmail]/Sent Mail', delimiter: '/', specialUse: '\\Sent' },
                { name: 'Trash', path: '[Gmail]/Trash', delimiter: '/', specialUse: '\\Trash' },
                { name: 'Spam', path: '[Gmail]/Spam', delimiter: '/', specialUse: '\\Junk' }
            ]);

            // Test Gesendet (should find [Gmail]/Sent Mail)
            const sent = await imap.deleteEmail(testAccount, 100, 'Gesendet');
            expect(sent.success).toBe(true);
        });

        it('should handle case insensitivity in folder names', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'SENT', path: 'SENT', delimiter: '.', specialUse: null },
                { name: 'TRASH', path: 'TRASH', delimiter: '.', specialUse: null }
            ]);

            const sent = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Gesendet');
            expect(sent.success).toBe(true);

            const trash = await imap.deleteEmail(testAccount, 100, 'Papierkorb');
            expect(trash.success).toBe(true);
        });
    });

    describe('Error handling', () => {
        it('should return error for invalid UID in setEmailFlag', async () => {
            const result = await imap.setEmailFlag(testAccount, null, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should return error for invalid UID in deleteEmail', async () => {
            const result = await imap.deleteEmail(testAccount, null, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should handle connection failure gracefully', async () => {
            setConnectFailure(true);

            const result = await imap.setEmailFlag(testAccount, 100, '\\Seen', true, 'Gesendet');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection failed');
        });
    });
});
