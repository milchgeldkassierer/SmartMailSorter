const { EventEmitter } = require('events');

/**
 * Enhanced IMAP Mock for Integration Testing
 *
 * This mock provides realistic IMAP server behavior simulation to support
 * integration tests that exercise actual sync logic rather than just
 * verifying mock function calls.
 *
 * Features:
 * - Configurable mailbox state with realistic UID sequences
 * - Batch processing support (sequence ranges and UID ranges)
 * - Orphan detection scenarios (server UIDs vs local UIDs)
 * - Error simulation for connection, fetch, and parse failures
 * - Event-based fetch responses matching node-imap behavior
 *
 * Mock should support: connect, openBox, getBoxes, search, addFlags, delFlags, expunge
 */

// Global state store that can be controlled from tests
const mockState = {
  // Mailbox configuration
  mailboxes: new Map(),
  // Current mailbox being accessed
  currentMailbox: null,
  // UIDs present on the "server"
  serverUids: [],
  // Messages with their content
  messages: new Map(), // uid -> message object
  // Connection state
  connected: false,
  // Error simulation flags
  shouldFailConnect: false,
  shouldFailFetch: false,
  shouldFailSearch: false,
  // Quota information
  quota: null,
  // Capabilities
  capabilities: new Set(['IMAP4', 'IMAP4rev1', 'UIDPLUS']),
};

/**
 * Reset all mock state - call this in beforeEach
 */
function resetMockState() {
  mockState.mailboxes.clear();
  mockState.currentMailbox = null;
  mockState.serverUids = [];
  mockState.messages.clear();
  mockState.connected = false;
  mockState.shouldFailConnect = false;
  mockState.shouldFailFetch = false;
  mockState.shouldFailSearch = false;
  mockState.quota = null;
  mockState.capabilities = new Set(['IMAP4', 'IMAP4rev1', 'UIDPLUS']);
}

/**
 * Set up the mock server with specific emails for testing
 * @param {Array<{uid: number, subject: string, from: string, body: string, flags?: string[]}>} emails
 */
function setServerEmails(emails) {
  mockState.serverUids = emails.map((e) => e.uid).sort((a, b) => a - b);
  mockState.messages.clear();

  for (const email of emails) {
    mockState.messages.set(email.uid, {
      uid: email.uid,
      subject: email.subject || '(No Subject)',
      from: email.from || 'test@example.com',
      body: email.body || '',
      date: email.date || new Date().toISOString(),
      flags: email.flags || [],
      headers: `Subject: ${email.subject || '(No Subject)'}
From: ${email.from || 'test@example.com'}
Date: ${email.date || new Date().toISOString()}
Message-ID: <${email.uid}@test.example.com>`,
    });
  }

  // Update mailbox exists count
  mockState.currentMailbox = {
    exists: emails.length,
    path: 'INBOX',
  };
}

/**
 * Simulate connection failure
 * @param {boolean} shouldFail
 */
function setConnectFailure(shouldFail) {
  mockState.shouldFailConnect = shouldFail;
}

/**
 * Simulate fetch failure
 * @param {boolean} shouldFail
 */
function setFetchFailure(shouldFail) {
  mockState.shouldFailFetch = shouldFail;
}

/**
 * Simulate search failure
 * @param {boolean} shouldFail
 */
function setSearchFailure(shouldFail) {
  mockState.shouldFailSearch = shouldFail;
}

/**
 * Set quota information
 * @param {number} used - Used storage in KB
 * @param {number} total - Total storage in KB
 */
function setQuota(used, total) {
  mockState.quota = { used, total };
}

/**
 * Mock fetch stream that emits data events
 */
class MockFetchStream extends EventEmitter {
  constructor(content) {
    super();
    this.content = content;
  }

  simulate() {
    // Simulate async data chunks
    setTimeout(() => {
      const chunks = Buffer.from(this.content);
      this.emit('data', chunks);
    }, 0);

    setTimeout(() => {
      this.emit('end');
    }, 0);
  }
}

/**
 * Mock IMAP message during fetch
 */
