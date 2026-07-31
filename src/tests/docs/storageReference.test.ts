import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import {
  EXPIRY_MECHANISMS,
  STORAGE_GROUPS,
  STORAGE_KEYS_DOC,
  UNSCANNABLE_STORAGE_KEYS,
} from '@/docs/content/storage-keys';
import {
  renderStorageReference,
  type ExtractedKeyFacts,
} from '@/docs/render/render-storage-reference';
import { extractStorageKeys, toPattern } from '@/docs/extract/extract-storage-keys';

/**
 * Generates `src/core/guide/reference/storage-keys.md` from the source plus
 * `src/docs/content/storage-keys.ts`, and fails when the committed markdown drifts.
 *
 * Regenerate:
 *   UPDATE_DOCS=1 npm run docs:reference
 *
 * The core equivalent of `stateReference.test.ts`, and a test rather than a script for
 * the same reason: the manifest loads through Vite, so TypeScript and `@/` resolve
 * with no extra build step.
 *
 * The check that matters runs **both directions**. A key added to the code without a
 * row here fails, so a new storage entry cannot stay undocumented. A row here whose
 * key has left the code fails too, so the page cannot keep describing storage the SDK
 * no longer writes — which is the worse failure, because a reader trusts it.
 */

const UPDATE = process.env.UPDATE_DOCS === '1';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '../..');
const OUT_DIR = join(SRC, 'core/guide/reference');
const OUT = join(OUT_DIR, 'storage-keys.md');

/**
 * Every runtime file under `src/`. Tests are excluded because a fixture key is not a
 * real key, and `docs/` because those manifests quote keys in prose — counting the
 * documentation as evidence of the code would make the drift check circular.
 */
