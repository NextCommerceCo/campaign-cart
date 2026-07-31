import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  // Mirror the build's __VERSION__ replacement so code using the bare
  // `__VERSION__` identifier (e.g. event metadata) resolves under Vitest too.
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0-test'),
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/tests/setup.ts'],
    // Unit tests live under src/ only. Playwright owns e2e/ (root) — scoping
    // discovery here keeps Vitest from picking up *.spec.ts E2E files and
    // trying to run them in happy-dom.
    include: ['src/**/*.{test,spec}.{ts,js}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/tests/setup.ts',
        '**/*.d.ts',
        '**/*.test.{ts,js}',
        '**/*.spec.{ts,js}',
        'dist/',
        'examples/',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/state': resolve(__dirname, 'src/state'),
      '@/features': resolve(__dirname, 'src/features'),
      '@/api': resolve(__dirname, 'src/api'),
      '@/core': resolve(__dirname, 'src/core'),
    },
  },
});