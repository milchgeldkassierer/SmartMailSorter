const { vi } = require('vitest');

const mockConnect = vi.fn();
// We can't export the specific mock instances easily to the test file if we define them here.
// But we can export a factory or just simple mocks.
// Best way: in test file, verify calls.
// But we need to share the spy.

// Alternative: Just export a basic structure, and in the test file use vi.spyOn?
// No, the module is a function/object.

// Let's make the mock return a connect function that does nothing but return a mock connection.
// But we need to control it from the test.

// Standard way:
// Test file: vi.mock('imap-simple');
// Test file: import imaps from 'imap-simple';
// Test file: imaps.connect.mockResolvedValue(...)

module.exports = {
    connect: vi.fn(),
};