class MockMessage extends EventEmitter {
  constructor(messageData) {
    super();
    this.data = messageData;
    this.attributes = {
      uid: messageData.uid,
      flags: messageData.flags || [],
    };
  }

  simulate() {
    // Emit body stream
    const bodyStream = new MockFetchStream(this.data.body);

    setTimeout(() => {
      this.emit('body', bodyStream, { which: '' });
      bodyStream.simulate();
    }, 0);

    // Emit attributes
    setTimeout(() => {
      this.emit('attributes', this.attributes);
    }, 0);

    // Emit end
    setTimeout(() => {
      this.emit('end');
    }, 0);
  }
}

/**
 * Mock sequence fetch result (for UID-only fetch)
 */
class MockSeqFetch extends EventEmitter {
  constructor(uids) {
    super();
    this.uids = uids;
  }

  simulate() {
    setTimeout(() => {
      for (const uid of this.uids) {
        const message = mockState.messages.get(uid);
        if (message) {
          // Simulate minimal header fetch returning just UID in attributes
          this.emit('message', {
            on: (event, cb) => {
              if (event === 'attributes') {
                cb({ uid: message.uid });
              }
            },
          });
        }
      }
    }, 0);

    setTimeout(() => {
      this.emit('end');
    }, 0);
  }
}

/**
 * Mock raw IMAP fetch (UID-based full fetch)
 */
class MockUidFetch extends EventEmitter {
  constructor(uids) {
    super();
    this.uids = uids;
  }

  simulate() {
    setTimeout(() => {
      for (const uid of this.uids) {
        const messageData = mockState.messages.get(uid);
        if (messageData) {
          const msg = new MockMessage(messageData);
          this.emit('message', msg);
          msg.simulate();
        }
      }
    }, 0);

    setTimeout(() => {
      this.emit('end');
    }, 0);
  }
}

/**
 * Mock IMAP client connection
 */
class MockImapConnection {
  constructor(config) {
    this.config = config;
    this.mailbox = null;
  }

  async connect() {
    if (mockState.shouldFailConnect) {
      throw new Error('Connection failed: Network error');
    }
    mockState.connected = true;
  }

  async logout() {
    mockState.connected = false;
  }

  async list() {
    return [
      { name: 'INBOX', path: 'INBOX', specialUse: null },
      { name: 'Sent', path: 'Sent', specialUse: '\\Sent' },
      { name: 'Trash', path: 'Trash', specialUse: '\\Trash' },
      { name: 'Junk', path: 'Junk', specialUse: '\\Junk' },
    ];
  }

  async getMailboxLock(path) {
    mockState.currentMailbox = {
      exists: mockState.serverUids.length,
      path: path,
    };

    return {
      release: () => {
        mockState.currentMailbox = null;
      },
    };
  }

  async search(criteria) {
    if (mockState.shouldFailSearch) {
      throw new Error('Search failed');
    }
    // Return all UIDs (simple implementation)
    return mockState.serverUids;
  }

  async fetchOne(uid, options) {
    const message = mockState.messages.get(uid);
    if (!message) return null;

    return {
      uid: message.uid,
      subject: message.subject,
      from: message.from,
      body: message.body,
    };
  }

  async fetch(range, options) {
    if (mockState.shouldFailFetch) {
      throw new Error('Fetch failed');
    }

    const results = [];
    for (const uid of mockState.serverUids) {
      const msg = mockState.messages.get(uid);
      if (msg) {
        results.push({
          uid: msg.uid,
          subject: msg.subject,
          from: msg.from,
          body: msg.body,
        });
      }
    }
    return results;
  }

  async messageFlagsAdd(uid, flags) {
    const message = mockState.messages.get(uid);
    if (message) {
      for (const flag of flags) {
        if (!message.flags.includes(flag)) {
          message.flags.push(flag);
        }
      }
    }
  }

  async messageFlagsRemove(uid, flags) {
    const message = mockState.messages.get(uid);
    if (message) {
      message.flags = message.flags.filter((f) => !flags.includes(f));
    }
  }

