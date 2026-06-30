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
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
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
      '@/stores': resolve(__dirname, 'src/stores'),
      '@/enhancers': resolve(__dirname, 'src/enhancers'),
      '@/api': resolve(__dirname, 'src/api'),
    },
  },
});