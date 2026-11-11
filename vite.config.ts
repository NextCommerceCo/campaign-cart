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
    {
      // The loader fetches a page's lazy chunks beside boot: each name with its file and the chunks it imports.
      name: 'preload-map',
      enforce: 'post',
      generateBundle(_, bundle) {
        const chunks = Object.values(bundle).flatMap((c) => (c.type === 'chunk' ? [c] : []));
        const file = (name: string) => chunks.find((c) => c.fileName.startsWith(`${name}-`));
        const boot = file('boot')?.fileName;
        const withImports = (name: string): string[] => {
          const seen = new Set<string>();
          const add = (fileName?: string) => {
            if (!fileName || fileName === boot || seen.has(fileName)) return;
            seen.add(fileName);
            chunks.find((c) => c.fileName === fileName)?.imports.forEach(add);
          };
          add(file(name)?.fileName);
          return [...seen];
        };
        const map = ['legacy', 'attributes', 'checkout', 'order', 'cart-summary', 'slots']
          .map((n) => `${n}:${withImports(n)}`)
          .join('|');
        const loader = chunks.find((c) => c.fileName === 'loader.js');
        if (loader) loader.code = loader.code.replace('%PRELOAD%', map);
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
        chunkFileNames: (chunk) => {
          const entry = chunk.facadeModuleId ?? chunk.moduleIds.find((id) => /\/src\/[^/]+\/index\.ts$/.test(id));
          return chunk.name === 'index' && entry ? `${entry.split('/').at(-2)}-[hash].js` : '[name]-[hash].js';
        },
      },
    },
  },
  test: {
    css: { include: [/vendor\/tsugi\//] },
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
