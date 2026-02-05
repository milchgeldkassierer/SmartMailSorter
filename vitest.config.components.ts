import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'components/__tests__/**/*.{test,spec}.{ts,tsx}',
      'components/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'hooks/__tests__/**/*.{test,spec}.{ts,tsx}',
      'utils/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    setupFiles: ['./components/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'clover', 'json'],
      include: ['components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}', 'utils/**/*.{ts,tsx}'],
      exclude: [
        'components/__tests__/**',
        'components/**/__tests__/**',
        'hooks/__tests__/**',
        'utils/__tests__/**',
        '**/*.config.{js,ts}',
        '**/node_modules/**',
        '**/__mocks__/**',
      ],
      thresholds: {
        // Overall component coverage target: 85%+
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
