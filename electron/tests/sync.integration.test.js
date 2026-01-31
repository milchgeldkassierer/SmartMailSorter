import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { createRequire } from 'module';
import path from 'path';

// Setup mock state before any imports
const mockState = {
    serverEmails: [],
    shouldFailConnect: false,
    shouldFailFetch: false,
    parseErrorUids: new Set(),
    missingBodyUids: new Set()
};

// Helper to set server emails
function setServerEmails(emails) {
    mockState.serverEmails = emails.map(e => {
        let body = e.body || '';
        // Add UID marker if not already present (for parse error detection)
        if (!body.includes('UID:')) {
            body = `UID:${e.uid}\n${body}`;
        }
        return {
            uid: e.uid,
            subject: e.subject || '(No Subject)',
            from: e.from || 'test@example.com',
            body: body,
            date: e.date || new Date().toISOString(),
            flags: e.flags instanceof Set ? e.flags : new Set(e.flags || [])
        };
    });
}

function resetMockState() {
    mockState.serverEmails = [];
    mockState.shouldFailConnect = false;
    mockState.shouldFailFetch = false;
    mockState.parseErrorUids = new Set();
    mockState.missingBodyUids = new Set();
}

// Mock ImapFlow class
class MockImapFlow {
    constructor(config) {
        this.config = config;
    }

    async connect() {
        if (mockState.shouldFailConnect) {
            throw new Error('Connection failed');
        }
    }

    async logout() {}

    async list() {
        return [{ name: 'INBOX', path: 'INBOX', specialUse: null }];
    }

    async getMailboxLock(path) {
        mockState.currentMailbox = { exists: mockState.serverEmails.length, name: path };
        return {
            release: () => { mockState.currentMailbox = null; }
        };
    }

    async messageFlagsAdd(uid, flags) {
        const email = mockState.serverEmails.find(e => e.uid === uid);
        if (email) {
            // Ensure flags is a Set
            if (!(email.flags instanceof Set)) {
                email.flags = new Set(email.flags || []);
            }
            flags.forEach(f => email.flags.add(f));
        }
    }

    async messageFlagsRemove(uid, flags) {
        const email = mockState.serverEmails.find(e => e.uid === uid);
        if (email) {
            // Ensure flags is a Set
            if (!(email.flags instanceof Set)) {
                email.flags = new Set(email.flags || []);
            }
            flags.forEach(f => email.flags.delete(f));
        }
    }

    // Modern ImapFlow fetch() API - returns async iterator
    async *fetch(range, options = {}) {
        // Check if fetch should fail
        if (mockState.shouldFailFetch) {
            throw new Error('Fetch failed');
        }

        const isUid = options.uid === true;
        const wantSource = options.source === true;

        // Parse range (can be "1:5", "1,2,3", etc.)
        let messages = [];

        if (isUid) {
            // Fetching by UIDs
            const uidList = range.split(',').map(u => parseInt(u.trim()));
            messages = mockState.serverEmails.filter(e => uidList.includes(e.uid));
        } else {
            // Fetching by sequence numbers (1-based)
            const parts = range.split(':');
            if (parts.length === 2) {
                const start = parseInt(parts[0]);
                const end = parts[1] === '*' ? mockState.serverEmails.length : parseInt(parts[1]);
                messages = mockState.serverEmails.slice(start - 1, end);
            } else {
                // Single number or comma-separated
                const seqList = range.split(',').map(s => parseInt(s.trim()));
                messages = seqList.map(seq => mockState.serverEmails[seq - 1]).filter(Boolean);
            }
        }

        // Yield each message
        for (const email of messages) {
            const msg = {
                uid: email.uid,
                flags: email.flags instanceof Set ? email.flags : new Set(email.flags || []),
                seq: mockState.serverEmails.indexOf(email) + 1
            };

            if (wantSource) {
                // Check if this UID should have missing body (simulate missing body parts error)
                if (mockState.missingBodyUids.has(email.uid)) {
                    // Don't add source property - this simulates missing body part
                    // The production code will see no 'source' and handle it as missing body
                } else {
                    // Return full email source as buffer
                    msg.source = Buffer.from(email.body || '');
                }
            }

            yield msg;
        }
    }

    // Modern ImapFlow getQuota() API
    async getQuota(mailbox) {
        return null; // No quota info in tests
    }

    // Modern ImapFlow messageDelete() API
    async messageDelete(range, options = {}) {
        const isUid = options.uid === true;
        const uid = isUid ? parseInt(range) : parseInt(range);

        // Remove from mockState.serverEmails
        const index = mockState.serverEmails.findIndex(e => e.uid === uid);
        if (index !== -1) {
            mockState.serverEmails.splice(index, 1);
        }
    }

    get capabilities() {
        return new Set(['IMAP4rev1', 'UIDPLUS']);
    }

    get mailbox() {
        return mockState.currentMailbox || { exists: 0 };
    }

    get imap() {
        return {
            seq: {
                fetch: (range, options) => {
                    const [start, end] = range.split(':').map(Number);
                    const emitter = new EventEmitter();
                    process.nextTick(() => {
                        for (let seq = start; seq <= end && seq <= mockState.serverEmails.length; seq++) {
                            const email = mockState.serverEmails[seq - 1];
                            if (email) {
                                emitter.emit('message', {
                                    on: (evt, cb) => {
                                        if (evt === 'attributes') cb({
                                            uid: email.uid,
                                            flags: email.flags instanceof Set ? email.flags : new Set(email.flags || [])
                                        });
                                    }
                                });
                            }
                        }
                        emitter.emit('end');
                    });
                    return emitter;
                }
            },
            fetch: (uids, options) => {
                const uidList = Array.isArray(uids) ? uids : [uids];
                const emitter = new EventEmitter();

                // Simulate fetch error if flag is set
                if (mockState.shouldFailFetch) {
                    setImmediate(() => {
                        emitter.emit('error', new Error('Fetch operation failed'));
                    });
                    return emitter;
                }

                // Process asynchronously to mimic real IMAP behavior
                setImmediate(() => {
                    let pendingMessages = 0;

                    for (const uid of uidList) {
                        const email = mockState.serverEmails.find(e => e.uid === uid);
                        if (email) {
                            pendingMessages++;
                            const msg = new EventEmitter();

                            // Emit the message event
                            emitter.emit('message', msg);

                            // Simulate async body streaming
                            setImmediate(() => {
                                // Check if this UID should have missing body
                                if (mockState.missingBodyUids.has(uid)) {
                                    // Skip body emission, go straight to attributes
                                    setImmediate(() => {
                                        msg.emit('attributes', {
                                            uid: email.uid,
                                            flags: email.flags instanceof Set ? email.flags : new Set(email.flags || [])
                                        });
                                        setImmediate(() => {
                                            msg.emit('end');
                                            pendingMessages--;
                                            if (pendingMessages === 0) {
                                                setImmediate(() => emitter.emit('end'));
                                            }
                                        });
                                    });
                                } else {
                                    const bodyStream = new EventEmitter();

                                    // Emit body first (as imapflow does)
                                    msg.emit('body', bodyStream, { which: '' });

                                    // Then stream the data
                                    setImmediate(() => {
                                        bodyStream.emit('data', Buffer.from(email.body));
                                        setImmediate(() => {
                                            bodyStream.emit('end');

                                            // After body ends, emit attributes
                                            setImmediate(() => {
                                                msg.emit('attributes', {
                                                    uid: email.uid,
                                                    flags: email.flags instanceof Set ? email.flags : new Set(email.flags || [])
                                                });

                                                // Finally, message ends
                                                setImmediate(() => {
                                                    msg.emit('end');
                                                    pendingMessages--;

                                                    // Only emit fetch end when all messages are done
                                                    if (pendingMessages === 0) {
                                                        setImmediate(() => emitter.emit('end'));
                                                    }
                                                });
                                            });
                                        });
                                    });
                                }
                            });
                        }
                    }

                    // If no messages found, emit end immediately
                    if (pendingMessages === 0) {
                        setImmediate(() => emitter.emit('end'));
                    }
                });

                return emitter;
            },
            getQuotaRoot: (inbox, cb) => process.nextTick(() => cb(null, null)),
            expunge: () => Promise.resolve()
        };
    }
}

