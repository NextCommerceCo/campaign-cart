import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Cross-chunk handshake contract.
 *
 * A handful of `_`-prefixed properties are written onto a DOM element by one feature
 * and read by another: `package-selector` publishes `_getSelectedPackageId` and
 * `accept-upsell` reads it; `bundle-selector` publishes `_getSelectedBundleItems` and
 * `add-to-cart`, `accept-upsell` and `upsell` read it. `manualChunks` assigns nothing
 * to `src/features/`, so each feature is its own Rollup chunk — the writer and the
 * reader are always in *different* files.
 *
 * That makes them a build-level contract, and it has been broken twice:
 *
 * - `terserOptions.mangle.properties.regex: /^_/` renamed them **per chunk**. Measured
 *   on a proof build: `_getSelectedBundleItems` became `i` where it was written and
 *   `i`, `t` and `l` in its three readers — one of which (`o`, for
 *   `_getSelectedBundleVouchers`) collided with `_selectedItem`. Bundle add-to-cart via
 *   accept-upsell, and all voucher resolution, would have returned `undefined` in
 *   production only.
 * - The same setting silently broke `_expression` in the UMD build, where
 *   `display-types.ts` compares a string-literal key against a dotted read of the same
 *   property. Terser rewrites one and not the other, so `supportsExpressions()` had
 *   been returning `false` for every expression binding.
 *
 * Neither failure is visible to any other test: the unit suite runs on source, not on
 * the built output. So this asserts on `dist/` directly, and skips when there is no
 * build to look at (a clean checkout, or `npm run test` before `npm run build`).
 *
 * Adding a new `_`-prefixed handshake means adding it here.
 */

const DIST = resolve(__dirname, '../../../dist');
const CHUNKS = resolve(DIST, 'chunks');
const UMD = resolve(DIST, 'index.umd.js');

/**
 * Each name, and the least it must survive as. `minReaders` counts *files* containing
 * it beyond none — a name that appears in only one chunk is a writer whose readers
 * have all been renamed away from it, which is the exact mangling failure.
 */
const HANDSHAKES = [
  { name: '_getSelectedPackageId', minChunks: 2 },
  { name: '_getSelectedItem', minChunks: 2 },
  { name: '_getSelectedBundleItems', minChunks: 2 },
  { name: '_getSelectedBundleVouchers', minChunks: 2 },
  { name: '_selectedPackageId', minChunks: 1 },
  { name: '_selectedItem', minChunks: 1 },
  // Written by core/sdk-initializer, read in features/cart/bundle-selector.
  { name: '_nextForceBundleId', minChunks: 2 },
  // Compared as a string literal *and* read as a property, in the same expression.
  { name: '_expression', minChunks: 1 },
] as const;

function chunkSources(): { file: string; code: string }[] {
  if (!existsSync(CHUNKS)) return [];
  return readdirSync(CHUNKS)
    .filter(name => name.endsWith('.js'))
    .map(name => ({
      file: name,
      code: readFileSync(resolve(CHUNKS, name), 'utf8'),
    }));
}

describe('cross-chunk handshake contract', () => {
  const chunks = chunkSources();
  const built = chunks.length > 0;

  it.skipIf(!built)(
    'keeps every cross-feature `_` property unmangled in the ESM chunks',
    () => {
      const broken = HANDSHAKES.filter(({ name, minChunks }) => {
        const hits = chunks.filter(chunk => chunk.code.includes(name));
        return hits.length < minChunks;
      }).map(({ name, minChunks }) => {
        const hits = chunks.filter(chunk => chunk.code.includes(name)).length;
        return `${name}: found in ${hits} chunk(s), needs at least ${minChunks}`;
      });

      expect(
        broken,
        'a cross-feature handshake property was renamed or dropped by the build — ' +
          'check terserOptions.mangle.properties in vite.config.ts, which must stay off'
      ).toEqual([]);
    }
  );

  it.skipIf(!existsSync(UMD))(
    'keeps them in the UMD build too',
    () => {
      const umd = readFileSync(UMD, 'utf8');
      const missing = HANDSHAKES.filter(
        ({ name }) => !umd.includes(name)
      ).map(({ name }) => name);

      expect(
        missing,
        'these were mangled out of the UMD bundle. `_expression` was genuinely ' +
          'broken this way, so a failure here is a real defect, not a stale expectation'
      ).toEqual([]);
    }
  );
});
