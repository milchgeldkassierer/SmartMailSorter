import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/components/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/components/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/hooks/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/utils/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    setupFiles: ['./src/components/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'clover', 'json'],
      include: ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}', 'src/utils/**/*.{ts,tsx}'],
      exclude: [
        'src/components/__tests__/**',
        'src/components/**/__tests__/**',
        'src/hooks/__tests__/**',
        'src/utils/__tests__/**',
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
