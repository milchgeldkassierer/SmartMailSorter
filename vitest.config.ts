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
            include: ['electron/**/*.{js,cjs,ts}', 'services/**/*.{js,ts}'],
            exclude: [
                'electron/tests/**',
                'electron/main.cjs',
                '**/*.config.{js,ts}',
                '**/node_modules/**',
                '**/__mocks__/**'
            ]
        }
    },
});
