import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['electron/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        // Setup file that patches CJS modules before any tests run
        setupFiles: ['./electron/tests/vitest-setup.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'clover', 'json'],
            // Backend tests only cover electron and services (components tested separately with jsdom)
            include: ['electron/**/*.{js,cjs,ts}', 'services/**/*.{js,ts}'],
            exclude: [
                'electron/tests/**',
                'electron/main.cjs',
                'electron/preload.cjs',
                '**/*.config.{js,ts}',
                '**/node_modules/**',
                '**/__mocks__/**'
            ],
            thresholds: {
                // Overall backend threshold
                lines: 85,
                functions: 85,
                branches: 70,
                statements: 85
            }
        }
    },
});
