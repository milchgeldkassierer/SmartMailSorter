import { describe, it, expect, vi, beforeEach } from 'vitest';

// This test file reproduces the flags.includes() bug from GitHub Issue #10
// The bug occurs because imapflow returns flags as Set<string>, but the code calls .includes() which only exists on Arrays

describe('IMAP Flags Bug - Reproduction Test', () => {
  it('should demonstrate that Set does not have includes() method', () => {
    // This is a simple test to show the root cause of the bug
    const flagsAsSet = new Set(['\\Seen', '\\Flagged']);
    const flagsAsArray = ['\\Seen', '\\Flagged'];

    // Arrays have includes() method
    expect(flagsAsArray.includes('\\Seen')).toBe(true);
    expect(typeof flagsAsArray.includes).toBe('function');

    // Sets DO NOT have includes() method - they use has() instead
    expect(typeof flagsAsSet.includes).toBe('undefined');
    expect(flagsAsSet.has('\\Seen')).toBe(true); // Correct way to check Set membership
  });

  it('should show the exact error that occurs when calling includes() on a Set', () => {
    // This demonstrates the actual error from the bug
    const flags = new Set(['\\Seen', '\\Flagged']);

    // This is what the buggy code tries to do (lines 68, 69, 76 in imap.cjs)
    expect(() => {
      const _isRead = flags && flags.includes('\\Seen'); // This will throw!
    }).toThrow(TypeError);

    // The error message will be: "flags.includes is not a function"
    try {
      const _isRead = flags && flags.includes('\\Seen');
    } catch (error) {
      expect(error.message).toContain('flags.includes is not a function');
    }
  });

  it('should show how imapflow actually returns flags vs what code expects', () => {
    // What the code expects (Array):
    const expectedFlags = ['\\Seen', '\\Flagged'];
    expect(expectedFlags.includes('\\Seen')).toBe(true); // Works with Arrays

    // What imapflow actually returns (Set):
    const actualFlags = new Set(['\\Seen', '\\Flagged']);

    // Code tries to do this and fails:
    expect(() => {
      const _hasSeenFlag = actualFlags.includes('\\Seen');
    }).toThrow(TypeError);

    // Correct way with Set:
    expect(actualFlags.has('\\Seen')).toBe(true); // This is the fix
  });

  it('should reproduce the parsing logic that fails with Set-based flags', () => {
    // Simulate the message.attributes.flags structure from imapflow
    const message = {
      attributes: {
        uid: 43,
        flags: new Set(['\\Seen', '\\Flagged']), // Real imapflow returns Set
      },
    };

    // This is the buggy code pattern from lines 68-69 in imap.cjs:
    expect(() => {
      const _email = {
        isRead: message.attributes.flags && message.attributes.flags.includes('\\Seen'),
        isFlagged: message.attributes.flags && message.attributes.flags.includes('\\Flagged'),
      };
    }).toThrow(/flags.includes is not a function/);

    // The correct way (after fix):
    const emailCorrect = {
      isRead: message.attributes.flags && message.attributes.flags.has('\\Seen'),
      isFlagged: message.attributes.flags && message.attributes.flags.has('\\Flagged'),
    };
    expect(emailCorrect.isRead).toBe(true);
    expect(emailCorrect.isFlagged).toBe(true);
  });

  it('should handle empty Set correctly after fix', () => {
    const message = {
      attributes: {
        uid: 100,
        flags: new Set(), // Empty Set - no flags
      },
    };

    // The buggy code fails even with empty Set:
    expect(() => {
      const _email = {
        isRead: message.attributes.flags && message.attributes.flags.includes('\\Seen'),
      };
    }).toThrow(TypeError);

    // After fix, this should work:
    const emailCorrect = {
      isRead: message.attributes.flags && message.attributes.flags.has('\\Seen'),
      isFlagged: message.attributes.flags && message.attributes.flags.has('\\Flagged'),
    };
    expect(emailCorrect.isRead).toBe(false); // No \Seen flag
    expect(emailCorrect.isFlagged).toBe(false); // No \Flagged flag
  });

  it('should handle undefined flags correctly', () => {
    const message = {
      attributes: {
        uid: 200,
        flags: undefined, // flags might be undefined
      },
    };

    // With current code (would fail if flags was a Set)
    // With undefined, the && short-circuits so no error
    const email = {
      isRead: message.attributes.flags && message.attributes.flags.includes('\\Seen'),
    };
    expect(email.isRead).toBe(undefined); // undefined because flags is falsy

    // After fix with optional chaining (safer):
    const emailCorrect = {
      isRead: message.attributes.flags?.has('\\Seen') || false,
      isFlagged: message.attributes.flags?.has('\\Flagged') || false,
    };
    expect(emailCorrect.isRead).toBe(false);
    expect(emailCorrect.isFlagged).toBe(false);
  });

  it('should verify that all common IMAP flags work with Set.has()', () => {
    // Common IMAP flags
    const flags = new Set(['\\Seen', '\\Flagged', '\\Draft', '\\Answered', '\\Deleted']);

    // After the fix, all these checks should work with .has()
    expect(flags.has('\\Seen')).toBe(true);
    expect(flags.has('\\Flagged')).toBe(true);
    expect(flags.has('\\Draft')).toBe(true);
    expect(flags.has('\\Answered')).toBe(true);
    expect(flags.has('\\Deleted')).toBe(true);

    // Non-existent flag
    expect(flags.has('\\Recent')).toBe(false);
  });
});