  // Raw IMAP interface (node-imap compatible)
  get imap() {
    return {
      seq: {
        fetch: (range, options) => {
          if (mockState.shouldFailFetch) {
            const errEmitter = new EventEmitter();
            setTimeout(() => errEmitter.emit('error', new Error('Fetch failed')), 0);
            return errEmitter;
          }

          // Parse range like "1:5000" or "1:*"
          let uids = [];
          if (range === '1:*' || range.includes(':')) {
            const [start, end] = range.split(':');
            const startNum = parseInt(start) || 1;
            const endNum = end === '*' ? mockState.serverUids.length : parseInt(end);
            // Return UIDs corresponding to sequence numbers
            for (let i = startNum - 1; i < Math.min(endNum, mockState.serverUids.length); i++) {
              uids.push(mockState.serverUids[i]);
            }
          } else if (Array.isArray(range)) {
            uids = range.map((seq) => mockState.serverUids[seq - 1]).filter(Boolean);
          } else {
            const seq = parseInt(range);
            if (seq > 0 && seq <= mockState.serverUids.length) {
              uids = [mockState.serverUids[seq - 1]];
            }
          }

          const fetcher = new MockSeqFetch(uids);
          setTimeout(() => fetcher.simulate(), 0);
          return fetcher;
        },
      },

      fetch: (uids, options) => {
        if (mockState.shouldFailFetch) {
          const errEmitter = new EventEmitter();
          setTimeout(() => errEmitter.emit('error', new Error('Fetch failed')), 0);
          return errEmitter;
        }

        // Handle array of UIDs or comma-separated string
        let uidList;
        if (Array.isArray(uids)) {
          uidList = uids;
        } else if (typeof uids === 'string') {
          uidList = uids
            .split(',')
            .map((u) => parseInt(u.trim()))
            .filter(Boolean);
        } else {
          uidList = [uids];
        }

        const fetcher = new MockUidFetch(uidList);
        setTimeout(() => fetcher.simulate(), 0);
        return fetcher;
      },

      getQuotaRoot: (inbox, callback) => {
        setTimeout(() => {
          if (mockState.quota) {
            callback(null, {
              '': {
                storage: [mockState.quota.used, mockState.quota.total],
              },
            });
          } else {
            callback(null, null);
          }
        }, 0);
      },

      expunge: (uid) => {
        return Promise.resolve();
      },
    };
  }

  get capabilities() {
    return mockState.capabilities;
  }

  get mailbox() {
    return mockState.currentMailbox || { exists: 0 };
  }
}

/**
 * Mock ImapFlow class
 */
class ImapFlow {
  constructor(config) {
    this._connection = new MockImapConnection(config);
    this._mockConfig = config;
  }

  async connect() {
    return this._connection.connect();
  }

  async logout() {
    return this._connection.logout();
  }

  async list() {
    return this._connection.list();
  }

  async getMailboxLock(path) {
    return this._connection.getMailboxLock(path);
  }

  async search(criteria, options) {
    return this._connection.search(criteria);
  }

  async fetchOne(uid, options) {
    return this._connection.fetchOne(uid, options);
  }

  async fetch(range, options) {
    return this._connection.fetch(range, options);
  }

  async messageFlagsAdd(uid, flags) {
    return this._connection.messageFlagsAdd(uid, flags);
  }

  async messageFlagsRemove(uid, flags) {
    return this._connection.messageFlagsRemove(uid, flags);
  }

  get imap() {
    return this._connection.imap;
  }

  get capabilities() {
    return this._connection.capabilities;
  }

  get mailbox() {
    return this._connection.mailbox;
  }
}

/**
 * Main mock API - imap-simple compatible
 */

/**
 * Connect to IMAP server (imap-simple API)
 */
async function connect(config) {
  const connection = new MockImapConnection(config);
  await connection.connect();
  return connection;
}

/**
 * Open a mailbox (imap-simple API)
 * @param {string} boxName - Mailbox name (e.g., 'INBOX')
 * @param {boolean} openReadOnly - Whether to open read-only
 * @param {MockImapConnection} connection - Connection object
 */
async function openBox(boxName, openReadOnly, connection) {
  if (!connection) {
    throw new Error('Connection required');
  }
  const lock = await connection.getMailboxLock(boxName);
  return {
    name: boxName,
    messages: {
      total: mockState.serverUids.length,
      new: 0,
    },
    release: lock.release,
  };
}

