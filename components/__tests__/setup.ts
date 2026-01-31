// React Testing Library setup file for component tests
// This file is automatically loaded before each test via vitest.config.components.ts

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Extend Vitest's expect with jest-dom matchers
import '@testing-library/jest-dom/vitest';

// Automatic cleanup after each test to prevent memory leaks
// and ensure test isolation
afterEach(() => {
    cleanup();
});
