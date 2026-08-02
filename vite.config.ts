import { defineConfig, type Plugin, type Rollup, type UserConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { minify as terserMinify } from 'terser';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';
// import legacy from '@vitejs/plugin-legacy'; // Optional - uncomment if you need legacy browser support

// Shared configurations to avoid duplication
const sharedResolve = {
  alias: {
    '@': resolve(__dirname, 'src'),
    '@/types': resolve(__dirname, 'src/types'),
    '@/utils': resolve(__dirname, 'src/utils'),
    '@/state': resolve(__dirname, 'src/state'),
    '@/features': resolve(__dirname, 'src/features'),
    '@/api': resolve(__dirname, 'src/api'),
    '@/core': resolve(__dirname, 'src/core'),
  },
};

const sharedDefine = {
  __VERSION__: JSON.stringify(process.env.npm_package_version || '0.2.0'),
  'process.env.NODE_ENV': '"production"',
  'process.env': '{}',
  global: 'globalThis',
};

// `vite-plugin-compression` logs `dist/` + the file path it just wrote, and strips
// the prefix with `.replace(normalizePath(`${build.outDir}/`), '')` — which only
// matches when `outDir` is absolute, because the path it strips from always is. With
// a relative `outDir` nothing matches and the log reads
// `dist//home/bond/.../chunks/foo.js.br`. The files themselves always landed beside
// the chunks; only the log line was wrong. An absolute outDir makes it truthful.
const OUT_DIR = resolve(__dirname, 'dist');

// Terser options for consistency.
//
// NOT set here, deliberately — `mangle.properties: { regex: /^_/ }`.
// The SDK uses `_`-prefixed keys as *contracts*, not as private fields:
//   - cross-chunk handshakes written onto DOM elements by one feature and read by
//     another (`_getSelectedItem`, `_getSelectedPackageId`, `_getSelectedBundleItems`,
//     `_getSelectedBundleVouchers`, `_selectedPackageId`, `_selectedItem`) — and
//     terser runs per chunk, so writer and reader get independent name maps;
//   - a documented `window` surface (`_nextForcePackageId`, `_nextForceShippingId`,
//     `_nextForceBundleId` — see `src/core/guide/reference/window-surface.md`);
//   - keys reached through string literals terser cannot rewrite, e.g.
//     `'_expression' in mappings` in `core/base/display-types.ts`.
// Mangling any of those breaks only in a built bundle, which no unit test sees.
const terserOptions = {
  compress: {
    drop_debugger: true,
    passes: 2, // Run compress passes twice for better optimization
  },
  format: {
    comments: false,
  },
  mangle: {
    safari10: true,
  },
};

// The UMD fallback additionally strips every `console.*` call, which is why debug
// mode cannot restore log output there (documented in
// `src/core/guide/subsystems/logging-and-debug.md`). The ESM chunks keep them, so
// `?debug=true` and every log documented in `reference/logs.md` still work.
const umdTerserOptions = {
  ...terserOptions,
  compress: {
    ...terserOptions.compress,
    drop_console: true,
    pure_funcs: [
      'console.log',
      'console.info',
      'console.warn',
      'console.debug',
    ],
  },
};

/**
 * Minifies the library's ES chunks — the files every campaign page actually loads.
 *
 * Vite will not do it: `vite:terser` bails with
 * `if (config.build.lib && outputOptions.format === 'es') return null`, and
 * `vite:esbuild-transpile` forces `minifyWhitespace: false` for the same case, both
 * so that `/*#__PURE__*\/` annotations survive for a downstream bundler. Nothing is
 * downstream of this SDK — the chunks are fetched straight from a `<script>` loader —
 * so the exemption bought nothing and cost >2 MB of unminified JavaScript.
 *
 * Registered under `rollupOptions.output.plugins`: output plugins run their
 * `renderChunk` after every input plugin, including `vite:esbuild-transpile`. A
 * user plugin with `enforce: 'post'` would run *before* it, and esbuild would then
 * re-indent the minified code away.
 */
const minifyEsLibChunks = (): Rollup.OutputPlugin => ({
  name: 'minify-es-lib-chunks',
  async renderChunk(code, _chunk, outputOptions) {
    if (outputOptions.format !== 'es') return null;

    const result = await terserMinify(code, {
      ...terserOptions,
      safari10: true,
      module: true, // ES chunk: terser keeps `export {}` bindings intact
      sourceMap: !!outputOptions.sourcemap,
    });

    return result.code === undefined
      ? null
      : { code: result.code, map: result.map as Rollup.SourceMapInput };
  },
});

export default defineConfig({
  plugins: [
    // TypeScript declarations
    dts({
      include: ['src/**/*'],
      // Paths here are matched against the real tree — a pattern that matches
      // nothing is indistinguishable from one that works, so keep them honest.
      // `src/utils/testMode.ts`, `src/utils/testDataHandler.ts` and
      // `src/utils/debugOverlay.ts` used to be listed and matched nothing after
      // the `utils/` → `core/` migration: the overlay moved under
      // `src/core/debug/` (already covered by `src/**/debug/**`), the test-data
      // handler was deleted, and test mode became `src/core/test-mode.ts` —
      // which stays emitted, because `core/sdk-initializer.ts` imports it and
      // its declaration would dangle without it.
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/tests/**',
        'src/**/debug/**',
      ],
      insertTypesEntry: true,
      copyDtsFiles: true,
      compilerOptions: {
        removeComments: true,
      },
    }),

    // Compression for better performance
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files larger than 10kb
      deleteOriginFile: false,
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
    }),

    // Legacy browser support (optional - uncomment if needed)
    // legacy({
    //   targets: ['defaults', 'not IE 11'],
    //   additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    //   renderLegacyChunks: true,
    //   polyfills: {
    //     'es.promise.finally': true,
    //     'es/map': true,
    //     'es/set': true,
    //   },
    // }),

    // Bundle analyzer - only enabled when --analyze flag is passed
    process.env.ANALYZE &&
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
        sourcemap: true,
      }),

    // Custom plugin for additional builds
    ((): Plugin => {
      // Follow whatever outDir this build resolved to instead of hard-coding
      // `dist/`. Vite resolves `build.outDir` to an absolute path, so the
      // truthful-compression-log reason for OUT_DIR still holds — and
      // `vite build --outDir <scratch>` now puts the UMD in the scratch
      // directory too, instead of overwriting the committed `dist/index.umd.js`
      // while the ES chunks go somewhere else.
      let outDir = OUT_DIR;
      return {
        name: 'build-additional-formats',
        configResolved(config) {
          outDir = config.build.outDir;
        },
        async closeBundle() {
          const { build } = await import('vite');

          // Build UMD bundle
          await build({
            configFile: false,
            resolve: sharedResolve,
            define: sharedDefine,
            build: {
              outDir,
              emptyOutDir: false,
              lib: {
                entry: resolve(__dirname, 'src/index.ts'),
                name: 'NextCommerce',
                formats: ['umd'],
                fileName: () => 'index.umd.js',
              },
              rollupOptions: {
                external: [
                  // More specific external patterns
                  resolve(__dirname, 'src/config.ts'),
                  (id: string) => /node_modules/.test(id) && !/vite/.test(id),
                ],
                output: {
                  globals: {
                    // Add any global mappings here
                  },
                  inlineDynamicImports: true,
                },
              },
              // UMD is a single non-ES-format file, so Vite's own terser pass applies.
              minify: 'terser',
              terserOptions: umdTerserOptions,
              sourcemap: false,
              target: 'es2015', // UMD should support older browsers
            },
          } as UserConfig);
        },
      };
    })(),
  ].filter(Boolean),

  resolve: sharedResolve,
  define: sharedDefine,

  optimizeDeps: {
    // Pre-bundle these dependencies for faster dev server startup
    include: [
      // Add your frequently used dependencies here
      // 'react', 'react-dom', 'axios', etc.
    ],
    exclude: [
      // Exclude large or optional dependencies
    ],
    esbuildOptions: {
      target: 'es2020',
    },
  },

  assetsInclude: ['**/*.webp', '**/*.png'],

  build: {
    // Increase chunk size warning limit slightly
    chunkSizeWarningLimit: 600,

    // Enable compressed size reporting
    reportCompressedSize: true,

    // CSS configuration
    cssMinify: true, // Use default minifier (or 'lightningcss' if you install it)
    cssCodeSplit: false,

    // Module preload polyfill
    modulePreload: {
      polyfill: true,
    },

    // Library configuration
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        // Add the styles as a separate entry
        styles: resolve(__dirname, 'src/styles.ts'),
      },
      name: 'NextCommerce',
      fileName: (format, entryName) => {
        if (entryName === 'styles') {
          return `${entryName}.${format}.js`;
        }
        return `${entryName}.${format}.js`;
      },
      formats: ['es'],
    },

    rollupOptions: {
      external: [
        // More specific external configuration
        /src\/config\.ts$/,
      ],

      output: {
        // Choose either preserveModules OR manualChunks, not both
        // Option 1: Use manual chunks (recommended for better control)
        manualChunks: (id: string) => {
          // Split node_modules into vendor chunk.
          // Note: highlight.js used to be routed to `debug` here, but Rollup
          // placed shared CJS-interop helpers into the debug chunk, creating
          // a vendor → debug → state → vendor cycle. Keep all node_modules
          // together; the size cost is paid back by avoiding TDZ bugs.
          if (id.includes('node_modules')) {
            return 'vendor';
          }

          // The debug overlay and its panels, from wherever they live:
          // `src/core/debug/`, `src/core/analytics/debug/`,
          // `src/features/checkout/debug/`, `src/styles/debug/`.
          //
          // This chunk is NOT lazy, despite what the rule looks like: nine
          // chunks import it statically, so every campaign page downloads it.
          // See finding 104 in docs/code-findings.md — fixing that is a
          // behaviour change and wants its own e2e run.
          //
          // Two more clauses used to sit on this line and matched nothing after
          // the `utils/` → `core/` migration: `/testMode` (the file is
          // `src/core/test-mode.ts` now) and `test-order-manager` (it already
          // lives under `/debug/`, and nothing imports it, so it never enters
          // the graph). Neither is restored. `core/sdk-initializer.ts` imports
          // `test-mode.ts` statically and instantiates its singleton at module
          // scope, so no chunk assignment can make test mode lazy — pointing
          // this rule at the new name would only move bytes between two chunks
          // the page already downloads, and add a tenth static edge into
          // `debug` for a later fix to unpick.
          if (id.includes('/debug/')) {
            return 'debug';
          }

          // Split analytics into separate chunk for lazy loading
          if (id.includes('/analytics/')) {
            return 'analytics';
          }

          // Co-locate state stores with the leaf modules they require at
          // module-init time (logger/storage/events). Without this, a `utils` ↔
          // `state` chunk cycle triggers a TDZ on Zustand's `create` import in
          // production.
          //
          // STALE, DELIBERATELY LEFT AS-IS — the second test is dead. Those three
          // files are `src/core/logger.ts`, `src/core/storage.ts` and
          // `src/core/events.ts` since the `utils/` → `core/` migration, so
          // `/utils/(…)` matches none of them and only `storage.ts` still lands
          // in `state`, by Rollup's own placement. `logger.ts` and `events.ts`
          // land in `analytics` instead, which is why `state` currently cannot
          // initialise without pulling the 119 kB `analytics` chunk (and through
          // it `debug`).
          //
          // Repairing it is one word — `/utils/` → `/core/` — and measurably
          // better: chunk-level cycles drop from 9 to 4, `state` sheds its edges
          // to `analytics`, and the ES output shrinks 243 B. It is not applied
          // here because it rewrites two chunks every campaign page downloads
          // (`analytics` −1,578 B, `state` +1,485 B, both re-hashed), and a
          // chunk reassignment is what caused the TDZ crash this comment records.
          // It wants its own change with an e2e run behind it.
          if (
            id.includes('/src/state/') ||
            /\/utils\/(logger|storage|events)\.ts$/.test(id)
          ) {
            return 'state';
          }

          // Split utilities into their own chunk. Note this catches
          // `src/features/*/utils/` too, not just `src/utils/` — after the
          // migration most of what lands here is checkout feature helpers.
          // (An `|| id.includes('/helpers/')` arm was dropped: there is no
          // `helpers/` folder anywhere under `src/`.)
          if (
            id.includes('/utils/') &&
            !id.includes('/debug/') &&
            !id.includes('/analytics/')
          ) {
            return 'utils';
          }

          // Split API layer
          if (id.includes('/api/')) {
            return 'api';
          }
        },

        // Option 2: If you prefer preserveModules, comment out manualChunks above and uncomment these:
        // preserveModules: true,
        // preserveModulesRoot: 'src',

        // Better file naming for caching
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: assetInfo => {
          // Extract CSS with proper naming
          if (
            assetInfo.name === 'style.css' ||
            assetInfo.name?.endsWith('.css')
          ) {
            return 'campaign-cart.css';
          }
          // Other assets
          const extType = assetInfo.name?.split('.').at(-1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType || '')) {
            return 'images/[name]-[hash][extname]';
          }
          if (/woff2?|ttf|otf|eot/i.test(extType || '')) {
            return 'fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },

        // Optimize globals
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },

        // Advanced options
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
          arrowFunctions: true,
        },

        // Don't inline dynamic imports for better code splitting
        inlineDynamicImports: false,

        // Must be an *output* plugin — see minifyEsLibChunks.
        plugins: [minifyEsLibChunks()],
      },

      // Tree-shaking optimizations
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
    },

    // Source maps only for debugging builds
    sourcemap: process.env.DEBUG === 'true' ? 'inline' : false,

    // Target modern browsers for smaller bundles
    target: 'es2020',

    // Inline assets smaller than 4kb
    assetsInlineLimit: 4096,

    // Output directory
    outDir: OUT_DIR,

    // Empty output directory before build
    emptyOutDir: true,

    // Only reaches the non-ES outputs of this build (there are none) — the ES chunks
    // are minified by the `minifyEsLibChunks` output plugin above, because Vite
    // exempts `build.lib` + `format: 'es'` from both of its minifiers.
    minify: 'terser',
    terserOptions,
  },

  // Development server configuration
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    hmr: {
      overlay: true,
      clientPort: 3000,
    },
    open: 'https://developers.29next.com/playground/?debug=true',
    cors: {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    },
    // Optimize dependency pre-bundling
    warmup: {
      clientFiles: ['./src/index.ts'],
    },
    allowedHosts: true,
  },

  // Public directory for serving static files (including debug files)
  publicDir: 'public',

  // Preview server configuration
  preview: {
    port: 4173,
    strictPort: true,
    host: true,
    cors: true,
  },

  // Performance optimizations
  esbuild: {
    legalComments: 'none',
    treeShaking: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },

  // JSON handling
  json: {
    namedExports: true,
    stringify: false,
  },
} as UserConfig);
