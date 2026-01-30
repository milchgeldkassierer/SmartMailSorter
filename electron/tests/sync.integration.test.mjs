import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { createRequire } from 'module';
import path from 'path';

// Setup mock state before any imports
const mockState = {
    serverEmails: [],
    shouldFailConnect: false
};

// Helper to set server emails
function setServerEmails(emails) {
    mockState.serverEmails = emails.map(e => ({
        uid: e.uid,
        subject: e.subject || '(No Subject)',
        from: e.from || 'test@example.com',
        body: e.body || '',
        date: e.date || new Date().toISOString(),
        flags: e.flags || []
    }));
}

function resetMockState() {
    mockState.serverEmails = [];
    mockState.shouldFailConnect = false;
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
            flags.forEach(f => { if (!email.flags.includes(f)) email.flags.push(f); });
        }
    }

    async messageFlagsRemove(uid, flags) {
        const email = mockState.serverEmails.find(e => e.uid === uid);
        if (email) {
            email.flags = email.flags.filter(f => !flags.includes(f));
        }
    }

    // Modern ImapFlow fetch() API - returns async iterator
    async *fetch(range, options = {}) {
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
                flags: email.flags || [],
                seq: mockState.serverEmails.indexOf(email) + 1
            };

            if (wantSource) {
                // Return full email source as buffer
                msg.source = Buffer.from(email.body || '');
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
                                        if (evt === 'attributes') cb({ uid: email.uid, flags: email.flags });
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
                                            msg.emit('attributes', { uid: email.uid, flags: email.flags });

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

// Mock mailparser
const mailparserPath = path.join(process.cwd(), 'node_modules', 'mailparser');
require.cache[mailparserPath] = {
    id: mailparserPath,
    filename: path.join(mailparserPath, 'index.js'),
    loaded: true,
    exports: {
        simpleParser: (rawBody) => {
            const subjectMatch = rawBody.match(/Subject: (.+)/);
            const fromMatch = rawBody.match(/From: (.+)/);
            const dateMatch = rawBody.match(/Date: (.+)/);
            const bodyMatch = rawBody.match(/\r?\n\r?\n([\s\S]+)$/);

            const subject = subjectMatch ? subjectMatch[1] : '(No Subject)';
            const from = fromMatch ? fromMatch[1] : 'test@example.com';
            const date = dateMatch ? new Date(dateMatch[1]) : new Date();
            const body = bodyMatch ? bodyMatch[1].trim() : '';

            return Promise.resolve({
                subject,
                from: { text: from, value: [{ address: from.replace(/[<>]/g, '') }] },
                text: body,
                html: null,
                date,
                attachments: []
            });
        }
    }
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
});
