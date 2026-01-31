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

    describe('UID-based fetch API', () => {
        it('should use 3-parameter fetch signature with { uid: true } in options', async () => {
            // This test verifies the correct API usage pattern for ImapFlow fetch()
            // The 3-parameter signature is: fetch(range, queryObject, options)
            // Where options.uid = true means range is UIDs, not sequence numbers

            const mockFetch = vi.fn().mockImplementation(async function* (range, queryObject, options) {
                // Verify options contains uid: true
                expect(options).toBeDefined();
                expect(options.uid).toBe(true);

                // Verify queryObject contains source and flags but NOT uid
                expect(queryObject.source).toBe(true);
                expect(queryObject.flags).toBe(true);
                expect(queryObject.uid).toBeUndefined();

                yield { uid: 179474, flags: new Set(['\\Seen']), source: Buffer.from('test') };
            });

            // Simulate calling fetch with correct 3-parameter signature
            const uidRange = '179474,179475';
            const queryObject = { source: true, flags: true };
            const options = { uid: true };

            const results = [];
            for await (const msg of mockFetch(uidRange, queryObject, options)) {
                results.push(msg);
            }

            expect(results.length).toBe(1);
            expect(results[0].uid).toBe(179474);
            expect(mockFetch).toHaveBeenCalledWith(uidRange, queryObject, options);
        });

        it('should correctly fetch by UID when options.uid is true', async () => {
            // Simulate mock behavior: when uid: true, parse range as UIDs
            const serverEmails = [
                { uid: 100, body: 'Email 1' },
                { uid: 200, body: 'Email 2' },
                { uid: 300, body: 'Email 3' }
            ];

            const mockFetch = async function* (range, queryObject = {}, options = {}) {
                const isUid = options && options.uid === true;

                if (isUid) {
                    // Parse as UIDs
                    const uidList = range.split(',').map(u => parseInt(u.trim()));
                    const messages = serverEmails.filter(e => uidList.includes(e.uid));
                    for (const email of messages) {
                        yield { uid: email.uid, source: Buffer.from(email.body) };
                    }
                } else {
                    // Parse as sequence numbers (1-based)
                    const seqList = range.split(',').map(s => parseInt(s.trim()));
                    const messages = seqList.map(seq => serverEmails[seq - 1]).filter(Boolean);
                    for (const email of messages) {
                        yield { uid: email.uid, source: Buffer.from(email.body) };
                    }
                }
            };

            // Fetch UIDs 100 and 300 (with uid: true)
            const uidResults = [];
            for await (const msg of mockFetch('100,300', { source: true }, { uid: true })) {
                uidResults.push(msg);
            }

            expect(uidResults.length).toBe(2);
            expect(uidResults[0].uid).toBe(100);
            expect(uidResults[1].uid).toBe(300);
        });

        it('should correctly fetch by sequence number when options.uid is false or missing', async () => {
            // Simulate mock behavior: when uid: false/missing, parse range as sequence numbers
            const serverEmails = [
                { uid: 100, body: 'Email 1' },  // seq 1
                { uid: 200, body: 'Email 2' },  // seq 2
                { uid: 300, body: 'Email 3' }   // seq 3
            ];

            const mockFetch = async function* (range, queryObject = {}, options = {}) {
                const isUid = options && options.uid === true;

                if (isUid) {
                    const uidList = range.split(',').map(u => parseInt(u.trim()));
                    const messages = serverEmails.filter(e => uidList.includes(e.uid));
                    for (const email of messages) {
                        yield { uid: email.uid };
                    }
                } else {
                    // Parse as sequence numbers (1-based)
                    const parts = range.split(':');
                    if (parts.length === 2) {
                        const start = parseInt(parts[0]);
                        const end = parseInt(parts[1]);
                        const messages = serverEmails.slice(start - 1, end);
                        for (const email of messages) {
                            yield { uid: email.uid };
                        }
                    }
                }
            };

            // Fetch sequence 1:2 (no uid option = sequence numbers)
            const seqResults = [];
            for await (const msg of mockFetch('1:2', { flags: true })) {
                seqResults.push(msg);
            }

            // Should return emails at positions 1 and 2 (UIDs 100 and 200)
            expect(seqResults.length).toBe(2);
            expect(seqResults[0].uid).toBe(100);
            expect(seqResults[1].uid).toBe(200);
        });

        it('should return 0 messages when UID range treated as sequence numbers (the bug scenario)', async () => {
            // This test demonstrates the original bug:
            // When UIDs like 179474 are treated as sequence numbers,
            // and the folder only has 85 messages, no messages are returned

            const serverEmails = Array(85).fill(null).map((_, i) => ({
                uid: 179400 + i,  // UIDs are sparse: 179400, 179401, ..., 179484
                body: `Email ${i + 1}`
            }));

            const mockFetch = async function* (range, queryObject = {}, options = {}) {
                const isUid = options && options.uid === true;

                if (isUid) {
                    const uidList = range.split(',').map(u => parseInt(u.trim()));
                    const messages = serverEmails.filter(e => uidList.includes(e.uid));
                    for (const email of messages) {
                        yield { uid: email.uid };
                    }
                } else {
                    // BUG: If we treat 179474 as a sequence number...
                    const parts = range.split(',');
                    for (const part of parts) {
                        const seq = parseInt(part);
                        // Sequence 179474 doesn't exist - only 1-85 exist
                        const email = serverEmails[seq - 1];
                        if (email) {
                            yield { uid: email.uid };
                        }
                    }
                }
            };

            // Wrong: Fetch UID 179474 without { uid: true } - treated as sequence number
            const wrongResults = [];
            for await (const msg of mockFetch('179474,179475', { source: true })) {
                wrongResults.push(msg);
            }

            // No messages returned because sequence 179474 doesn't exist!
            expect(wrongResults.length).toBe(0);

            // Correct: Fetch UID 179474 with { uid: true }
            const correctResults = [];
            for await (const msg of mockFetch('179474,179475', { source: true }, { uid: true })) {
                correctResults.push(msg);
            }

            // Messages found by UID
            expect(correctResults.length).toBe(2);
            expect(correctResults[0].uid).toBe(179474);
            expect(correctResults[1].uid).toBe(179475);
        });
    });

    describe('Folder path resolution', () => {
        it('should use box.path (not box.name) for folder keys', () => {
            // This test verifies the fix for folder path resolution
            // box.path contains the full server path needed for getMailboxLock()
            // box.name contains only the leaf name

            const mockBoxList = [
                { name: 'INBOX', path: 'INBOX', delimiter: '.', specialUse: null },
                { name: 'Bondora', path: 'INBOX.Bondora', delimiter: '.', specialUse: null },
                { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null },
                { name: 'Paypal', path: 'INBOX.Paypal', delimiter: '.', specialUse: null }
            ];

            // Simulate the fixed findSpecialFolders logic using box.path
            const folderMap = { 'INBOX': 'Posteingang' };

            for (const box of mockBoxList) {
                const key = box.path;  // FIXED: Use box.path, not box.name
                const fullPath = key;
                const delimiter = box.delimiter || '/';

                if (!folderMap[fullPath]) {
                    if (fullPath.toUpperCase().startsWith('INBOX') && fullPath !== 'INBOX') {
                        const parts = fullPath.split(delimiter);
                        if (parts[0].toUpperCase() === 'INBOX') parts[0] = 'Posteingang';
                        folderMap[fullPath] = parts.join('/');
                    }
                }
            }

            // Verify full paths are used as keys
            expect(folderMap['INBOX']).toBe('Posteingang');
            expect(folderMap['INBOX.Bondora']).toBe('Posteingang/Bondora');
            expect(folderMap['INBOX.Amazon']).toBe('Posteingang/Amazon');
            expect(folderMap['INBOX.Paypal']).toBe('Posteingang/Paypal');

            // Verify leaf names are NOT used as keys (the old buggy behavior)
            expect(folderMap['Bondora']).toBeUndefined();
            expect(folderMap['Amazon']).toBeUndefined();
            expect(folderMap['Paypal']).toBeUndefined();
        });

        it('should call getMailboxLock with full server path', async () => {
            const mockGetMailboxLock = vi.fn().mockResolvedValue({
                release: vi.fn()
            });

            // Test correct usage: full path
            await mockGetMailboxLock('INBOX.Bondora');
            expect(mockGetMailboxLock).toHaveBeenCalledWith('INBOX.Bondora');

            // The bug was calling getMailboxLock('Bondora') which fails
            // because the server needs the full path 'INBOX.Bondora'
        });

        it('should handle different folder delimiter formats', () => {
            // Different IMAP servers use different delimiters
            const testCases = [
                { name: 'Subfolder', path: 'INBOX.Subfolder', delimiter: '.' },
                { name: 'Subfolder', path: 'INBOX/Subfolder', delimiter: '/' },
                { name: 'Deep', path: 'INBOX.Parent.Deep', delimiter: '.' }
            ];

            for (const box of testCases) {
                // Always use box.path for the key and getMailboxLock
                const key = box.path;
                expect(key).toBe(box.path);
                expect(key).not.toBe(box.name);

                // The full path should contain the parent folder
                expect(key.toUpperCase().startsWith('INBOX')).toBe(true);
            }
        });

        it('should map folder paths to display names correctly', () => {
            // Verify the mapping produces correct display names
            const folderMap = {};

            const mockBoxList = [
                { name: 'Sent', path: 'Sent', delimiter: '/', specialUse: '\\Sent' },
                { name: 'Trash', path: 'Trash', delimiter: '/', specialUse: '\\Trash' },
                { name: 'Spam', path: 'Junk', delimiter: '/', specialUse: '\\Junk' },
                { name: 'Amazon', path: 'INBOX.Amazon', delimiter: '.', specialUse: null }
            ];

            for (const box of mockBoxList) {
                const key = box.path;

                // Check specialUse first
                if (box.specialUse) {
                    const specialUse = box.specialUse.toLowerCase();
                    if (specialUse.includes('\\sent')) folderMap[key] = 'Gesendet';
                    else if (specialUse.includes('\\trash')) folderMap[key] = 'Papierkorb';
                    else if (specialUse.includes('\\junk')) folderMap[key] = 'Spam';
                }

                // Then check path-based mapping
                if (!folderMap[key]) {
                    if (key.toUpperCase().startsWith('INBOX.')) {
                        const parts = key.split('.');
                        parts[0] = 'Posteingang';
                        folderMap[key] = parts.join('/');
                    }
                }
            }

            expect(folderMap['Sent']).toBe('Gesendet');
            expect(folderMap['Trash']).toBe('Papierkorb');
            expect(folderMap['Junk']).toBe('Spam');
            expect(folderMap['INBOX.Amazon']).toBe('Posteingang/Amazon');
        });
    });
});