/**
 * Get list of mailboxes (imap-simple API)
 * @param {MockImapConnection} connection - Connection object
 */
async function getBoxes(connection) {
  if (!connection) {
    throw new Error('Connection required');
  }
  const boxes = await connection.list();
  const result = {};
  for (const box of boxes) {
    result[box.name] = {
      attribs: box.specialUse ? [box.specialUse] : [],
      delimiter: '/',
      children: null,
    };
  }
  return result;
}

/**
 * Search for messages (imap-simple API)
 * @param {Array} criteria - Search criteria (e.g., ['ALL'])
 * @param {MockImapConnection} connection - Connection object
 */
async function search(criteria, connection) {
  if (!connection) {
    throw new Error('Connection required');
  }
  return connection.search(criteria);
}

/**
 * Fetch message(s) (imap-simple API)
 * @param {string|Object} source - Message source (UID or seq)
 * @param {Object} options - Fetch options
 * @param {MockImapConnection} connection - Connection object
 */
async function fetch(source, options, connection) {
  if (!connection) {
    throw new Error('Connection required');
  }

  const results = [];
  const fetchStream = connection.imap.fetch([source], options);

  return new Promise((resolve, reject) => {
    fetchStream.on('message', (msg) => {
      const msgData = {
        attributes: null,
        parts: [],
      };

      msg.on('attributes', (attrs) => {
        msgData.attributes = attrs;
      });

      msg.on('body', (stream, info) => {
        let body = '';
        stream.on('data', (chunk) => {
          body += chunk.toString();
        });
        stream.on('end', () => {
          msgData.parts.push({
            which: info.which,
            body: body,
          });
        });
      });

      msg.on('end', () => {
        results.push(msgData);
      });
    });

    fetchStream.on('error', reject);
    fetchStream.on('end', () => resolve(results));
  });
}

/**
 * Add flags to message(s) (imap-simple API)
 * @param {string} source - Message source (UID or seq)
 * @param {Array<string>} flags - Flags to add
 * @param {MockImapConnection} connection - Connection object
 */
async function addFlags(source, flags, connection) {
  if (!connection) {
    throw new Error('Connection required');
  }
  const uid = parseInt(source);
  if (!isNaN(uid)) {
    await connection.messageFlagsAdd(uid, flags);
  }
}

/**
 * Delete flags from message(s) (imap-simple API)
 * @param {string} source - Message source (UID or seq)
 * @param {Array<string>} flags - Flags to remove
 * @param {MockImapConnection} connection - Connection object
 */
async function delFlags(source, flags, connection) {
  if (!connection) {
    throw new Error('Connection required');
  }
  const uid = parseInt(source);
  if (!isNaN(uid)) {
    await connection.messageFlagsRemove(uid, flags);
  }
}

/**
 * Expunge deleted messages (imap-simple API)
 * @param {MockImapConnection} connection - Connection object
 */
async function expunge(connection) {
  if (!connection) {
    throw new Error('Connection required');
  }
  // Remove messages with \Deleted flag
  for (const [uid, message] of mockState.messages) {
    if (message.flags.includes('\\Deleted')) {
      mockState.messages.delete(uid);
    }
  }
  mockState.serverUids = mockState.serverUids.filter((uid) => mockState.messages.has(uid));
  if (mockState.currentMailbox) {
    mockState.currentMailbox.exists = mockState.serverUids.length;
  }
}

/**
 * Get server emails for verification in tests
 */
function getServerUids() {
  return [...mockState.serverUids];
}

/**
 * Get message by UID
 */
function getMessage(uid) {
  return mockState.messages.get(uid);
}

/**
 * Check if connected
 */
function isConnected() {
  return mockState.connected;
}

module.exports = {
  connect,
  openBox,
  getBoxes,
  search,
  fetch,
  addFlags,
  delFlags,
  expunge,
  getServerUids,
  getMessage,
  isConnected,
  resetMockState,
  setServerEmails,
  setConnectFailure,
  setFetchFailure,
  setSearchFailure,
  setQuota,
  ImapFlow,
  MockImapConnection,
};