// Register mock in Node's module cache before loading imap.cjs
const require = createRequire(import.meta.url);

// Manually inject the mock into the cache using a path that matches what imap.cjs will resolve
const mockPath = path.join(process.cwd(), 'node_modules', 'imapflow', 'lib', 'imap-flow.js');
require.cache[mockPath] = {
    id: mockPath,
    filename: mockPath,
    loaded: true,
    exports: { ImapFlow: MockImapFlow }
};

// Also inject at the package level
const mockPath2 = path.join(process.cwd(), 'node_modules', 'imapflow');
require.cache[mockPath2] = {
    id: mockPath2,
    filename: path.join(mockPath2, 'index.js'),
    loaded: true,
    exports: { ImapFlow: MockImapFlow }
};

// Mock electron before loading db
const electronPath = path.join(process.cwd(), 'node_modules', 'electron');
require.cache[electronPath] = {
    id: electronPath,
    filename: path.join(electronPath, 'index.js'),
    loaded: true,
    exports: {
        app: {
            getPath: () => './test-data'
        }
    }
};

// Mock mailparser - inject at both package and index level
const mailparserPath = path.join(process.cwd(), 'node_modules', 'mailparser');
const mailparserIndexPath = path.join(process.cwd(), 'node_modules', 'mailparser', 'index.js');

const mailparserMock = {
    simpleParser: (rawBody) => {
            // First extract basic fields to check for parse error condition
            const subjectMatch = rawBody.match(/Subject: (.+)/);
            const fromMatch = rawBody.match(/From: (.+)/);
            const dateMatch = rawBody.match(/Date: (.+)/);
            const bodyMatch = rawBody.match(/\r?\n\r?\n([\s\S]+)$/);
            const uidMatch = rawBody.match(/UID:(\d+)/);

            const subject = subjectMatch ? subjectMatch[1] : '(No Subject)';
            const from = fromMatch ? fromMatch[1] : 'test@example.com';
            const date = dateMatch ? new Date(dateMatch[1]) : new Date();
            const body = bodyMatch ? bodyMatch[1].trim() : '';
            const uid = uidMatch ? parseInt(uidMatch[1]) : null;

            // Simulate parse error - use both UID check and subject check for reliability
            if ((uid !== null && mockState.parseErrorUids.has(uid)) ||
                (subject && subject.includes('PARSE_ERROR_MARKER'))) {
                return Promise.reject(new Error(`Invalid email format${uid ? ` for UID ${uid}` : ''}`));
            }

            return Promise.resolve({
                subject,
                from: { text: from, value: [{ address: from.replace(/[<>]/g, '') }] },
                text: body,
                html: null,
                date,
                attachments: []
            });
        }
};

// Install at package level
require.cache[mailparserPath] = {
    id: mailparserPath,
    filename: path.join(mailparserPath, 'index.js'),
    loaded: true,
    exports: mailparserMock
};

// Also install at index.js level
require.cache[mailparserIndexPath] = {
    id: mailparserIndexPath,
    filename: mailparserIndexPath,
    loaded: true,
    exports: mailparserMock
};

// Now load the actual modules
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

