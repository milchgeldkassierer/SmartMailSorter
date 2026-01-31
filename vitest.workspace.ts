import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
    {
        extends: './vitest.config.ts',
        test: {
            name: 'electron',
            globals: true,
            environment: 'node',
            include: ['electron/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            setupFiles: ['./electron/tests/vitest-setup.js'],
        }
    },
    {
        extends: './vitest.config.components.ts',
        test: {
            name: 'components',
            globals: true,
            environment: 'jsdom',
            include: ['components/__tests__/**/*.{test,spec}.{ts,tsx}'],
            setupFiles: ['./components/__tests__/setup.ts'],
        }
    }
]);
