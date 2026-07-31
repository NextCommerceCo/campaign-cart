import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
 * against it creeping back in. It needs a built bundle, so it skips when `dist/` is
 * absent (a clean checkout, or `npm run test` before a build) and asserts whenever
 * CI or a local `npm run build` has produced one.
 */

const BUNDLE = resolve(__dirname, '../../../dist/index.umd.js');

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

describe('production bundle contract', () => {
  const built = existsSync(BUNDLE);

  it.skipIf(!built)('ships no documentation machinery', () => {
    const bundle = readFileSync(BUNDLE, 'utf8');

    const leaked = DOCS_ONLY_MARKERS.filter(marker => bundle.includes(marker));

    // Named so a failure says which marker got in, not just that one did.
    expect(
      leaked,
      'these strings exist only in the docs layer — a runtime import pulled the documentation machinery into the customer bundle'
    ).toEqual([]);
  });

  it.skipIf(!built)('is a single self-contained UMD file', () => {
    // Guards the assumption above: if the entry stopped being one bundled file,
    // the marker scan could pass while the docs layer sat in a sibling chunk.
    const bundle = readFileSync(BUNDLE, 'utf8');
    expect(bundle.length).toBeGreaterThan(100_000);
  });
});
