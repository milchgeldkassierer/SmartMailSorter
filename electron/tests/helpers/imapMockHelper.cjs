/**
 * IMAP Mock Helper
 *
 * Utility functions for simulating IMAP server state in integration tests.
 * Provides a clean API for setting up realistic IMAP server scenarios including:
 * - UIDs, messages, and flags management
 * - Batch processing scenarios
 * - Orphan detection scenarios
 * - Error condition simulation
 *
 * This helper wraps the enhanced __mocks__/imap-simple.cjs to provide
 * convenient test setup utilities that follow the patterns from db.test.js.
 */

const mockImap = require('../../../__mocks__/imap-simple.cjs');

// Re-export the core mock functions for convenience
const {
  resetMockState,
  setServerEmails,
  setConnectFailure,
  setFetchFailure,
  setSearchFailure,
  setQuota,
  getServerUids,
  getMessage,
  isConnected,
  ImapFlow,
  MockImapConnection,
} = mockImap;

/**
 * Creates a fresh mock server state for testing.
 * Call this in beforeEach to ensure test isolation.
 * @returns {Object} The mock state object for inspection
 */
function createMockServerState() {
  resetMockState();
  return {
    getUids: getServerUids,
    getMessage,
    isConnected,
  };
}

/**
 * Adds a message to the mock server.
 * Automatically assigns a UID if not provided.
 * @param {Object} message - The message to add
 * @param {number} [message.uid] - Unique identifier (auto-assigned if not provided)
 * @param {string} [message.subject] - Email subject
 * @param {string} [message.from] - Sender email address
 * @param {string} [message.body] - Email body content
 * @param {string} [message.date] - ISO date string
 * @param {string[]} [message.flags] - IMAP flags (e.g., ['\\Seen', '\\Flagged'])
 * @returns {number} The UID of the added message
 */
function addMessageToServer(message) {
  const currentEmails = [];
  const existingUids = getServerUids();

  // Build array of existing messages
  for (const uid of existingUids) {
    const msg = getMessage(uid);
    if (msg) {
      currentEmails.push({
        uid: msg.uid,
        subject: msg.subject,
        from: msg.from,
        body: msg.body,
        date: msg.date,
        flags: msg.flags || [],
      });
    }
  }

  // Assign UID if not provided
  const uid = message.uid || (existingUids.length > 0 ? Math.max(...existingUids) + 1 : 1);

  // Add new message
  currentEmails.push({
    uid,
    subject: message.subject || '(No Subject)',
    from: message.from || 'test@example.com',
    body: message.body || '',
    date: message.date || new Date().toISOString(),
    flags: message.flags || [],
  });

  setServerEmails(currentEmails);
  return uid;
}

/**
 * Removes a message from the mock server by UID.
 * Used for simulating email deletion on the server (orphan scenarios).
 * @param {number} uid - The UID of the message to remove
 * @returns {boolean} True if message was found and removed, false otherwise
 */
function removeMessageFromServer(uid) {
  const existingUids = getServerUids();
  if (!existingUids.includes(uid)) {
    return false;
  }

  const currentEmails = [];
  for (const existingUid of existingUids) {
    if (existingUid !== uid) {
      const msg = getMessage(existingUid);
      if (msg) {
        currentEmails.push({
          uid: msg.uid,
          subject: msg.subject,
          from: msg.from,
          body: msg.body,
          date: msg.date,
          flags: msg.flags || [],
        });
      }
    }
  }

  setServerEmails(currentEmails);
  return true;
}

/**
 * Clears all server state (emails, UIDs, connection state).
 * Use this in afterEach to clean up.
 */
function clearServerState() {
  resetMockState();
}

/**
 * Sets up a batch processing scenario with many emails.
 * Useful for testing batch sync with large mailboxes.
 * @param {number} count - Number of emails to create
 * @param {Object} options - Options for email generation
 * @param {number} [options.startUid] - Starting UID (default: 1)
 * @param {string} [options.subjectPrefix] - Prefix for subject lines
 * @param {string} [options.from] - Sender email for all messages
 * @returns {number[]} Array of created UIDs
 */