describe('IMAP Sync Integration Tests', () => {
    beforeEach(() => {
        // Initialize with in-memory database
        db.init(':memory:');
        // Reset mock server state
        resetMockState();
    });

    describe('Connection Tests', () => {
        it('should successfully test connection to IMAP server', async () => {
            const account = createTestAccount({
                id: 'test-account-connection-success',
                email: 'connection@test.com'
            });

            addAccountToDb(account);

            const result = await imap.testConnection(account);

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should handle connection failure gracefully', async () => {
            mockState.shouldFailConnect = true;

            const account = createTestAccount({
                id: 'test-account-connection-failure',
                email: 'connectionfail@test.com'
            });

            addAccountToDb(account);

            const result = await imap.testConnection(account);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Connection failed');
        });

        it('should test connection with valid credentials', async () => {
            const account = createTestAccount({
                id: 'test-account-valid-creds',
                email: 'validcreds@test.com',
                username: 'validuser@test.com',
                password: 'validpass'
            });

            addAccountToDb(account);

            const result = await imap.testConnection(account);

            expect(result.success).toBe(true);
        });

        it('should return error for connection timeout', async () => {
            mockState.shouldFailConnect = true;

            const account = createTestAccount({
                id: 'test-account-timeout',
                email: 'timeout@test.com'
            });

            addAccountToDb(account);

            const result = await imap.testConnection(account);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('Basic Sync Flow', () => {
        it('should successfully sync an empty mailbox', async () => {
            setServerEmails([]);

            const account = createTestAccount({
                id: 'test-account-empty',
                email: 'empty@test.com'
            });

            // Add account to database first (foreign key constraint)
            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(0);

            const emails = db.getEmails(account.id);
            expect(emails).toHaveLength(0);
        });

        it('should sync a single email correctly', async () => {
            const emailDate = new Date('2024-01-15T10:30:00Z');
            setServerEmails([{
                uid: 1,
                subject: 'Test Email Subject',
                from: 'sender@example.com',
                body: `Subject: Test Email Subject
From: sender@example.com
Date: ${emailDate.toISOString()}

This is the email body content.`,
                date: emailDate.toISOString(),
                flags: ['\\Seen']
            }]);

            const account = createTestAccount({
                id: 'test-account-single',
                email: 'single@test.com'
            });

            // Add account to database first (foreign key constraint)
            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const emails = db.getEmails(account.id);
            expect(emails).toHaveLength(1);

            const savedEmail = emails[0];
            expect(savedEmail.subject).toBe('Test Email Subject');
            expect(savedEmail.senderEmail).toBe('sender@example.com');
            expect(savedEmail.uid).toBe(1);
            expect(savedEmail.isRead).toBe(true);
            expect(savedEmail.folder).toBe('Posteingang');
        });

        it('should sync multiple emails correctly', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'First Email',
                    from: 'sender1@example.com',
                    body: `Subject: First Email
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

First email body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Second Email',
                    from: 'sender2@example.com',
                    body: `Subject: Second Email
From: sender2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Second email body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: ['\\Seen', '\\Flagged']
                },
                {
                    uid: 3,
                    subject: 'Third Email',
                    from: 'sender3@example.com',
                    body: `Subject: Third Email
From: sender3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

Third email body`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ];
            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-multiple',
                email: 'multiple@test.com'
            });

            // Add account to database first (foreign key constraint)
            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(3);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(3);

            const emailByUid = (uid) => savedEmails.find(e => e.uid === uid);

            const firstEmail = emailByUid(1);
            expect(firstEmail.subject).toBe('First Email');
            expect(firstEmail.senderEmail).toBe('sender1@example.com');
            expect(firstEmail.isRead).toBe(false);
            expect(firstEmail.isFlagged).toBe(false);

            const secondEmail = emailByUid(2);
            expect(secondEmail.subject).toBe('Second Email');
            expect(secondEmail.senderEmail).toBe('sender2@example.com');
            expect(secondEmail.isRead).toBe(true);
            expect(secondEmail.isFlagged).toBe(true);

            const thirdEmail = emailByUid(3);
            expect(thirdEmail.subject).toBe('Third Email');
            expect(thirdEmail.senderEmail).toBe('sender3@example.com');
        });

        it('should preserve existing emails and only sync new ones', async () => {
            const account = createTestAccount({
                id: 'test-account-incremental',
                email: 'incremental@test.com'
            });

            // Add account to database first (foreign key constraint)
            addAccountToDb(account);

            setServerEmails([
                {
                    uid: 1,
                    subject: 'Existing Email 1',
                    from: 'existing1@example.com',
                    body: `Subject: Existing Email 1
From: existing1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Existing email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Existing Email 2',
                    from: 'existing2@example.com',
                    body: `Subject: Existing Email 2
From: existing2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Existing email 2 body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                }
            ]);

            const result1 = await imap.syncAccount(account);
            expect(result1.count).toBe(2);

            setServerEmails([
                {
                    uid: 1,
                    subject: 'Existing Email 1',
                    from: 'existing1@example.com',
                    body: `Subject: Existing Email 1
From: existing1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Existing email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Existing Email 2',
                    from: 'existing2@example.com',
                    body: `Subject: Existing Email 2
From: existing2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Existing email 2 body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'New Email 3',
                    from: 'new3@example.com',
                    body: `Subject: New Email 3
From: new3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

New email 3 body`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ]);

            const result2 = await imap.syncAccount(account);

            expect(result2.success).toBe(true);
            expect(result2.count).toBe(1);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(3);

            const newEmail = savedEmails.find(e => e.uid === 3);
            expect(newEmail).toBeDefined();
            expect(newEmail.subject).toBe('New Email 3');
        });
    });

    describe('Batch Processing', () => {
        it('should sync 100+ emails in batches correctly', async () => {
            // Generate 150 emails to test batch processing
            const emailCount = 150;
            const emails = [];

            for (let i = 1; i <= emailCount; i++) {
                const date = new Date('2024-01-15T10:00:00Z');
                date.setDate(date.getDate() + ((i - 1) % 30));
                const dateStr = date.toISOString();

                emails.push({
                    uid: i,
                    subject: `Batch Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Batch Email ${i}\nFrom: sender${i}@example.com\nDate: ${dateStr}\n\nEmail body ${i}`,
                    date: dateStr,
                    flags: i % 3 === 0 ? ['\\Seen'] : []
                });
            }

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-batch-150',
                email: 'batch150@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(150);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(150);

            // Verify all UIDs are present
            const savedUids = new Set(savedEmails.map(e => e.uid));
            for (let i = 1; i <= emailCount; i++) {
                expect(savedUids.has(i)).toBe(true);
            }

            // Verify email content
            const firstEmail = savedEmails.find(e => e.uid === 1);
            expect(firstEmail.subject).toBe('Batch Email 1');
            expect(firstEmail.senderEmail).toBe('sender1@example.com');

            const lastEmail = savedEmails.find(e => e.uid === 150);
            expect(lastEmail.subject).toBe('Batch Email 150');
            expect(lastEmail.senderEmail).toBe('sender150@example.com');

            // Verify read flags were correctly processed
            const readEmails = savedEmails.filter(e => e.isRead);
            expect(readEmails.length).toBe(50); // Every 3rd email (150/3 = 50)
        });

        it('should handle batch processing across sequence ranges (1:5000, 5001:10000)', async () => {
            // Create emails that span across typical batch boundaries
            // We test with 5200 emails which crosses the 5000 boundary
            const emailCount = 5200;
            const emails = [];

            for (let i = 1; i <= emailCount; i++) {
                emails.push({
                    uid: i,
                    subject: `Large Batch Email ${i}`,
                    from: `bulk${i}@example.com`,
                    body: `Subject: Large Batch Email ${i}\nFrom: bulk${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody ${i}`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-large-batch',
                email: 'largebatch@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(5200);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(5200);

            // Verify emails from both sides of the 5000 boundary
            const emailAt4999 = savedEmails.find(e => e.uid === 4999);
            expect(emailAt4999).toBeDefined();
            expect(emailAt4999.subject).toBe('Large Batch Email 4999');

            const emailAt5000 = savedEmails.find(e => e.uid === 5000);
            expect(emailAt5000).toBeDefined();
            expect(emailAt5000.subject).toBe('Large Batch Email 5000');

            const emailAt5001 = savedEmails.find(e => e.uid === 5001);
            expect(emailAt5001).toBeDefined();
            expect(emailAt5001.subject).toBe('Large Batch Email 5001');

            const emailAt5200 = savedEmails.find(e => e.uid === 5200);
            expect(emailAt5200).toBeDefined();
            expect(emailAt5200.subject).toBe('Large Batch Email 5200');
        });

        it('should handle incremental sync with batch processing for large mailboxes', async () => {
            // Start with 3000 emails
            const initialEmails = [];
            for (let i = 1; i <= 3000; i++) {
                initialEmails.push({
                    uid: i,
                    subject: `Initial Email ${i}`,
                    from: `initial${i}@example.com`,
                    body: `Subject: Initial Email ${i}\nFrom: initial${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody ${i}`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(initialEmails);

            const account = createTestAccount({
                id: 'test-account-incremental-large',
                email: 'incrementallarge@test.com'
            });

            addAccountToDb(account);

            // First sync - all 3000 emails
            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(3000);

            // Now add 200 more emails (simulating new arrivals)
            const updatedEmails = [...initialEmails];
            for (let i = 3001; i <= 3200; i++) {
                updatedEmails.push({
                    uid: i,
                    subject: `New Email ${i}`,
                    from: `new${i}@example.com`,
                    body: `Subject: New Email ${i}\nFrom: new${i}@example.com\nDate: ${new Date('2024-01-16T10:00:00Z').toISOString()}\n\nBody ${i}`,
                    date: new Date('2024-01-16T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(updatedEmails);

            // Second sync - only new emails
            const result2 = await imap.syncAccount(account);
            expect(result2.success).toBe(true);
            expect(result2.count).toBe(200);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(3200);

            // Verify both old and new emails are present
            const oldEmail = savedEmails.find(e => e.uid === 1);
            expect(oldEmail.subject).toBe('Initial Email 1');

            const newEmail = savedEmails.find(e => e.uid === 3200);
            expect(newEmail.subject).toBe('New Email 3200');
        });

        it('should handle batch processing with sparse UIDs', async () => {
            // Simulate a mailbox where some emails were deleted (sparse UIDs)
            // UIDs are not sequential: 1, 2, 5, 10, 50, 100, etc.
            const sparseUids = [1, 2, 5, 10, 50, 100, 500, 1000, 5000, 5100];
            const emails = sparseUids.map(uid => ({
                uid,
                subject: `Sparse Email ${uid}`,
                from: `sparse${uid}@example.com`,
                body: `Subject: Sparse Email ${uid}\nFrom: sparse${uid}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody ${uid}`,
                date: new Date('2024-01-15T10:00:00Z').toISOString(),
                flags: []
            }));

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-sparse',
                email: 'sparse@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(10);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(10);

            // Verify all sparse UIDs are present
            const savedUids = new Set(savedEmails.map(e => e.uid));
            for (const uid of sparseUids) {
                expect(savedUids.has(uid)).toBe(true);
            }

            // Verify specific sparse email
            const email5000 = savedEmails.find(e => e.uid === 5000);
            expect(email5000.subject).toBe('Sparse Email 5000');
        });
    });

    describe('Orphan Detection', () => {
        it('should delete local emails that are no longer on server', async () => {
            // Setup: Create local emails with UIDs 1, 2, 3
            const initialEmails = [
                {
                    uid: 1,
                    subject: 'Email 1',
                    from: 'sender1@example.com',
                    body: `Subject: Email 1
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Email 2',
                    from: 'sender2@example.com',
                    body: `Subject: Email 2
From: sender2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Email 2 body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'Email 3 - Will be deleted on server',
                    from: 'sender3@example.com',
                    body: `Subject: Email 3 - Will be deleted on server
From: sender3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

Email 3 body`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(initialEmails);

            const account = createTestAccount({
                id: 'test-account-orphan-1',
                email: 'orphan@test.com'
            });

            addAccountToDb(account);

            // First sync - all 3 emails should be saved locally
            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(3);

            const savedEmails1 = db.getEmails(account.id);
            expect(savedEmails1).toHaveLength(3);
            expect(savedEmails1.some(e => e.uid === 3)).toBe(true);

            // Simulate: Email with UID 3 deleted on server
            // Mock server returning only UIDs 1, 2
            setServerEmails([
                {
                    uid: 1,
                    subject: 'Email 1',
                    from: 'sender1@example.com',
                    body: `Subject: Email 1
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Email 2',
                    from: 'sender2@example.com',
                    body: `Subject: Email 2
From: sender2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Email 2 body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                }
            ]);

            // Second sync - should detect and delete orphaned email (UID 3)
            const result2 = await imap.syncAccount(account);
            expect(result2.success).toBe(true);
            expect(result2.count).toBe(0); // No new emails

            const savedEmails2 = db.getEmails(account.id);
            expect(savedEmails2).toHaveLength(2);

            // Verify email with UID 3 was deleted (orphaned)
            expect(savedEmails2.some(e => e.uid === 3)).toBe(false);

            // Verify emails 1 and 2 are preserved
            expect(savedEmails2.some(e => e.uid === 1)).toBe(true);
            expect(savedEmails2.some(e => e.uid === 2)).toBe(true);

            // Verify content of preserved emails
            const email1 = savedEmails2.find(e => e.uid === 1);
            expect(email1.subject).toBe('Email 1');

            const email2 = savedEmails2.find(e => e.uid === 2);
            expect(email2.subject).toBe('Email 2');
        });

        it('should delete multiple orphaned emails', async () => {
            // Setup: Create 5 local emails
            const initialEmails = [];
            for (let i = 1; i <= 5; i++) {
                initialEmails.push({
                    uid: i,
                    subject: `Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Email ${i}\nFrom: sender${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nEmail ${i} body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(initialEmails);

            const account = createTestAccount({
                id: 'test-account-orphan-multi',
                email: 'orphanmulti@test.com'
            });

            addAccountToDb(account);

            // First sync - all 5 emails should be saved locally
            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(5);

            // Simulate: Emails with UIDs 2 and 4 deleted on server
            setServerEmails([
                {
                    uid: 1,
                    subject: 'Email 1',
                    from: 'sender1@example.com',
                    body: `Subject: Email 1\nFrom: sender1@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nEmail 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'Email 3',
                    from: 'sender3@example.com',
                    body: `Subject: Email 3\nFrom: sender3@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nEmail 3 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 5,
                    subject: 'Email 5',
                    from: 'sender5@example.com',
                    body: `Subject: Email 5\nFrom: sender5@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nEmail 5 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                }
            ]);

            // Second sync - should detect and delete orphaned emails (UIDs 2 and 4)
            const result2 = await imap.syncAccount(account);
            expect(result2.success).toBe(true);
            expect(result2.count).toBe(0); // No new emails

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(3);

            // Verify orphaned emails were deleted
            expect(savedEmails.some(e => e.uid === 2)).toBe(false);
            expect(savedEmails.some(e => e.uid === 4)).toBe(false);

            // Verify preserved emails
            const savedUids = new Set(savedEmails.map(e => e.uid));
            expect(savedUids.has(1)).toBe(true);
            expect(savedUids.has(3)).toBe(true);
            expect(savedUids.has(5)).toBe(true);
        });

        it('should handle all emails being orphans except one', async () => {
            // Note: When server returns 0 emails, the sync code skips the folder
            // before orphan detection runs. This test verifies the case where
            // almost all emails are orphans (leaving 1 so folder sync runs).
            // Setup: Create 5 local emails
            const initialEmails = [];
            for (let i = 1; i <= 5; i++) {
                initialEmails.push({
                    uid: i,
                    subject: `Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Email ${i}\nFrom: sender${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nEmail ${i} body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(initialEmails);

            const account = createTestAccount({
                id: 'test-account-orphan-all',
                email: 'orphanall@test.com'
            });

            addAccountToDb(account);

            // First sync - all 5 emails should be saved locally
            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(5);

            // Simulate: 4 emails deleted on server, only 1 remains
            setServerEmails([{
                uid: 5,
                subject: 'Email 5',
                from: 'sender5@example.com',
                body: `Subject: Email 5\nFrom: sender5@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nEmail 5 body`,
                date: new Date('2024-01-15T10:00:00Z').toISOString(),
                flags: []
            }]);

            // Second sync - should delete 4 local emails as orphans
            const result2 = await imap.syncAccount(account);
            expect(result2.success).toBe(true);
            expect(result2.count).toBe(0);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(1); // Only email 5 remains

            // Verify only the remaining email is preserved
            expect(savedEmails[0].uid).toBe(5);
            expect(savedEmails[0].subject).toBe('Email 5');
        });

        it('should handle orphan detection with new emails added simultaneously', async () => {
            // Setup: Create 3 local emails
            const initialEmails = [
                {
                    uid: 1,
                    subject: 'Email 1 - Keep',
                    from: 'sender1@example.com',
                    body: `Subject: Email 1 - Keep
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Email 2 - Delete',
                    from: 'sender2@example.com',
                    body: `Subject: Email 2 - Delete
From: sender2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Email 2 body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'Email 3 - Keep',
                    from: 'sender3@example.com',
                    body: `Subject: Email 3 - Keep
From: sender3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

Email 3 body`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(initialEmails);

            const account = createTestAccount({
                id: 'test-account-orphan-mixed',
                email: 'orphanmixed@test.com'
            });

            addAccountToDb(account);

            // First sync - all 3 emails should be saved locally
            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(3);

            // Simulate:
            // - Email with UID 2 deleted on server
            // - New email with UID 4 added on server
            setServerEmails([
                {
                    uid: 1,
                    subject: 'Email 1 - Keep',
                    from: 'sender1@example.com',
                    body: `Subject: Email 1 - Keep
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'Email 3 - Keep',
                    from: 'sender3@example.com',
                    body: `Subject: Email 3 - Keep
From: sender3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

Email 3 body`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 4,
                    subject: 'Email 4 - New',
                    from: 'sender4@example.com',
                    body: `Subject: Email 4 - New
From: sender4@example.com
Date: ${new Date('2024-01-16T10:00:00Z').toISOString()}

Email 4 body`,
                    date: new Date('2024-01-16T10:00:00Z').toISOString(),
                    flags: []
                }
            ]);

            // Second sync - should delete orphaned email (UID 2) and add new email (UID 4)
            const result2 = await imap.syncAccount(account);
            expect(result2.success).toBe(true);
            expect(result2.count).toBe(1); // 1 new email added

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(3); // 3 total (deleted 1, added 1)

            // Verify orphaned email was deleted
            expect(savedEmails.some(e => e.uid === 2)).toBe(false);

            // Verify preserved emails are still there
            expect(savedEmails.some(e => e.uid === 1)).toBe(true);
            expect(savedEmails.some(e => e.uid === 3)).toBe(true);

            // Verify new email was added
            const newEmail = savedEmails.find(e => e.uid === 4);
            expect(newEmail).toBeDefined();
            expect(newEmail.subject).toBe('Email 4 - New');
        });

        it('should handle orphan detection with batch processing for large mailboxes', async () => {
            // Setup: Create 100 local emails
            const initialEmails = [];
            for (let i = 1; i <= 100; i++) {
                initialEmails.push({
                    uid: i,
                    subject: `Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Email ${i}\nFrom: sender${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nEmail ${i} body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(initialEmails);

            const account = createTestAccount({
                id: 'test-account-orphan-batch',
                email: 'orphanbatch@test.com'
            });

            addAccountToDb(account);

            // First sync - all 100 emails should be saved locally
            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(100);

            const savedEmails1 = db.getEmails(account.id);
            expect(savedEmails1).toHaveLength(100);

            // Simulate: Delete every 5th email on server (20 emails total)
            const remainingEmails = initialEmails.filter((e, idx) => (idx + 1) % 5 !== 0);
            setServerEmails(remainingEmails);

            // Second sync - should detect and delete 20 orphaned emails
            const result2 = await imap.syncAccount(account);
            expect(result2.success).toBe(true);
            expect(result2.count).toBe(0); // No new emails

            const savedEmails2 = db.getEmails(account.id);
            expect(savedEmails2).toHaveLength(80); // 100 - 20 = 80

            // Verify specific orphaned emails were deleted (UIDs 5, 10, 15, ...)
            for (let i = 5; i <= 100; i += 5) {
                expect(savedEmails2.some(e => e.uid === i)).toBe(false);
            }

            // Verify non-orphaned emails are preserved
            for (let i = 1; i <= 100; i++) {
                if (i % 5 !== 0) {
                    expect(savedEmails2.some(e => e.uid === i)).toBe(true);
                }
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle connection failures gracefully', async () => {
            mockState.shouldFailConnect = true;

            const account = createTestAccount({
                id: 'test-account-conn-fail',
                email: 'connfail@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Connection failed');

            const emails = db.getEmails(account.id);
            expect(emails).toHaveLength(0);
        });

        it('should handle parse errors for individual emails', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Valid Email 1',
                    from: 'sender1@example.com',
                    body: `Subject: Valid Email 1
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Valid email body 1`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Invalid Email - PARSE_ERROR_MARKER',
                    from: 'sender2@example.com',
                    body: `Subject: Invalid Email - PARSE_ERROR_MARKER
From: sender2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

This email will fail to parse`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'Valid Email 3',
                    from: 'sender3@example.com',
                    body: `Subject: Valid Email 3
From: sender3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

Valid email body 3`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(emails);
            mockState.parseErrorUids.add(2);

            const account = createTestAccount({
                id: 'test-account-parse-error',
                email: 'parseerror@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            // Count only includes successfully parsed emails, not error placeholders
            expect(result.count).toBe(2);

            const savedEmails = db.getEmails(account.id);
            // But database should have all 3 (including error placeholder)
            expect(savedEmails).toHaveLength(3);

            const email1 = savedEmails.find(e => e.uid === 1);
            expect(email1).toBeDefined();
            expect(email1.subject).toBe('Valid Email 1');
            expect(email1.sender).not.toBe('System Error');

            const email2 = savedEmails.find(e => e.uid === 2);
            expect(email2).toBeDefined();
            expect(email2.sender).toBe('System Error');
            expect(email2.senderEmail).toBe('error@local');
            expect(email2.subject).toContain('Error loading email UID 2');
            expect(email2.smartCategory).toBe('System Error');
            expect(email2.isRead).toBe(true);
            expect(email2.isFlagged).toBe(true);

            const email3 = savedEmails.find(e => e.uid === 3);
            expect(email3).toBeDefined();
            expect(email3.subject).toBe('Valid Email 3');
            expect(email3.sender).not.toBe('System Error');
        });

        it('should handle multiple parse errors in a batch', async () => {
            const emails = [];
            for (let i = 1; i <= 10; i++) {
                emails.push({
                    uid: i,
                    subject: `Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Email ${i}\nFrom: sender${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody ${i}`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(emails);
            mockState.parseErrorUids.add(2);
            mockState.parseErrorUids.add(5);
            mockState.parseErrorUids.add(8);

            const account = createTestAccount({
                id: 'test-account-multi-parse-error',
                email: 'multiparseerror@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            // Count only includes successfully parsed emails (7), not error placeholders (3)
            expect(result.count).toBe(7);

            const savedEmails = db.getEmails(account.id);
            // Database should have all 10 (7 valid + 3 error placeholders)
            expect(savedEmails).toHaveLength(10);

            const errorEmails = savedEmails.filter(e => e.sender === 'System Error');
            expect(errorEmails).toHaveLength(3);
            expect(errorEmails.map(e => e.uid).sort()).toEqual([2, 5, 8]);

            for (const errorEmail of errorEmails) {
                expect(errorEmail.senderEmail).toBe('error@local');
                expect(errorEmail.subject).toContain('Error loading email UID');
                expect(errorEmail.smartCategory).toBe('System Error');
                expect(errorEmail.isRead).toBe(true);
                expect(errorEmail.isFlagged).toBe(true);
            }

            const validEmails = savedEmails.filter(e => e.sender !== 'System Error');
            expect(validEmails).toHaveLength(7);
        });

        it('should handle emails with missing body parts', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Valid Email 1',
                    from: 'sender1@example.com',
                    body: `Subject: Valid Email 1
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Valid body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Missing Body Email',
                    from: 'sender2@example.com',
                    body: '',
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'Valid Email 3',
                    from: 'sender3@example.com',
                    body: `Subject: Valid Email 3
From: sender3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

Valid body 3`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(emails);
            mockState.missingBodyUids.add(2);

            const account = createTestAccount({
                id: 'test-account-missing-body',
                email: 'missingbody@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            // Count only includes successfully parsed emails (2), not error placeholders (1)
            expect(result.count).toBe(2);

            const savedEmails = db.getEmails(account.id);
            // Database should have all 3 (2 valid + 1 error placeholder)
            expect(savedEmails).toHaveLength(3);

            const email1 = savedEmails.find(e => e.uid === 1);
            expect(email1).toBeDefined();
            expect(email1.subject).toBe('Valid Email 1');

            const email2 = savedEmails.find(e => e.uid === 2);
            expect(email2).toBeDefined();
            expect(email2.sender).toBe('System Error');
            expect(email2.senderEmail).toBe('error@local');
            expect(email2.subject).toBe('Empty Body UID 2');
            expect(email2.smartCategory).toBe('System Error');
            expect(email2.isRead).toBe(true);
            expect(email2.isFlagged).toBe(false);

            const email3 = savedEmails.find(e => e.uid === 3);
            expect(email3).toBeDefined();
            expect(email3.subject).toBe('Valid Email 3');
        });

        it('should handle partial fetch failures', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Email 1',
                    from: 'sender1@example.com',
                    body: `Subject: Email 1
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Body 1`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-fetch-fail',
                email: 'fetchfail@test.com'
            });

            addAccountToDb(account);

            mockState.shouldFailFetch = true;

            const result = await imap.syncAccount(account);

            // Sync should complete successfully but save 0 emails due to fetch failure
            // The implementation is fault-tolerant and logs errors but doesn't fail the entire sync
            expect(result.success).toBe(true);
            expect(result.count).toBe(0);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(0);
        });

        it('should continue processing after parse errors', async () => {
            const batchSize = 20;
            const emails = [];
            for (let i = 1; i <= batchSize; i++) {
                emails.push({
                    uid: i,
                    subject: `Batch Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Batch Email ${i}\nFrom: sender${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody ${i}`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(emails);
            mockState.parseErrorUids.add(5);
            mockState.parseErrorUids.add(10);
            mockState.parseErrorUids.add(15);

            const account = createTestAccount({
                id: 'test-account-continue-after-error',
                email: 'continueerror@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            // Count only includes successfully parsed emails (17), not error placeholders (3)
            expect(result.count).toBe(17);

            const savedEmails = db.getEmails(account.id);
            // Database should have all 20 (17 valid + 3 error placeholders)
            expect(savedEmails).toHaveLength(20);

            const lastEmail = savedEmails.find(e => e.uid === 20);
            expect(lastEmail).toBeDefined();
            expect(lastEmail.subject).toBe('Batch Email 20');
            expect(lastEmail.sender).not.toBe('System Error');
        });

        it('should handle mixed errors (parse + missing body)', async () => {
            const emails = [];
            for (let i = 1; i <= 10; i++) {
                emails.push({
                    uid: i,
                    subject: `Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Email ${i}\nFrom: sender${i}@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody ${i}`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                });
            }

            setServerEmails(emails);
            mockState.parseErrorUids.add(3);
            mockState.parseErrorUids.add(7);
            mockState.missingBodyUids.add(5);

            const account = createTestAccount({
                id: 'test-account-mixed-errors',
                email: 'mixederrors@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            // Count only includes successfully parsed emails (7), not error placeholders (3)
            expect(result.count).toBe(7);

            const savedEmails = db.getEmails(account.id);
            // Database should have all 10 (7 valid + 3 error placeholders)
            expect(savedEmails).toHaveLength(10);

            const errorEmails = savedEmails.filter(e => e.sender === 'System Error');
            expect(errorEmails).toHaveLength(3);

            const parseErrors = errorEmails.filter(e => e.subject.includes('Error loading email'));
            expect(parseErrors).toHaveLength(2);
            expect(parseErrors.map(e => e.uid).sort()).toEqual([3, 7]);

            const missingBodyErrors = errorEmails.filter(e => e.subject.includes('Empty Body'));
            expect(missingBodyErrors).toHaveLength(1);
            expect(missingBodyErrors[0].uid).toBe(5);

            const validEmails = savedEmails.filter(e => e.sender !== 'System Error');
            expect(validEmails).toHaveLength(7);
        });

        it('should handle error placeholders in incremental sync', async () => {
            const initialEmails = [
                {
                    uid: 1,
                    subject: 'Email 1',
                    from: 'sender1@example.com',
                    body: `Subject: Email 1\nFrom: sender1@example.com\nDate: ${new Date('2024-01-15T10:00:00Z').toISOString()}\n\nBody 1`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(initialEmails);

            const account = createTestAccount({
                id: 'test-account-error-incremental',
                email: 'errorincremental@test.com'
            });

            addAccountToDb(account);

            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(1);

            const updatedEmails = [
                ...initialEmails,
                {
                    uid: 2,
                    subject: 'Email 2 - Parse Error',
                    from: 'sender2@example.com',
                    body: `Subject: Email 2 - Parse Error\nFrom: sender2@example.com\nDate: ${new Date('2024-01-15T11:00:00Z').toISOString()}\n\nBody 2`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'Email 3',
                    from: 'sender3@example.com',
                    body: `Subject: Email 3\nFrom: sender3@example.com\nDate: ${new Date('2024-01-15T12:00:00Z').toISOString()}\n\nBody 3`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(updatedEmails);
            mockState.parseErrorUids.add(2);

            const result2 = await imap.syncAccount(account);
            expect(result2.success).toBe(true);
            // Count only includes successfully parsed email (1), not error placeholder (1)
            expect(result2.count).toBe(1);

            const savedEmails = db.getEmails(account.id);
            // Database should have all 3 (2 valid + 1 error placeholder)
            expect(savedEmails).toHaveLength(3);

            const errorEmail = savedEmails.find(e => e.uid === 2);
            expect(errorEmail).toBeDefined();
            expect(errorEmail.sender).toBe('System Error');
            expect(errorEmail.senderEmail).toBe('error@local');
            expect(errorEmail.subject).toContain('Error loading email UID 2');

            const validEmail3 = savedEmails.find(e => e.uid === 3);
            expect(validEmail3).toBeDefined();
            expect(validEmail3.subject).toBe('Email 3');
            expect(validEmail3.sender).not.toBe('System Error');
        });
    });

    describe('Flag Operations', () => {
        it('should set read flag (\\Seen) on an email', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Unread Email',
                    from: 'sender@example.com',
                    body: `Subject: Unread Email
From: sender@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-flag-read',
                email: 'flagread@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);
            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const savedEmails = db.getEmails(account.id);
            const email = savedEmails.find(e => e.uid === 1);
            expect(email.isRead).toBe(false);

            const flagResult = await imap.setEmailFlag(account, 1, '\\Seen', true);
            expect(flagResult.success).toBe(true);

            const serverEmail = mockState.serverEmails.find(e => e.uid === 1);
            expect(serverEmail.flags).toContain('\\Seen');
        });

        it('should unset read flag (\\Seen) on an email', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Read Email',
                    from: 'sender@example.com',
                    body: `Subject: Read Email
From: sender@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: ['\\Seen']
                }
            ];

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-flag-unread',
                email: 'flagunread@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);
            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const savedEmails = db.getEmails(account.id);
            const email = savedEmails.find(e => e.uid === 1);
            expect(email.isRead).toBe(true);

            const flagResult = await imap.setEmailFlag(account, 1, '\\Seen', false);
            expect(flagResult.success).toBe(true);

            const serverEmail = mockState.serverEmails.find(e => e.uid === 1);
            expect(serverEmail.flags).not.toContain('\\Seen');
        });

        it('should set flagged flag (\\Flagged) on an email', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Unflagged Email',
                    from: 'sender@example.com',
                    body: `Subject: Unflagged Email
From: sender@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-flag-flagged',
                email: 'flagflagged@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);
            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const savedEmails = db.getEmails(account.id);
            const email = savedEmails.find(e => e.uid === 1);
            expect(email.isFlagged).toBe(false);

            const flagResult = await imap.setEmailFlag(account, 1, '\\Flagged', true);
            expect(flagResult.success).toBe(true);

            const serverEmail = mockState.serverEmails.find(e => e.uid === 1);
            expect(serverEmail.flags).toContain('\\Flagged');
        });

        it('should unset flagged flag (\\Flagged) on an email', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Flagged Email',
                    from: 'sender@example.com',
                    body: `Subject: Flagged Email
From: sender@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: ['\\Flagged']
                }
            ];

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-flag-unflagged',
                email: 'flagunflagged@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);
            expect(result.success).toBe(true);
            expect(result.count).toBe(1);

            const savedEmails = db.getEmails(account.id);
            const email = savedEmails.find(e => e.uid === 1);
            expect(email.isFlagged).toBe(true);

            const flagResult = await imap.setEmailFlag(account, 1, '\\Flagged', false);
            expect(flagResult.success).toBe(true);

            const serverEmail = mockState.serverEmails.find(e => e.uid === 1);
            expect(serverEmail.flags).not.toContain('\\Flagged');
        });

        it('should persist flag changes on server', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Test Email',
                    from: 'sender@example.com',
                    body: `Subject: Test Email
From: sender@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-flag-persist',
                email: 'flagpersist@test.com'
            });

            addAccountToDb(account);

            const result1 = await imap.syncAccount(account);
            expect(result1.success).toBe(true);
            expect(result1.count).toBe(1);

            const serverEmailBefore = mockState.serverEmails.find(e => e.uid === 1);
            expect(serverEmailBefore.flags).not.toContain('\\Seen');
            expect(serverEmailBefore.flags).not.toContain('\\Flagged');

            await imap.setEmailFlag(account, 1, '\\Seen', true);
            await imap.setEmailFlag(account, 1, '\\Flagged', true);

            const serverEmailAfter = mockState.serverEmails.find(e => e.uid === 1);
            expect(serverEmailAfter.flags).toContain('\\Seen');
            expect(serverEmailAfter.flags).toContain('\\Flagged');
        });

        it('should handle flag operations on multiple emails', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Email 1',
                    from: 'sender1@example.com',
                    body: `Subject: Email 1
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Email 2',
                    from: 'sender2@example.com',
                    body: `Subject: Email 2
From: sender2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Email 2 body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 3,
                    subject: 'Email 3',
                    from: 'sender3@example.com',
                    body: `Subject: Email 3
From: sender3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

Email 3 body`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: []
                }
            ];

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-flag-multiple',
                email: 'flagmultiple@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);
            expect(result.success).toBe(true);
            expect(result.count).toBe(3);

            await imap.setEmailFlag(account, 1, '\\Seen', true);
            await imap.setEmailFlag(account, 2, '\\Flagged', true);
            await imap.setEmailFlag(account, 3, '\\Seen', true);
            await imap.setEmailFlag(account, 3, '\\Flagged', true);

            const serverEmail1 = mockState.serverEmails.find(e => e.uid === 1);
            expect(serverEmail1.flags).toContain('\\Seen');
            expect(serverEmail1.flags).not.toContain('\\Flagged');

            const serverEmail2 = mockState.serverEmails.find(e => e.uid === 2);
            expect(serverEmail2.flags).not.toContain('\\Seen');
            expect(serverEmail2.flags).toContain('\\Flagged');

            const serverEmail3 = mockState.serverEmails.find(e => e.uid === 3);
            expect(serverEmail3.flags).toContain('\\Seen');
            expect(serverEmail3.flags).toContain('\\Flagged');
        });

        it('should handle flag operation with invalid UID', async () => {
            const account = createTestAccount({
                id: 'test-account-flag-invalid',
                email: 'flaginvalid@test.com'
            });

            addAccountToDb(account);

            const result = await imap.setEmailFlag(account, null, '\\Seen', true);
            expect(result.success).toBe(false);
            expect(result.error).toContain('No UID');
        });

        it('should correctly sync emails with mixed flag states', async () => {
            const emails = [
                {
                    uid: 1,
                    subject: 'Email 1 - Unread Unflagged',
                    from: 'sender1@example.com',
                    body: `Subject: Email 1 - Unread Unflagged
From: sender1@example.com
Date: ${new Date('2024-01-15T10:00:00Z').toISOString()}

Email 1 body`,
                    date: new Date('2024-01-15T10:00:00Z').toISOString(),
                    flags: []
                },
                {
                    uid: 2,
                    subject: 'Email 2 - Read Unflagged',
                    from: 'sender2@example.com',
                    body: `Subject: Email 2 - Read Unflagged
From: sender2@example.com
Date: ${new Date('2024-01-15T11:00:00Z').toISOString()}

Email 2 body`,
                    date: new Date('2024-01-15T11:00:00Z').toISOString(),
                    flags: ['\\Seen']
                },
                {
                    uid: 3,
                    subject: 'Email 3 - Unread Flagged',
                    from: 'sender3@example.com',
                    body: `Subject: Email 3 - Unread Flagged
From: sender3@example.com
Date: ${new Date('2024-01-15T12:00:00Z').toISOString()}

Email 3 body`,
                    date: new Date('2024-01-15T12:00:00Z').toISOString(),
                    flags: ['\\Flagged']
                },
                {
                    uid: 4,
                    subject: 'Email 4 - Read Flagged',
                    from: 'sender4@example.com',
                    body: `Subject: Email 4 - Read Flagged
From: sender4@example.com
Date: ${new Date('2024-01-15T13:00:00Z').toISOString()}

Email 4 body`,
                    date: new Date('2024-01-15T13:00:00Z').toISOString(),
                    flags: ['\\Seen', '\\Flagged']
                }
            ];

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-flag-mixed',
                email: 'flagmixed@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);
            expect(result.success).toBe(true);
            expect(result.count).toBe(4);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(4);

            const email1 = savedEmails.find(e => e.uid === 1);
            expect(email1.isRead).toBe(false);
            expect(email1.isFlagged).toBe(false);

            const email2 = savedEmails.find(e => e.uid === 2);
            expect(email2.isRead).toBe(true);
            expect(email2.isFlagged).toBe(false);

            const email3 = savedEmails.find(e => e.uid === 3);
            expect(email3.isRead).toBe(false);
            expect(email3.isFlagged).toBe(true);

            const email4 = savedEmails.find(e => e.uid === 4);
            expect(email4.isRead).toBe(true);
            expect(email4.isFlagged).toBe(true);
        });

        it('should sync 50+ emails with mixed flag states', async () => {
            const emailCount = 60;
            const emails = [];

            for (let i = 1; i <= emailCount; i++) {
                const date = new Date('2024-01-15T10:00:00Z');
                date.setMinutes(date.getMinutes() + i);
                const dateStr = date.toISOString();

                let flags = [];
                if (i % 4 === 0) {
                    flags = ['\\Seen', '\\Flagged'];
                } else if (i % 3 === 0) {
                    flags = ['\\Seen'];
                } else if (i % 2 === 0) {
                    flags = ['\\Flagged'];
                }

                emails.push({
                    uid: i,
                    subject: `Mixed State Email ${i}`,
                    from: `sender${i}@example.com`,
                    body: `Subject: Mixed State Email ${i}
From: sender${i}@example.com
Date: ${dateStr}

Email body content ${i}`,
                    date: dateStr,
                    flags: flags
                });
            }

            setServerEmails(emails);

            const account = createTestAccount({
                id: 'test-account-mixed-batch',
                email: 'mixedbatch@test.com'
            });

            addAccountToDb(account);

            const result = await imap.syncAccount(account);

            expect(result.success).toBe(true);
            expect(result.count).toBe(60);

            const savedEmails = db.getEmails(account.id);
            expect(savedEmails).toHaveLength(60);

            const unreadUnflagged = savedEmails.filter(e => !e.isRead && !e.isFlagged);
            const unreadFlagged = savedEmails.filter(e => !e.isRead && e.isFlagged);
            const readUnflagged = savedEmails.filter(e => e.isRead && !e.isFlagged);
            const readFlagged = savedEmails.filter(e => e.isRead && e.isFlagged);

            expect(unreadUnflagged.length).toBeGreaterThan(0);
            expect(unreadFlagged.length).toBeGreaterThan(0);
            expect(readUnflagged.length).toBeGreaterThan(0);
            expect(readFlagged.length).toBeGreaterThan(0);

            expect(unreadUnflagged.length + unreadFlagged.length + readUnflagged.length + readFlagged.length).toBe(60);

            const email1 = savedEmails.find(e => e.uid === 1);
            expect(email1.subject).toBe('Mixed State Email 1');
            expect(email1.isRead).toBe(false);
            expect(email1.isFlagged).toBe(false);

            const email2 = savedEmails.find(e => e.uid === 2);
            expect(email2.isRead).toBe(false);
            expect(email2.isFlagged).toBe(true);

            const email3 = savedEmails.find(e => e.uid === 3);
            expect(email3.isRead).toBe(true);
            expect(email3.isFlagged).toBe(false);

            const email4 = savedEmails.find(e => e.uid === 4);
            expect(email4.isRead).toBe(true);
            expect(email4.isFlagged).toBe(true);

            const email60 = savedEmails.find(e => e.uid === 60);
            expect(email60).toBeDefined();
            expect(email60.subject).toBe('Mixed State Email 60');
            expect(email60.isRead).toBe(true);
            expect(email60.isFlagged).toBe(true);
        });
    });
});