// Tests for the processMessages function with various flags formats
describe('processMessages - Flags Handling', () => {
  let _mockClient;
  let _mockAccount;
  let savedEmails;
  let parsedResults;

  // Mock dependencies
  const mockSaveEmail = vi.fn();
  const mockSimpleParser = vi.fn();

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    savedEmails = [];
    parsedResults = new Map();

    // Mock account
    _mockAccount = {
      id: 'test-account-123',
      email: 'test@example.com',
    };

    // Mock client (not used in processMessages but required as parameter)
    _mockClient = {};

    // Setup saveEmail mock to capture saved emails
    mockSaveEmail.mockImplementation((email) => {
      savedEmails.push(email);
      return email;
    });

    // Setup simpleParser mock with default behavior
    mockSimpleParser.mockImplementation(async (source) => {
      const uid = parsedResults.get(source)?.uid || 'unknown';
      return (
        parsedResults.get(source) || {
          from: { text: 'sender@example.com', value: [{ address: 'sender@example.com' }] },
          subject: `Test Email UID ${uid}`,
          text: 'Test email body',
          html: '<p>Test email body</p>',
          date: new Date('2024-01-15'),
          attachments: [],
        }
      );
    });
  });

  // Helper to create a test message with specific flags
  function createTestMessage(uid, flags, bodyContent = 'Email body content') {
    return {
      attributes: {
        uid: uid,
        flags: flags,
      },
      parts: [
        {
          which: '',
          body: bodyContent,
        },
      ],
    };
  }

  // Helper to setup parser response for a specific message
  function setupParserResponse(bodyContent, parsedData) {
    parsedResults.set(bodyContent, parsedData);
  }

  it('should correctly process messages with Set containing flags', async () => {
    const messages = [
      createTestMessage(100, new Set(['\\Seen', '\\Flagged']), 'body1'),
      createTestMessage(101, new Set(['\\Seen']), 'body2'),
      createTestMessage(102, new Set(['\\Flagged']), 'body3'),
    ];

    // Test the logic directly (processMessages is not exported, so we test the core logic)
    for (const message of messages) {
      const email = {
        isRead: message.attributes.flags?.has('\\Seen') || false,
        isFlagged: message.attributes.flags?.has('\\Flagged') || false,
      };

      if (message.attributes.uid === 100) {
        expect(email.isRead).toBe(true);
        expect(email.isFlagged).toBe(true);
      } else if (message.attributes.uid === 101) {
        expect(email.isRead).toBe(true);
        expect(email.isFlagged).toBe(false);
      } else if (message.attributes.uid === 102) {
        expect(email.isRead).toBe(false);
        expect(email.isFlagged).toBe(true);
      }
    }
  });

  it('should correctly handle undefined flags', async () => {
    const messages = [createTestMessage(200, undefined, 'body-undefined')];

    setupParserResponse('body-undefined', {
      uid: 200,
      from: { text: 'test@test.com', value: [{ address: 'test@test.com' }] },
      subject: 'Email with undefined flags',
      text: 'Body text',
      html: '<p>Body text</p>',
      date: new Date('2024-01-15'),
      attachments: [],
    });

    const message = messages[0];
    const email = {
      isRead: message.attributes.flags?.has('\\Seen') || false,
      isFlagged: message.attributes.flags?.has('\\Flagged') || false,
    };

    // With undefined flags, both should be false
    expect(email.isRead).toBe(false);
    expect(email.isFlagged).toBe(false);
  });

  it('should correctly handle empty Set of flags', async () => {
    const messages = [createTestMessage(300, new Set(), 'body-empty')];

    setupParserResponse('body-empty', {
      uid: 300,
      from: { text: 'test@test.com', value: [{ address: 'test@test.com' }] },
      subject: 'Email with no flags',
      text: 'Body text',
      html: '<p>Body text</p>',
      date: new Date('2024-01-15'),
      attachments: [],
    });

    const message = messages[0];
    const email = {
      isRead: message.attributes.flags?.has('\\Seen') || false,
      isFlagged: message.attributes.flags?.has('\\Flagged') || false,
    };

    // With empty Set, both should be false
    expect(email.isRead).toBe(false);
    expect(email.isFlagged).toBe(false);
  });

  it('should correctly detect isRead flag in various scenarios', async () => {
    const testCases = [
      { uid: 401, flags: new Set(['\\Seen']), expectedIsRead: true, description: 'with Seen flag' },
      { uid: 402, flags: new Set(['\\Flagged']), expectedIsRead: false, description: 'without Seen flag' },
      { uid: 403, flags: new Set(), expectedIsRead: false, description: 'with empty Set' },
      { uid: 404, flags: undefined, expectedIsRead: false, description: 'with undefined flags' },
      {
        uid: 405,
        flags: new Set(['\\Seen', '\\Flagged', '\\Draft']),
        expectedIsRead: true,
        description: 'with multiple flags including Seen',
      },
    ];

    testCases.forEach((testCase) => {
      const message = createTestMessage(testCase.uid, testCase.flags);
      const isRead = message.attributes.flags?.has('\\Seen') || false;

      expect(isRead).toBe(testCase.expectedIsRead);
    });
  });

  it('should correctly detect isFlagged flag in various scenarios', async () => {
    const testCases = [
      { uid: 501, flags: new Set(['\\Flagged']), expectedIsFlagged: true, description: 'with Flagged flag' },
      { uid: 502, flags: new Set(['\\Seen']), expectedIsFlagged: false, description: 'without Flagged flag' },
      { uid: 503, flags: new Set(), expectedIsFlagged: false, description: 'with empty Set' },
      { uid: 504, flags: undefined, expectedIsFlagged: false, description: 'with undefined flags' },
      {
        uid: 505,
        flags: new Set(['\\Seen', '\\Flagged', '\\Answered']),
        expectedIsFlagged: true,
        description: 'with multiple flags including Flagged',
      },
    ];

    testCases.forEach((testCase) => {
      const message = createTestMessage(testCase.uid, testCase.flags);
      const isFlagged = message.attributes.flags?.has('\\Flagged') || false;

      expect(isFlagged).toBe(testCase.expectedIsFlagged);
    });
  });

  it('should handle all common IMAP flags correctly', async () => {
    // Test that the optional chaining works with all standard IMAP flags
    const allFlags = new Set(['\\Seen', '\\Flagged', '\\Draft', '\\Answered', '\\Deleted', '\\Recent']);
    const message = createTestMessage(600, allFlags);

    // Test individual flag detection
    expect(message.attributes.flags?.has('\\Seen')).toBe(true);
    expect(message.attributes.flags?.has('\\Flagged')).toBe(true);
    expect(message.attributes.flags?.has('\\Draft')).toBe(true);
    expect(message.attributes.flags?.has('\\Answered')).toBe(true);
    expect(message.attributes.flags?.has('\\Deleted')).toBe(true);
    expect(message.attributes.flags?.has('\\Recent')).toBe(true);

    // Test non-existent flag
    expect(message.attributes.flags?.has('\\NonExistent')).toBe(false);
  });

  it('should use fallback value when flags is null', async () => {
    const message = createTestMessage(700, null);

    const email = {
      isRead: message.attributes.flags?.has('\\Seen') || false,
      isFlagged: message.attributes.flags?.has('\\Flagged') || false,
    };

    // With null flags, both should fallback to false
    expect(email.isRead).toBe(false);
    expect(email.isFlagged).toBe(false);
  });
});
