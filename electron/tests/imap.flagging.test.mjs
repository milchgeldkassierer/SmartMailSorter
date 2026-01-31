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

describe('IMAP Flag Operations (setEmailFlag)', () => {
    const testAccount = {
        id: 'test-account-id',
        email: 'test@test.com',
        password: 'testpass',
        imapHost: 'imap.test.com',
        imapPort: 993
    };

    beforeEach(() => {
        // Initialize with in-memory database
        db.init(':memory:');
        // Reset mock server state
        resetMockState();
        // Set up test emails on the server with various flag states
        setServerEmails([
            { uid: 1001, body: 'Unread email', flags: [] },
            { uid: 1002, body: 'Read email', flags: ['\\Seen'] },
            { uid: 1003, body: 'Flagged email', flags: ['\\Flagged'] },
            { uid: 1004, body: 'Read and flagged', flags: ['\\Seen', '\\Flagged'] },
            { uid: 1005, body: 'All flags', flags: ['\\Seen', '\\Flagged', '\\Draft', '\\Answered'] }
        ]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('setEmailFlag function export and signature', () => {
        it('should export setEmailFlag function', () => {
            expect(typeof imap.setEmailFlag).toBe('function');
        });

        it('should have correct function signature with account, uid, flag, value, dbFolder parameters', () => {
            const setEmailFlagStr = imap.setEmailFlag.toString();
            expect(setEmailFlagStr).toContain('account');
            expect(setEmailFlagStr).toContain('uid');
            expect(setEmailFlagStr).toContain('flag');
            expect(setEmailFlagStr).toContain('value');
            expect(setEmailFlagStr).toContain('dbFolder');
        });
    });

    describe('Missing UID handling', () => {
        it('should return error when UID is null', async () => {
            const result = await imap.setEmailFlag(testAccount, null, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should return error when UID is undefined', async () => {
            const result = await imap.setEmailFlag(testAccount, undefined, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should return error when UID is 0', async () => {
            const result = await imap.setEmailFlag(testAccount, 0, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should return error when UID is empty string', async () => {
            const result = await imap.setEmailFlag(testAccount, '', '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should return error when UID is false', async () => {
            const result = await imap.setEmailFlag(testAccount, false, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('No UID');
        });

        it('should NOT return error for valid numeric UID', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
        });

        it('should NOT return error for string UID that represents a number', async () => {
            const result = await imap.setEmailFlag(testAccount, '1001', '\\Seen', true, 'Posteingang');

            // String "1001" is truthy, so UID check passes
            expect(result.success).toBe(true);
        });
    });

    describe('Add Seen flag (mark as read)', () => {
        it('should successfully add \\Seen flag to unread email', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();

            // Verify the flag was added in mock state
            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Seen')).toBe(true);
        });

        it('should handle adding \\Seen flag to already read email', async () => {
            const result = await imap.setEmailFlag(testAccount, 1002, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);

            // Flag should still be present
            const email = global.__mockState.serverEmails.find(e => e.uid === 1002);
            expect(email.flags.has('\\Seen')).toBe(true);
        });

        it('should not remove other flags when adding \\Seen', async () => {
            // Email 1003 has \\Flagged, add \\Seen
            const result = await imap.setEmailFlag(testAccount, 1003, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1003);
            expect(email.flags.has('\\Seen')).toBe(true);
            expect(email.flags.has('\\Flagged')).toBe(true); // Still has original flag
        });
    });

    describe('Remove Seen flag (mark as unread)', () => {
        it('should successfully remove \\Seen flag from read email', async () => {
            const result = await imap.setEmailFlag(testAccount, 1002, '\\Seen', false, 'Posteingang');

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();

            // Verify the flag was removed in mock state
            const email = global.__mockState.serverEmails.find(e => e.uid === 1002);
            expect(email.flags.has('\\Seen')).toBe(false);
        });

        it('should handle removing \\Seen flag from already unread email', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', false, 'Posteingang');

            expect(result.success).toBe(true);

            // Flag should still be absent
            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Seen')).toBe(false);
        });

        it('should not remove other flags when removing \\Seen', async () => {
            // Email 1004 has both \\Seen and \\Flagged
            const result = await imap.setEmailFlag(testAccount, 1004, '\\Seen', false, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1004);
            expect(email.flags.has('\\Seen')).toBe(false);
            expect(email.flags.has('\\Flagged')).toBe(true); // Other flag preserved
        });
    });

    describe('Add Flagged flag (star/important)', () => {
        it('should successfully add \\Flagged flag to unflagged email', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Flagged', true, 'Posteingang');

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();

            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Flagged')).toBe(true);
        });

        it('should handle adding \\Flagged flag to already flagged email', async () => {
            const result = await imap.setEmailFlag(testAccount, 1003, '\\Flagged', true, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1003);
            expect(email.flags.has('\\Flagged')).toBe(true);
        });

        it('should not remove other flags when adding \\Flagged', async () => {
            // Email 1002 has \\Seen, add \\Flagged
            const result = await imap.setEmailFlag(testAccount, 1002, '\\Flagged', true, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1002);
            expect(email.flags.has('\\Flagged')).toBe(true);
            expect(email.flags.has('\\Seen')).toBe(true); // Original flag preserved
        });
    });

    describe('Remove Flagged flag (unstar)', () => {
        it('should successfully remove \\Flagged flag from flagged email', async () => {
            const result = await imap.setEmailFlag(testAccount, 1003, '\\Flagged', false, 'Posteingang');

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();

            const email = global.__mockState.serverEmails.find(e => e.uid === 1003);
            expect(email.flags.has('\\Flagged')).toBe(false);
        });

        it('should handle removing \\Flagged flag from already unflagged email', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Flagged', false, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Flagged')).toBe(false);
        });

        it('should not remove other flags when removing \\Flagged', async () => {
            // Email 1004 has both \\Seen and \\Flagged
            const result = await imap.setEmailFlag(testAccount, 1004, '\\Flagged', false, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1004);
            expect(email.flags.has('\\Flagged')).toBe(false);
            expect(email.flags.has('\\Seen')).toBe(true); // Other flag preserved
        });
    });

    describe('Other IMAP flags', () => {
        it('should add \\Draft flag', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Draft', true, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Draft')).toBe(true);
        });

        it('should remove \\Draft flag', async () => {
            const result = await imap.setEmailFlag(testAccount, 1005, '\\Draft', false, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1005);
            expect(email.flags.has('\\Draft')).toBe(false);
        });

        it('should add \\Answered flag', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Answered', true, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Answered')).toBe(true);
        });

        it('should remove \\Answered flag', async () => {
            const result = await imap.setEmailFlag(testAccount, 1005, '\\Answered', false, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1005);
            expect(email.flags.has('\\Answered')).toBe(false);
        });

        it('should add \\Deleted flag', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Deleted', true, 'Posteingang');

            expect(result.success).toBe(true);

            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Deleted')).toBe(true);
        });
    });

    describe('Folder handling - INBOX (Posteingang)', () => {
        it('should set flag on email in INBOX with Posteingang folder name', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
        });

        it('should set flag when dbFolder is undefined (defaults to INBOX)', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, undefined);

            expect(result.success).toBe(true);
        });

        it('should set flag when dbFolder is null (defaults to INBOX)', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, null);

            expect(result.success).toBe(true);
        });

        it('should set flag when dbFolder is empty string (defaults to INBOX)', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, '');

            expect(result.success).toBe(true);
        });
    });

    describe('Subfolder handling', () => {
        it('should attempt flag operation on subfolder path (Posteingang/Subfolder)', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Subfolder', path: 'INBOX.Subfolder', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang/Subfolder');

            expect(result.success).toBe(true);
        });

        it('should attempt flag operation on nested subfolder (Posteingang/Parent/Child)', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Child', path: 'INBOX.Parent.Child', delimiter: '.', specialUse: null }
            ]);

            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang/Parent/Child');

            expect(result.success).toBe(true);
        });

        it('should handle special folder Gesendet', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Sent', path: 'Sent', delimiter: '.', specialUse: '\\Sent' }
            ]);

            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should handle special folder Papierkorb', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Trash', path: 'Trash', delimiter: '.', specialUse: '\\Trash' }
            ]);

            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should handle special folder Spam', async () => {
            setFolderList([
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Junk', path: 'Junk', delimiter: '.', specialUse: '\\Junk' }
            ]);

            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Spam');

            expect(result.success).toBe(true);
        });

        it('should handle arbitrary folder name', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'CustomFolder');

            expect(result.success).toBe(true);
        });
    });

    describe('Connection error handling', () => {
        it('should return error when connection fails', async () => {
            setConnectFailure(true);

            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection failed');
        });

        it('should reset and succeed after connection failure is cleared', async () => {
            setConnectFailure(true);
            const failResult = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');
            expect(failResult.success).toBe(false);

            setConnectFailure(false);
            const successResult = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');
            expect(successResult.success).toBe(true);
        });

        it('should return structured error response on connection failure', async () => {
            setConnectFailure(true);

            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');

            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('error');
            expect(typeof result.error).toBe('string');
        });
    });

    describe('UID edge cases', () => {
        it('should handle large UID values', async () => {
            setServerEmails([{ uid: 999999999, body: 'Large UID email', flags: [] }]);

            const result = await imap.setEmailFlag(testAccount, 999999999, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
        });

        it('should handle numeric string UID', async () => {
            const result = await imap.setEmailFlag(testAccount, '1001', '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
        });
    });

    describe('Account configuration', () => {
        it('should work with account using username field', async () => {
            const accountWithUsername = {
                ...testAccount,
                username: 'different_username'
            };

            const result = await imap.setEmailFlag(accountWithUsername, 1001, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
        });

        it('should work with account without username (uses email)', async () => {
            const accountWithoutUsername = {
                id: 'test-id',
                email: 'user@example.com',
                password: 'secret',
                imapHost: 'imap.example.com',
                imapPort: 993
            };

            const result = await imap.setEmailFlag(accountWithoutUsername, 1001, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
        });

        it('should work with custom IMAP port', async () => {
            const accountCustomPort = {
                ...testAccount,
                imapPort: 143 // Non-standard port
            };

            const result = await imap.setEmailFlag(accountCustomPort, 1001, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
        });
    });

    describe('Return value structure', () => {
        it('should return object with success:true on successful flag add', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');

            expect(result).toEqual({ success: true });
        });

        it('should return object with success:true on successful flag remove', async () => {
            const result = await imap.setEmailFlag(testAccount, 1002, '\\Seen', false, 'Posteingang');

            expect(result).toEqual({ success: true });
        });

        it('should return object with success:false and error on UID error', async () => {
            const result = await imap.setEmailFlag(testAccount, null, '\\Seen', true, 'Posteingang');

            expect(result).toEqual({ success: false, error: 'No UID' });
        });

        it('should return object with success:false and error message on connection error', async () => {
            setConnectFailure(true);
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');

            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('error');
            expect(typeof result.error).toBe('string');
        });
    });

    describe('Boolean value parameter', () => {
        it('should add flag when value is true', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');

            expect(result.success).toBe(true);
            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Seen')).toBe(true);
        });

        it('should remove flag when value is false', async () => {
            const result = await imap.setEmailFlag(testAccount, 1002, '\\Seen', false, 'Posteingang');

            expect(result.success).toBe(true);
            const email = global.__mockState.serverEmails.find(e => e.uid === 1002);
            expect(email.flags.has('\\Seen')).toBe(false);
        });

        it('should handle truthy value 1 as add', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', 1, 'Posteingang');

            expect(result.success).toBe(true);
            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Seen')).toBe(true);
        });

        it('should handle falsy value 0 as remove', async () => {
            const result = await imap.setEmailFlag(testAccount, 1002, '\\Seen', 0, 'Posteingang');

            expect(result.success).toBe(true);
            const email = global.__mockState.serverEmails.find(e => e.uid === 1002);
            expect(email.flags.has('\\Seen')).toBe(false);
        });
    });

    describe('Multiple sequential operations', () => {
        it('should handle multiple flag operations on same email', async () => {
            // Add \\Seen
            const result1 = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');
            expect(result1.success).toBe(true);

            // Add \\Flagged
            const result2 = await imap.setEmailFlag(testAccount, 1001, '\\Flagged', true, 'Posteingang');
            expect(result2.success).toBe(true);

            // Verify both flags are set
            const email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Seen')).toBe(true);
            expect(email.flags.has('\\Flagged')).toBe(true);
        });

        it('should handle toggle operations (add then remove)', async () => {
            // Add \\Seen
            const result1 = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');
            expect(result1.success).toBe(true);

            let email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Seen')).toBe(true);

            // Remove \\Seen
            const result2 = await imap.setEmailFlag(testAccount, 1001, '\\Seen', false, 'Posteingang');
            expect(result2.success).toBe(true);

            email = global.__mockState.serverEmails.find(e => e.uid === 1001);
            expect(email.flags.has('\\Seen')).toBe(false);
        });

        it('should handle flag operations on multiple emails', async () => {
            const result1 = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang');
            const result2 = await imap.setEmailFlag(testAccount, 1002, '\\Seen', false, 'Posteingang');
            const result3 = await imap.setEmailFlag(testAccount, 1003, '\\Flagged', false, 'Posteingang');

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(result3.success).toBe(true);
        });
    });
});
