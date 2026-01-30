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
            const isRead = flags && flags.includes('\\Seen');  // This will throw!
        }).toThrow(TypeError);

        // The error message will be: "flags.includes is not a function"
        try {
            const isRead = flags && flags.includes('\\Seen');
        } catch (error) {
            expect(error.message).toContain('flags.includes is not a function');
        }
    });

    it('should show how imapflow actually returns flags vs what code expects', () => {
        // What the code expects (Array):
        const expectedFlags = ['\\Seen', '\\Flagged'];
        expect(expectedFlags.includes('\\Seen')).toBe(true);  // Works with Arrays

        // What imapflow actually returns (Set):
        const actualFlags = new Set(['\\Seen', '\\Flagged']);

        // Code tries to do this and fails:
        expect(() => {
            const hasSeenFlag = actualFlags.includes('\\Seen');
        }).toThrow(TypeError);

        // Correct way with Set:
        expect(actualFlags.has('\\Seen')).toBe(true);  // This is the fix
    });

    it('should reproduce the parsing logic that fails with Set-based flags', () => {
        // Simulate the message.attributes.flags structure from imapflow
        const message = {
            attributes: {
                uid: 43,
                flags: new Set(['\\Seen', '\\Flagged'])  // Real imapflow returns Set
            }
        };

        // This is the buggy code pattern from lines 68-69 in imap.cjs:
        expect(() => {
            const email = {
                isRead: message.attributes.flags && message.attributes.flags.includes('\\Seen'),
                isFlagged: message.attributes.flags && message.attributes.flags.includes('\\Flagged')
            };
        }).toThrow(/flags.includes is not a function/);

        // The correct way (after fix):
        const emailCorrect = {
            isRead: message.attributes.flags && message.attributes.flags.has('\\Seen'),
            isFlagged: message.attributes.flags && message.attributes.flags.has('\\Flagged')
        };
        expect(emailCorrect.isRead).toBe(true);
        expect(emailCorrect.isFlagged).toBe(true);
    });

    it('should handle empty Set correctly after fix', () => {
        const message = {
            attributes: {
                uid: 100,
                flags: new Set()  // Empty Set - no flags
            }
        };

        // The buggy code fails even with empty Set:
        expect(() => {
            const email = {
                isRead: message.attributes.flags && message.attributes.flags.includes('\\Seen')
            };
        }).toThrow(TypeError);

        // After fix, this should work:
        const emailCorrect = {
            isRead: message.attributes.flags && message.attributes.flags.has('\\Seen'),
            isFlagged: message.attributes.flags && message.attributes.flags.has('\\Flagged')
        };
        expect(emailCorrect.isRead).toBe(false);  // No \Seen flag
        expect(emailCorrect.isFlagged).toBe(false);  // No \Flagged flag
    });

    it('should handle undefined flags correctly', () => {
        const message = {
            attributes: {
                uid: 200,
                flags: undefined  // flags might be undefined
            }
        };

        // With current code (would fail if flags was a Set)
        // With undefined, the && short-circuits so no error
        const email = {
            isRead: message.attributes.flags && message.attributes.flags.includes('\\Seen')
        };
        expect(email.isRead).toBe(undefined);  // undefined because flags is falsy

        // After fix with optional chaining (safer):
        const emailCorrect = {
            isRead: message.attributes.flags?.has('\\Seen') || false,
            isFlagged: message.attributes.flags?.has('\\Flagged') || false
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
