import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

// The vitest-setup.js file patches require() to intercept 'imapflow' imports
// Import helpers from setup to control mock state
import { resetMockState, setServerEmails, setConnectFailure, setFetchFailure } from './vitest-setup.js';

// Use CommonJS require to ensure we get the SAME module instances as imap.cjs
const require = createRequire(import.meta.url);

// Mock electron (still use vi.mock for this)
vi.mock('electron', () => ({
    app: { getPath: () => './test-data' }
}));

// Use CJS require to get the same module instances that imap.cjs uses
// This ensures db.init() affects the same db variable that saveEmail() uses
const db = require('../db.cjs');
const imap = require('../imap.cjs');

// Helper function to create test accounts
function createTestAccount(overrides = {}) {
    return {
        id: overrides.id || 'test-account-1',
        email: overrides.email || 'test@example.com',
        username: overrides.username || 'test@example.com',
        password: overrides.password || 'testpass',
        imapHost: overrides.imapHost || 'imap.test.com',
        imapPort: overrides.imapPort || 993,
        ...overrides
    };
}

// Helper to add account to database
function addAccountToDb(account) {
    db.addAccount({
        id: account.id,
        email: account.email,
        name: account.name || account.email,
        provider: account.provider || 'test',
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        username: account.username,
        password: account.password,
        color: account.color || '#000000'
    });
}

