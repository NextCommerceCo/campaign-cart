import { readFileSync } from 'node:fs';
import { transformWithEsbuild } from 'vite';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  plugins: [
    {
      name: 'minify-es',
      async generateBundle(_, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk') chunk.code = (await transformWithEsbuild(chunk.code, chunk.fileName, { minify: true })).code;
        }
      },
    },
  ],
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/loader.ts',
      formats: ['es'],
      fileName: () => 'loader.js',
    },
    rollupOptions: {
      output: { chunkFileNames: '[name]-[hash].js' },
    },
  },
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: { settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true } },
    },
    include: ['tests/**/*.test.ts'],
  },
});