const sources = Object.entries(
  import.meta.glob<string>('../../**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
)
  .filter(
    ([path]) =>
      !/\.(test|spec)\.ts$/.test(path) &&
      !path.startsWith('../../tests/') &&
      !path.startsWith('../../test/') &&
      !path.startsWith('../../docs/') &&
      !/\.manifest\.ts$/.test(path)
  )
  .map(
    ([path, text]) =>
      [path.replace(/^\.\.\/\.\.\//, ''), text] as [string, string]
  );

const extracted = extractStorageKeys(sources);
const byPattern = new Map(extracted.map(k => [k.pattern, k]));

/** The extractor's half of each row, keyed by the documented key. */
const facts = new Map<string, ExtractedKeyFacts>();
for (const doc of [...STORAGE_KEYS_DOC, ...UNSCANNABLE_STORAGE_KEYS]) {
  const found = byPattern.get(toPattern(doc.key));
  if (!found) continue;
  facts.set(doc.key, {
    areas: found.areas,
    firstSite: found.where[0] ?? '',
    siteCount: found.where.length,
  });
}

describe('storage key reference', () => {
  it('finds the storage keys in the source', () => {
    expect(sources.length).toBeGreaterThan(100);
    // A refactor that broke the scan would otherwise look like "no keys changed".
    expect(extracted.length).toBeGreaterThan(30);
  });

  /**
   * Forward: a key the SDK writes must be documented. Without this the page slowly
   * becomes a list of the keys someone remembered in 2026.
   */
  it('documents every key found in the source', () => {
    const documented = new Set(STORAGE_KEYS_DOC.map(d => toPattern(d.key)));
    const missing = extracted
      .filter(k => !documented.has(k.pattern))
      .map(k => `${k.key} (${k.where[0]})`);
    expect(
      missing,
      'written by the SDK but absent from STORAGE_KEYS_DOC in docs/content/storage-keys.ts'
    ).toEqual([]);
  });

  /** Reverse: a key that has left the code must lose its row. */
  it('documents no key that has left the source', () => {
    const phantom = STORAGE_KEYS_DOC.filter(
      d => !byPattern.has(toPattern(d.key))
    ).map(d => d.key);
    expect(
      phantom,
      'documented in docs/content/storage-keys.ts but no longer read or written anywhere under src/'
    ).toEqual([]);
  });

  it('gives every key a store, a lifetime answer, and a cost of clearing', () => {
    const incomplete = [...STORAGE_KEYS_DOC, ...UNSCANNABLE_STORAGE_KEYS]
      .filter(d => !d.holds?.trim() || !d.clearing?.trim())
      .map(d => d.key);
    expect(
      incomplete,
      'every key needs `holds` (what is inside) and `clearing` (what the visitor loses)'
    ).toEqual([]);
  });

  it('files every key under a real group', () => {
    const groups = new Set(STORAGE_GROUPS.map(g => g.id));
    const orphans = [...STORAGE_KEYS_DOC, ...UNSCANNABLE_STORAGE_KEYS]
      .filter(d => !groups.has(d.group))
      .map(d => `${d.key} → ${d.group}`);
    expect(orphans, 'group must be one of STORAGE_GROUPS').toEqual([]);
  });

  it('documents one key per row', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const doc of [...STORAGE_KEYS_DOC, ...UNSCANNABLE_STORAGE_KEYS]) {
      if (seen.has(doc.key)) duplicates.push(doc.key);
      seen.add(doc.key);
    }
    expect(duplicates, 'the same key is documented twice').toEqual([]);
  });

  /**
   * The whole point of the page: the reader must be able to find where a window is
   * enforced. A renamed or deleted constant has to fail here rather than leave the
   * page pointing at a file that no longer says that.
   */
  it('anchors every expiry window to text that is still in the source', () => {
    const stale = EXPIRY_MECHANISMS.filter(m => {
      const file = join(SRC, m.file);
      return (
        !existsSync(file) || !readFileSync(file, 'utf8').includes(m.evidence)
      );
    }).map(m => `${m.name} — expected "${m.evidence}" in ${m.file}`);
    expect(
      stale,
      'an expiry window points at source that no longer contains it — update EXPIRY_MECHANISMS'
    ).toEqual([]);
  });

  it('names an expiry mechanism that exists for every key that claims one', () => {
    const known = new Set(EXPIRY_MECHANISMS.map(m => m.name));
    const unknown = [...STORAGE_KEYS_DOC, ...UNSCANNABLE_STORAGE_KEYS]
      .filter(d => d.ttlMechanism && !known.has(d.ttlMechanism))
      .map(d => `${d.key} → ${d.ttlMechanism}`);
    expect(
      unknown,
      'ttlMechanism must match an EXPIRY_MECHANISMS name'
    ).toEqual([]);
  });

  /**
   * Hand-written rows are the one place a key can rot unnoticed, so each is pinned to
   * a line of source. If the scan ever learns to see one of these, it will show up as
   * a duplicate in the forward check above.
   */
  it('anchors every hand-written key to text that is still in the source', () => {
    const stale = UNSCANNABLE_STORAGE_KEYS.filter(d => {
      const file = join(SRC, d.file);
      return (
        !existsSync(file) || !readFileSync(file, 'utf8').includes(d.evidence)
      );
    }).map(d => `${d.key} — expected "${d.evidence}" in ${d.file}`);
    expect(
      stale,
      'a hand-written key points at source that no longer contains it'
    ).toEqual([]);
  });

  it('links only to store references that exist', () => {
    const broken = STORAGE_KEYS_DOC.filter(d => d.store)
      .filter(
        d =>
          !existsSync(
            join(SRC, `state/${d.store}/guide/reference/state-reference.md`)
          )
      )
      .map(d => `${d.key} → ${d.store}`);
    expect(
      broken,
      'the store this key names has no generated state reference to link to'
    ).toEqual([]);
  });

  /**
   * Prose only, not the rendered page: the page carries source paths, and one of them
   * is `features/behavior/simple-exit-intent/simple-exit-intent.enhancer.ts`. Checking the whole output
   * would fail on a filename and teach whoever hit it to delete the test.
   */
  it('keeps the forbidden words out of the prose', () => {
    const prose = [
      ...STORAGE_GROUPS.map(g => g.intro),
      ...[...STORAGE_KEYS_DOC, ...UNSCANNABLE_STORAGE_KEYS].flatMap(d => [
        d.holds,
        d.clearing,
        d.notes ?? '',
        d.ttl ?? '',
      ]),
      ...EXPIRY_MECHANISMS.flatMap(m => [m.window, m.governs]),
    ]
      .join('\n')
      .toLowerCase();

    const banned = ['simple', 'easy', 'just ', 'straightforward'].filter(word =>
      prose.includes(word)
    );
    expect(banned, 'see .claude/rules/documentation.md §2').toEqual([]);
  });

  it('storage-keys.md matches the registry', () => {
    const expected = renderStorageReference({
      docs: STORAGE_KEYS_DOC,
      unscannable: UNSCANNABLE_STORAGE_KEYS,
      mechanisms: EXPIRY_MECHANISMS,
      facts,
    });
    if (UPDATE) {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(OUT, expected);
    }
    expect(existsSync(OUT), `${relative(SRC, OUT)} is missing`).toBe(true);
    expect(readFileSync(OUT, 'utf8')).toBe(expected);
  });
});