describe('IMAP Sync Edge Cases and Error Handling', () => {
    beforeEach(() => {
        // Initialize with in-memory database
        db.init(':memory:');
        // Reset mock server state
        resetMockState();
    });

    describe('Connection failure handling', () => {
        it('should return error when connection fails during sync', async () => {
            setConnectFailure(true);

            const account = createTestAccount({
                id: 'test-connection-fail',
                email: 'connfail@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection failed');
        });

        it('should return error when connection fails during testConnection', async () => {
            setConnectFailure(true);

            const account = createTestAccount({
                id: 'test-conn-test-fail',
                email: 'testconnfail@test.com'
            });

            const result = await imap.testConnection(account);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection failed');
        });

        it('should succeed after connection failure is cleared', async () => {
            setConnectFailure(true);
            const account = createTestAccount({ id: 'recover-test' });
            addAccountToDb(account);

            const failResult = await imap.syncAccount(account);
            expect(failResult.success).toBe(false);

            setConnectFailure(false);
            setServerEmails([]);
            const successResult = await imap.syncAccount(account);
            expect(successResult.success).toBe(true);
        });
    });

    describe('testConnection function', () => {
        it('should successfully test connection with valid account', async () => {
            const account = createTestAccount({
                id: 'test-connection-valid',
                email: 'valid@test.com'
            });

            const result = await imap.testConnection(account);

            expect(result.success).toBe(true);
        });

        it('should use account.username when available', async () => {
            const account = createTestAccount({
                id: 'test-username',
                email: 'user@test.com',
                username: 'custom_username'
            });

            const result = await imap.testConnection(account);

            expect(result.success).toBe(true);
        });

        it('should fallback to email when username not provided', async () => {
            const account = {
                id: 'test-no-username',
                email: 'user@test.com',
                password: 'secret',
                imapHost: 'imap.test.com',
                imapPort: 993
            };

            const result = await imap.testConnection(account);

            expect(result.success).toBe(true);
        });
    });

    describe('PROVIDERS configuration', () => {
        it('should export PROVIDERS object', () => {
            expect(imap.PROVIDERS).toBeDefined();
            expect(typeof imap.PROVIDERS).toBe('object');
        });

        it('should have gmx provider configuration', () => {
            expect(imap.PROVIDERS.gmx).toBeDefined();
            expect(imap.PROVIDERS.gmx.host).toBe('imap.gmx.net');
            expect(imap.PROVIDERS.gmx.port).toBe(993);
            expect(imap.PROVIDERS.gmx.secure).toBe(true);
        });

        it('should have webde provider configuration', () => {
            expect(imap.PROVIDERS.webde).toBeDefined();
            expect(imap.PROVIDERS.webde.host).toBe('imap.web.de');
            expect(imap.PROVIDERS.webde.port).toBe(993);
            expect(imap.PROVIDERS.webde.secure).toBe(true);
        });

        it('should have gmail provider configuration', () => {
            expect(imap.PROVIDERS.gmail).toBeDefined();
            expect(imap.PROVIDERS.gmail.host).toBe('imap.gmail.com');
            expect(imap.PROVIDERS.gmail.port).toBe(993);
            expect(imap.PROVIDERS.gmail.secure).toBe(true);
        });
    });

    describe('deleteEmail function', () => {
        beforeEach(() => {
            setServerEmails([
                { uid: 100, body: 'Test email 1', flags: [] },
                { uid: 200, body: 'Test email 2', flags: ['\\Seen'] }
            ]);
        });

        it('should return error when UID is not provided', async () => {
            const account = createTestAccount();

            const result = await imap.deleteEmail(account, null, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should return error when UID is 0', async () => {
            const account = createTestAccount();

            const result = await imap.deleteEmail(account, 0, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should successfully delete email from INBOX (Posteingang)', async () => {
            const account = createTestAccount({ id: 'delete-test' });
            addAccountToDb(account);

            const result = await imap.deleteEmail(account, 100, 'Posteingang');

            expect(result.success).toBe(true);
        });

        it('should handle delete when connection fails', async () => {
            setConnectFailure(true);
            const account = createTestAccount();

            const result = await imap.deleteEmail(account, 100, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection failed');
        });

        it('should handle delete with dbFolder null (defaults to INBOX)', async () => {
            const account = createTestAccount({ id: 'delete-null-folder' });
            addAccountToDb(account);

            const result = await imap.deleteEmail(account, 100, null);

            expect(result.success).toBe(true);
        });

        it('should handle delete with dbFolder undefined', async () => {
            const account = createTestAccount({ id: 'delete-undef-folder' });
            addAccountToDb(account);

            const result = await imap.deleteEmail(account, 100, undefined);

            expect(result.success).toBe(true);
        });
    });

    describe('setEmailFlag function', () => {
        beforeEach(() => {
            setServerEmails([
                { uid: 100, body: 'Test email 1', flags: [] },
                { uid: 200, body: 'Test email 2', flags: ['\\Seen'] }
            ]);
        });

        it('should return error when UID is not provided', async () => {
            const account = createTestAccount();

            const result = await imap.setEmailFlag(account, null, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should return error when UID is 0', async () => {
            const account = createTestAccount();

            const result = await imap.setEmailFlag(account, 0, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should successfully add flag in INBOX (Posteingang)', async () => {
            const account = createTestAccount({ id: 'flag-add-test' });
            addAccountToDb(account);

            const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);

            // Verify flag was added
            const email = global.__mockState.serverEmails.find(e => e.uid === 100);
            expect(email.flags.has('\\Seen')).toBe(true);
        });

        it('should successfully remove flag from email', async () => {
            const account = createTestAccount({ id: 'flag-remove-test' });
            addAccountToDb(account);

            const result = await imap.setEmailFlag(account, 200, '\\Seen', false, 'Posteingang');

            expect(result.success).toBe(true);

            // Verify flag was removed
            const email = global.__mockState.serverEmails.find(e => e.uid === 200);
            expect(email.flags.has('\\Seen')).toBe(false);
        });

        it('should handle setEmailFlag when connection fails', async () => {
            setConnectFailure(true);
            const account = createTestAccount();

            const result = await imap.setEmailFlag(account, 100, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection failed');
        });

        it('should handle setEmailFlag with dbFolder null (defaults to INBOX)', async () => {
            const account = createTestAccount({ id: 'flag-null-folder' });
            addAccountToDb(account);

            const result = await imap.setEmailFlag(account, 100, '\\Seen', true, null);

            expect(result.success).toBe(true);
        });

        it('should handle \\Flagged flag', async () => {
            const account = createTestAccount({ id: 'flagged-test' });
            addAccountToDb(account);

            const result = await imap.setEmailFlag(account, 100, '\\Flagged', true, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 100);
            expect(email.flags.has('\\Flagged')).toBe(true);
        });
    });

    describe('Sync with email reconciliation (deleted emails)', () => {
        it('should remove locally orphaned emails that no longer exist on server', async () => {
            const account = createTestAccount({
                id: 'reconcile-test',
                email: 'reconcile@test.com'
            });

            addAccountToDb(account);

            // First sync: 3 emails on server
            setServerEmails([
                { uid: 1, body: 'Subject: Email 1\nFrom: a@b.com\n\nBody 1', flags: [] },
                { uid: 2, body: 'Subject: Email 2\nFrom: a@b.com\n\nBody 2', flags: [] },
                { uid: 3, body: 'Subject: Email 3\nFrom: a@b.com\n\nBody 3', flags: [] }
            ]);

            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(3);

            let emails = db.getEmails(account.id);
            expect(emails).toHaveLength(3);

            // Second sync: Email 2 deleted from server
            setServerEmails([
                { uid: 1, body: 'Subject: Email 1\nFrom: a@b.com\n\nBody 1', flags: [] },
                { uid: 3, body: 'Subject: Email 3\nFrom: a@b.com\n\nBody 3', flags: [] }
            ]);

            const result2 = await imap.syncAccount(account);
            expect(result2.success).toBe(true);
            expect(result2.count).toBe(0); // No new emails

            // Verify local email was deleted
            emails = db.getEmails(account.id);
            expect(emails).toHaveLength(2);
            expect(emails.find(e => e.uid === 2)).toBeUndefined();
        });
    });

    describe('Email parsing edge cases', () => {
        it('should handle email without From header', async () => {
            const account = createTestAccount({
                id: 'no-from-test',
                email: 'nofrom@test.com'
            });

            addAccountToDb(account);

            setServerEmails([{
                uid: 1,
                body: `Subject: No From Header\nDate: ${new Date().toISOString()}\n\nThis email has no From header`,
                flags: []
            }]);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const emails = db.getEmails(account.id);
            expect(emails).toHaveLength(1);
            // Should have fallback sender
            expect(emails[0].sender).toBeDefined();
        });

        it('should handle email without Subject header', async () => {
            const account = createTestAccount({
                id: 'no-subject-test',
                email: 'nosubject@test.com'
            });

            addAccountToDb(account);

            setServerEmails([{
                uid: 1,
                body: `From: sender@example.com\nDate: ${new Date().toISOString()}\n\nThis email has no subject`,
                flags: []
            }]);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const emails = db.getEmails(account.id);
            expect(emails).toHaveLength(1);
            // Should have fallback subject
            expect(emails[0].subject).toBeDefined();
        });

        it('should handle email with UTF-8 content', async () => {
            const account = createTestAccount({
                id: 'utf8-test',
                email: 'utf8@test.com'
            });

            addAccountToDb(account);

            setServerEmails([{
                uid: 1,
                body: `Subject: =?UTF-8?Q?Hallo_W=C3=BCrld?=\nFrom: sender@example.com\nContent-Type: text/plain; charset=utf-8\n\nÄÖÜ äöü ß Привет мир 你好世界`,
                flags: []
            }]);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(1);
        });

        it('should handle empty mailbox', async () => {
            const account = createTestAccount({
                id: 'empty-mailbox-test',
                email: 'empty@test.com'
            });

            addAccountToDb(account);
            setServerEmails([]);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(0);
        });
    });

    describe('Flag status in synced emails', () => {
        it('should correctly sync \\Seen flag (isRead)', async () => {
            const account = createTestAccount({
                id: 'flag-seen-sync',
                email: 'seen@test.com'
            });

            addAccountToDb(account);

            setServerEmails([
                {
                    uid: 1,
                    body: `Subject: Unread Email\nFrom: a@b.com\n\nBody`,
                    flags: []
                },
                {
                    uid: 2,
                    body: `Subject: Read Email\nFrom: a@b.com\n\nBody`,
                    flags: ['\\Seen']
                }
            ]);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(2);

            const emails = db.getEmails(account.id);
            const unreadEmail = emails.find(e => e.uid === 1);
            const readEmail = emails.find(e => e.uid === 2);

            expect(unreadEmail.isRead).toBe(false);
            expect(readEmail.isRead).toBe(true);
        });

        it('should correctly sync \\Flagged flag (isFlagged)', async () => {
            const account = createTestAccount({
                id: 'flag-flagged-sync',
                email: 'flagged@test.com'
            });

            addAccountToDb(account);

            setServerEmails([
                {
                    uid: 1,
                    body: `Subject: Unflagged Email\nFrom: a@b.com\n\nBody`,
                    flags: []
                },
                {
                    uid: 2,
                    body: `Subject: Flagged Email\nFrom: a@b.com\n\nBody`,
                    flags: ['\\Flagged']
                }
            ]);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(2);

            const emails = db.getEmails(account.id);
            const unflaggedEmail = emails.find(e => e.uid === 1);
            const flaggedEmail = emails.find(e => e.uid === 2);

            expect(unflaggedEmail.isFlagged).toBe(false);
            expect(flaggedEmail.isFlagged).toBe(true);
        });

        it('should handle email with both \\Seen and \\Flagged', async () => {
            const account = createTestAccount({
                id: 'both-flags-sync',
                email: 'both@test.com'
            });

            addAccountToDb(account);

            setServerEmails([{
                uid: 1,
                body: `Subject: Both Flags\nFrom: a@b.com\n\nBody`,
                flags: ['\\Seen', '\\Flagged']
            }]);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const emails = db.getEmails(account.id);
            expect(emails[0].isRead).toBe(true);
            expect(emails[0].isFlagged).toBe(true);
        });
    });

    describe('Account authentication variations', () => {
        it('should use username field when provided', async () => {
            const account = createTestAccount({
                id: 'username-auth',
                email: 'user@example.com',
                username: 'custom_username'
            });

            addAccountToDb(account);
            setServerEmails([]);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
        });

        it('should fallback to email when username not provided', async () => {
            const account = {
                id: 'email-auth',
                email: 'user@example.com',
                password: 'password',
                imapHost: 'imap.example.com',
                imapPort: 993
            };

            addAccountToDb(account);
            setServerEmails([]);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
        });
    });

    describe('Large email batch handling', () => {
        it('should handle 100+ emails efficiently', async () => {
            const account = createTestAccount({
                id: 'large-batch-test',
                email: 'large@test.com'
            });

            addAccountToDb(account);

            const emails = [];
            for (let i = 1; i <= 100; i++) {
                emails.push({
                    uid: i,
                    body: `Subject: Email ${i}\nFrom: sender${i}@example.com\n\nBody content for email ${i}`,
                    flags: i % 2 === 0 ? ['\\Seen'] : []
                });
            }

            setServerEmails(emails);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(100);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(100);

            // Verify alternating read status
            const readEmails = savedEmails.filter(e => e.isRead);
            const unreadEmails = savedEmails.filter(e => !e.isRead);
            expect(readEmails.length).toBe(50);
            expect(unreadEmails.length).toBe(50);
        });
    });

    describe('Module exports', () => {
        it('should export syncAccount function', () => {
            expect(typeof imap.syncAccount).toBe('function');
        });

        it('should export testConnection function', () => {
            expect(typeof imap.testConnection).toBe('function');
        });

        it('should export deleteEmail function', () => {
            expect(typeof imap.deleteEmail).toBe('function');
        });

        it('should export setEmailFlag function', () => {
            expect(typeof imap.setEmailFlag).toBe('function');
        });

        it('should export PROVIDERS object', () => {
            expect(typeof imap.PROVIDERS).toBe('object');
        });
    });
});
