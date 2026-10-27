import { readFileSync } from 'node:fs';
import { transformWithEsbuild } from 'vite';
import { defineConfig } from 'vitest/config';

const HEADLESS = ['tests/engine/**/*.test.ts', 'tests/*/state/**/*.test.ts', 'tests/*/state.test.ts'];

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  plugins: [
    {
      name: 'minify-es',
      async generateBundle(_, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk')
            chunk.code = (await transformWithEsbuild(chunk.code, chunk.fileName, { minify: true })).code;
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
      output: {
        chunkFileNames: (chunk) =>
          chunk.name === 'index' && chunk.facadeModuleId
            ? `${chunk.facadeModuleId.split('/').at(-2)}-[hash].js`
            : '[name]-[hash].js',
      },
    },
  },
  test: {
    environmentOptions: {
      happyDOM: {
        settings: {
          disableJavaScriptFileLoading: true,
          disableCSSFileLoading: true,
          disableIframePageLoading: true,
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    projects: [
      { extends: true, test: { name: 'headless', include: HEADLESS, environment: 'node' } },
      {
        extends: true,
        test: { name: 'dom', include: ['tests/**/*.test.ts'], exclude: HEADLESS, environment: 'happy-dom' },
      },
    ],
  },
});