function setupBatchScenario(count, options = {}) {
  const { startUid = 1, subjectPrefix = 'Test Email', from = 'batch@example.com' } = options;

  const emails = [];
  const uids = [];

  for (let i = 0; i < count; i++) {
    const uid = startUid + i;
    uids.push(uid);
    emails.push({
      uid,
      subject: `${subjectPrefix} ${i + 1}`,
      from,
      body: `This is test email number ${i + 1} for batch testing.`,
      date: new Date(Date.now() - i * 86400000).toISOString(), // Spread dates
      flags: i % 3 === 0 ? ['\\Seen'] : [], // Every 3rd email is read
    });
  }

  setServerEmails(emails);
  return uids;
}

/**
 * Sets up an orphan detection scenario.
 * Server will have fewer UIDs than local database.
 * @param {number[]} serverUids - UIDs that exist on the server
 * @param {number[]} localUids - UIDs that exist locally (includes orphans)
 * @returns {number[]} Array of orphan UIDs (local only)
 */
function setupOrphanScenario(serverUids, localUids) {
  // Create emails only for server UIDs
  const emails = serverUids.map((uid, index) => ({
    uid,
    subject: `Server Email ${index + 1}`,
    from: 'server@example.com',
    body: `Email with UID ${uid} exists on server`,
    date: new Date().toISOString(),
    flags: [],
  }));

  setServerEmails(emails);

  // Return orphan UIDs (local only)
  return localUids.filter((uid) => !serverUids.includes(uid));
}

/**
 * Updates flags for a specific message on the server.
 * @param {number} uid - The message UID
 * @param {string[]} flags - New flags array
 * @returns {boolean} True if message was found and updated
 */
function updateMessageFlags(uid, flags) {
  const message = getMessage(uid);
  if (!message) {
    return false;
  }

  // Rebuild email list with updated flags
  const existingUids = getServerUids();
  const emails = [];

  for (const existingUid of existingUids) {
    const msg = getMessage(existingUid);
    if (msg) {
      emails.push({
        uid: msg.uid,
        subject: msg.subject,
        from: msg.from,
        body: msg.body,
        date: msg.date,
        flags: existingUid === uid ? flags : msg.flags || [],
      });
    }
  }

  setServerEmails(emails);
  return true;
}

/**
 * Gets the current number of messages on the server.
 * @returns {number} Message count
 */
function getMessageCount() {
  return getServerUids().length;
}

/**
 * Simulates a connection error scenario.
 * @param {string} [errorMessage] - Custom error message
 */
function simulateConnectionError(errorMessage) {
  setConnectFailure(true);
}

/**
 * Simulates a fetch error scenario.
 * @param {string} [errorMessage] - Custom error message
 */
function simulateFetchError(errorMessage) {
  setFetchFailure(true);
}

/**
 * Simulates a search error scenario.
 */
function simulateSearchError() {
  setSearchFailure(true);
}

/**
 * Clears all error simulations.
 * Call this to reset error states between tests.
 */
function clearErrorSimulations() {
  setConnectFailure(false);
  setFetchFailure(false);
  setSearchFailure(false);
}

/**
 * Sets up quota information for the mock server.
 * @param {number} used - Used storage in KB
 * @param {number} total - Total storage in KB
 */
function setupQuota(used, total) {
  setQuota(used, total);
}

/**
 * Creates a standard account object for testing.
 * @param {Object} overrides - Properties to override
 * @returns {Object} Account object compatible with imap.cjs functions
 */
function createTestAccount(overrides = {}) {
  return {
    id: overrides.id || 'test-account-1',
    email: overrides.email || 'test@example.com',
    username: overrides.username || 'test@example.com',
    password: overrides.password || 'testpass',
    imapHost: overrides.imapHost || 'imap.test.com',
    imapPort: overrides.imapPort || 993,
    ...overrides,
  };
}

module.exports = {
  // Core state management
  createMockServerState,
  clearServerState,

  // Message management
  addMessageToServer,
  removeMessageFromServer,
  updateMessageFlags,
  getMessageCount,

  // Scenario helpers
  setupBatchScenario,
  setupOrphanScenario,

  // Error simulation
  simulateConnectionError,
  simulateFetchError,
  simulateSearchError,
  clearErrorSimulations,

  // Server configuration
  setupQuota,
  setServerEmails,

  // Test utilities
  createTestAccount,
  getServerUids,
  getMessage,
  isConnected,

  // Mock classes (for advanced use cases)
  ImapFlow,
  MockImapConnection,
};
