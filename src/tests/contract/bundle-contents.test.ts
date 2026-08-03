import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

/**
 * Production-bundle contract.
 *
 * `src/docs/` is ~11k lines of build-time documentation machinery — the manifest
 * schemas, the declaration/prose content, and the renderers and extractors that
 * turn them into the guides. Every enhancer and store ships a `*.manifest.ts` next
 * to its code (a deliberate decision: colocation is what keeps the docs from
 * drifting), and those manifests carry long prose strings and import the schema.
 *
 * None of it may reach a customer page. Tree-shaking removes all of it, but nothing
 * asserted that, so the guarantee was one stray runtime import away from silently
 * ending — and the symptom would be a bundle tens of kilobytes larger, which no
 * existing test or gate would notice.
 *
 * This test was the gate for moving that machinery out of `core/` and stays the gate
 * against it creeping back in.
 *
 * ## What it reads
 *
 * Every JavaScript file `npm run build` emits into `dist/`:
 *
 * - `dist/index.js` and `dist/styles.js` — the two ES entries;
 * - `dist/chunks/*.js` — the ES chunks, **the files a campaign page actually
 *   fetches**;
 * - `dist/index.umd.js` — the single-file UMD fallback.
 *
 * It deliberately does not read `dist/loader.js`: that is copied verbatim from
 * `public/loader.js` by the `build` script and is hand-written, not build output.
 *
 * Until 2026-08-02 only the UMD was scanned, which left the gate blind to exactly
 * the case its own comment claimed to guard — the docs layer sitting in a sibling
 * chunk. See finding 105 in `docs/code-findings.md`.
 *
 * ## What it cannot prove
 *
 * `dist/` is committed, and this test asserts on whatever is committed — not on a
 * bundle built from the current working tree. `.github/workflows/build.yml` runs
 * `bun run test:coverage` **before** `bun run build`, so in CI it always reads the
 * `dist/` that came with the checkout. A change that adds a runtime import of the
 * docs machinery therefore goes green here and only starts failing once someone
 * rebuilds and commits `dist/`. Treat a pass as "the artifact we ship today is
 * clean", not "the source we just wrote is clean". The tests below make that
 * failure mode loud in one direction at least: they fail if the ES chunks are
 * missing, so a `dist/` with no chunk output cannot pass by scanning nothing.
 */

const DIST = resolve(__dirname, '../../../dist');
const CHUNKS = join(DIST, 'chunks');

/**
 * Strings that exist only in the documentation layer. Each is a real substring of
 * a manifest, a docs renderer, or generated prose — never of runtime logic.
 */
const DOCS_ONLY_MARKERS = [
  'defineFeature', // the manifest factory every feature manifest calls
  'defineStore', // the state-manifest equivalent
  'CORE_CONSOLE_LOGS', // core log reference registry
  'Collapses a section behind', // accordion manifest summary prose
  'single source of truth', // recurring phrasing in the docs machinery
] as const;

/** Build output only — `loader.js` is copied from `public/`, not emitted. */
const ENTRY_FILES = ['index.js', 'styles.js', 'index.umd.js'];

function shippedFiles(): string[] {
  const entries = ENTRY_FILES.map(f => join(DIST, f)).filter(existsSync);
  const chunks = existsSync(CHUNKS)
    ? readdirSync(CHUNKS)
        .filter(f => f.endsWith('.js'))
        .map(f => join(CHUNKS, f))
    : [];
  return [...entries, ...chunks];
}

describe('production bundle contract', () => {
  // Skips on a clean checkout, or on `npm run test` before any build.
  const built = existsSync(DIST);

  it.skipIf(!built)('ships no documentation machinery', () => {
    const leaked: string[] = [];

    for (const file of shippedFiles()) {
      const contents = readFileSync(file, 'utf8');
      for (const marker of DOCS_ONLY_MARKERS) {
        if (contents.includes(marker)) {
          leaked.push(`${relative(DIST, file)}: ${marker}`);
        }
      }
    }

    // Named so a failure says which marker got into which file, not just that
    // one did.
    expect(
      leaked,
      'these strings exist only in the docs layer — a runtime import pulled the documentation machinery into a shipped bundle'
    ).toEqual([]);
  });

  it.skipIf(!built)(
    'scans the ES chunks a campaign page loads, not just the UMD',
    () => {
      // Without this the marker scan could pass by covering almost nothing: the
      // ES chunks are what a page fetches, and the UMD is only the fallback.
      expect(
        existsSync(join(DIST, 'index.js')),
        'dist/index.js — the ES entry — is missing'
      ).toBe(true);

      const chunks = shippedFiles().filter(f => f.startsWith(CHUNKS));
      expect(
        chunks.length,
        'dist/chunks/ holds no .js files, so the scan covered no chunks'
      ).toBeGreaterThan(10);
    }
  );

  it.skipIf(!built)('emits no empty bundle file', () => {
    // A truncated or zero-byte artifact would also let the marker scan pass.
    const empty = shippedFiles()
      .filter(f => statSync(f).size === 0)
      .map(f => relative(DIST, f));

    expect(empty, 'these shipped files are zero bytes').toEqual([]);
  });
});
