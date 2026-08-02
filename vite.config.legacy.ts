import { defineConfig } from 'vite';
import { resolve } from 'path';

// Legacy build for older browsers - single bundle UMD.
//
// `npm run build:cf` runs this *after* the main config, with
// `emptyOutDir: false`, so its `index.umd.js` replaces the one the main
// config's `build-additional-formats` plugin just wrote. That makes the
// compile-time replacements below mandatory: `__VERSION__` is declared in
// `src/vite-env.d.ts` and read at runtime by `core/next-commerce.ts ›
// NextCommerce.version`, `core/analytics/data-layer-manager.ts` and
// `core/analytics/events/event-builder.ts`. Without the `define` it survives
// into the output as a bare identifier and the first analytics event throws
// `ReferenceError: __VERSION__ is not defined`. Keep this block in step with
// `sharedDefine` in vite.config.ts.
export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version || '0.2.0'),
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
    global: 'globalThis',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NextCommerce',
      fileName: () => 'index.umd.js',
      formats: ['umd'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true, // Force single bundle for UMD
      },
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
