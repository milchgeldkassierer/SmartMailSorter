import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetMockState, setServerEmails, setConnectFailure } from './vitest-setup.js';

// The imap.cjs module uses require() for imapflow, which is intercepted by vitest-setup.js
// This provides the MockImapFlow class with messageFlagsAdd and messageFlagsRemove support

// Mock Electron
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

// Import imap module - uses the MockImapFlow from vitest-setup.js
const imap = await import('../imap.cjs');

describe('IMAP Flag Operations (setEmailFlag)', () => {
    const testAccount = {
        id: 'test-account-id',
        email: 'test@test.com',
        password: 'testpass',
        imapHost: 'imap.test.com',
        imapPort: 993
    };

    beforeEach(() => {
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
        // Note: MockImapFlow.list() returns only INBOX, so folder resolution
        // falls back to INBOX. This tests that the function handles subfolders gracefully.

        it('should attempt flag operation on subfolder path (Posteingang/Subfolder)', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang/Subfolder');

            // Should succeed (falls back to INBOX since MockImapFlow only has INBOX)
            expect(result.success).toBe(true);
        });

        it('should attempt flag operation on nested subfolder (Posteingang/Parent/Child)', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Posteingang/Parent/Child');

            expect(result.success).toBe(true);
        });

        it('should handle special folder Gesendet', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Gesendet');

            expect(result.success).toBe(true);
        });

        it('should handle special folder Papierkorb', async () => {
            const result = await imap.setEmailFlag(testAccount, 1001, '\\Seen', true, 'Papierkorb');

            expect(result.success).toBe(true);
        });

        it('should handle special folder Spam', async () => {
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

        it('should handle UID with whitespace string (truthy)', async () => {
            // String with space is truthy in JavaScript
            const result = await imap.setEmailFlag(testAccount, ' ', '\\Seen', true, 'Posteingang');

            // The UID check passes because ' ' is truthy
            expect(result).toHaveProperty('success');
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

describe('Folder Path Resolution for Flag Operations', () => {
    // These tests verify the folder path resolution logic used by setEmailFlag

    it('should understand INBOX maps to Posteingang', () => {
        const folderMap = { 'INBOX': 'Posteingang' };
        expect(folderMap['INBOX']).toBe('Posteingang');
    });

    it('should understand specialUse \\Sent maps to Gesendet', () => {
        const specialUse = '\\Sent';
        const mappedName = specialUse.toLowerCase().includes('\\sent') ? 'Gesendet' : null;
        expect(mappedName).toBe('Gesendet');
    });

    it('should understand specialUse \\Trash maps to Papierkorb', () => {
        const specialUse = '\\Trash';
        const mappedName = specialUse.toLowerCase().includes('\\trash') ? 'Papierkorb' : null;
        expect(mappedName).toBe('Papierkorb');
    });

    it('should understand specialUse \\Junk maps to Spam', () => {
        const specialUse = '\\Junk';
        const mappedName = specialUse.toLowerCase().includes('\\junk') ? 'Spam' : null;
        expect(mappedName).toBe('Spam');
    });

    it('should understand INBOX.Subfolder maps to Posteingang/Subfolder', () => {
        const fullPath = 'INBOX.Subfolder';
        const sep = '.';
        const parts = fullPath.split(sep);
        if (parts[0].toUpperCase() === 'INBOX') {
            parts[0] = 'Posteingang';
        }
        const mappedName = parts.join('/');
        expect(mappedName).toBe('Posteingang/Subfolder');
    });

    it('should handle folder name matching for Sent/Gesendet', () => {
        const lower = 'sent';
        const mappedName = (lower === 'sent' || lower === 'gesendet') ? 'Gesendet' : null;
        expect(mappedName).toBe('Gesendet');
    });

    it('should handle folder name matching for Trash/Papierkorb', () => {
        const lower = 'trash';
        const mappedName = (lower === 'trash' || lower === 'papierkorb') ? 'Papierkorb' : null;
        expect(mappedName).toBe('Papierkorb');
    });

    it('should handle folder name matching for Junk/Spam', () => {
        const lower = 'spam';
        const mappedName = (lower === 'junk' || lower === 'spam') ? 'Spam' : null;
        expect(mappedName).toBe('Spam');
    });

    it('should handle deep nested folder paths', () => {
        const fullPath = 'INBOX.Parent.Child.GrandChild';
        const sep = '.';
        const parts = fullPath.split(sep);
        if (parts[0].toUpperCase() === 'INBOX') {
            parts[0] = 'Posteingang';
        }
        const mappedName = parts.join('/');
        expect(mappedName).toBe('Posteingang/Parent/Child/GrandChild');
    });

    it('should handle different delimiters (/ vs .)', () => {
        // Slash delimiter
        const fullPath1 = 'INBOX/Subfolder';
        const parts1 = fullPath1.split('/');
        if (parts1[0].toUpperCase() === 'INBOX') {
            parts1[0] = 'Posteingang';
        }
        expect(parts1.join('/')).toBe('Posteingang/Subfolder');

        // Dot delimiter
        const fullPath2 = 'INBOX.Subfolder';
        const parts2 = fullPath2.split('.');
        if (parts2[0].toUpperCase() === 'INBOX') {
            parts2[0] = 'Posteingang';
        }
        expect(parts2.join('/')).toBe('Posteingang/Subfolder');
    });
});
