import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every source citation written by hand actually points at something.
 *
 * The generated pages cite the enclosing symbol and are checked by their own drift tests
 * (`source-anchor.ts` and `documentation-plan.md` §0a). **Hand-written prose is the half
 * nothing checked.** Those citations are literal strings that no generator rewrites, so
 * when the code moves they do not fail — they just quietly start lying, which is worse
 * than a gap because a reader trusts a specific file and line.
 *
 * That is not hypothetical: moving `checkout-form.enhancer.ts` into its feature folder
 * left `core/guide/subsystems/test-mode.md` citing a path that no longer existed, and
 * every gate stayed green.
 *
 * Two rules, both aimed at that failure:
 *
 * 1. **A cited file must exist.** Applies to every form, and it is what catches a move.
 * 2. **A cited symbol must be in that file.** Applies to the `file › Symbol` form, and it
 *    is what catches a rename.
 *
 * Line-number citations (`file.ts:412`) get rule 1 but cannot get rule 2 — the number is
 * a property of the formatting, not of the code, so there is nothing stable to verify it
 * against. They are counted instead, against a ceiling that may only ratchet **down**:
 * every one converted to `file › Symbol` is a citation that starts being checked properly.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '../..');
const ROOT = join(SRC, '..');

/**
 * Hand-written prose that cites source. Deliberately not the generated
 * `guide/reference/*.md` pages — those are rendered from the files below, so a stale
 * citation there is a symptom, and fixing it here fixes it in both places.
 */
const PROSE = {
  ...import.meta.glob<string>('../../docs/content/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob<string>('../../docs/render/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob<string>('../../core/guide/subsystems/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};

/** `core/logger.ts:16-26`, `analytics/index.ts:100` — a path plus a line or range. */
const LINE_REF = /([A-Za-z0-9._/-]+\.(?:ts|js)):(\d+)(?:-\d+)?/g;
/** `` `sdk-initializer.ts › SDKInitializer.initialize` `` — a path plus a symbol. */
const SYMBOL_REF = /([A-Za-z0-9._/-]+\.(?:ts|js)) › ([A-Za-z0-9_.<>]+)/g;

/**
 * Every source file, indexed by basename, for citations written as a bare filename.
 *
 * Prose legitimately says `dom-observer.ts` rather than `core/base/dom-observer.ts` — on a
 * core page the shorter form reads better and is unambiguous. So a bare name resolves,
 * **as long as exactly one file has it**: an ambiguous basename is recorded as such and
 * reported, because prose that could mean either file is prose a reader cannot follow.
 */
const byBasename = new Map<string, string[]>();
for (const key of Object.keys(
  import.meta.glob('../../**/*.{ts,js}', { eager: false })
)) {
  const abs = join(HERE, key);
  if (abs.includes('/tests/') || abs.endsWith('.test.ts')) continue;
  const base = abs.slice(abs.lastIndexOf('/') + 1);
  byBasename.set(base, [...(byBasename.get(base) ?? []), abs]);
}

/**
 * Citations are written relative to whatever the reader would recognise — `core/logger.ts`,
 * `features/checkout/…`, or a bare `sdk-initializer.ts` inside a core page. So each is
 * resolved against the roots a reader could mean, then by basename, and only counts as
 * broken when none of those find it.
 */
function resolveCited(path: string): string | undefined {
  const direct = [
    join(SRC, path),
    join(ROOT, path),
    join(SRC, 'core', path),
    join(SRC, 'features', path),
  ].find(existsSync);
  if (direct !== undefined) return direct;

  if (!path.includes('/')) {
    const matches = byBasename.get(path);
    // Exactly one — an ambiguous basename is left unresolved and reported.
    if (matches?.length === 1) return matches[0];
  }
  return undefined;
}

/** `{name}`-style placeholders are prose, not paths — `{feature}.enhancer.ts` is not a file. */
function isPlaceholder(path: string): boolean {
  return path.includes('{') || path.includes('$');
}

interface Cite {
  where: string;
  path: string;
  symbol?: string;
}

const lineRefs: Cite[] = [];
const symbolRefs: Cite[] = [];

for (const [key, text] of Object.entries(PROSE)) {
  const where = relative(SRC, join(HERE, key));

  for (const [, path, symbol] of text.matchAll(SYMBOL_REF)) {
    if (path && symbol && !isPlaceholder(path)) {
      symbolRefs.push({ where, path, symbol });
    }
  }
  // A symbol citation contains no colon, so the two patterns cannot double-count.
  for (const [, path] of text.matchAll(LINE_REF)) {
    if (path && !isPlaceholder(path)) lineRefs.push({ where, path });
  }
}

/**
 * Line-number citations allowed in hand-written prose: **none**.
 *
 * This started as a ratchet at 79 — the count when the gate was written. All 79 were
 * converted to `file › Symbol`, so it is now a flat ban, which is the stronger and
 * simpler rule: every citation in these files is checkable, and none can silently rot.
 *
 * Do not raise this to let one through. A line number is unverifiable by construction;
 * cite the enclosing symbol and the two checks above will keep it honest.
 */
const LINE_REF_CEILING = 0;

describe('hand-written source citations', () => {
  it('found citations to check, so a broken glob cannot pass silently', () => {
    expect(lineRefs.length + symbolRefs.length).toBeGreaterThan(20);
  });

  it('cites only files that exist', () => {
    const broken = [...lineRefs, ...symbolRefs]
      .filter(c => resolveCited(c.path) === undefined)
      .map(c => `${c.where} → ${c.path}`);

    expect(
      [...new Set(broken)],
      'cited in prose but no such file — the code moved and the prose did not. This is ' +
        'the check that a generated page cannot do for you'
    ).toEqual([]);
  });

  it('cites only symbols that are really in the file named', () => {
    const broken = symbolRefs
      .filter(c => {
        const file = resolveCited(c.path);
        if (file === undefined) return false; // already reported above
        const source = readFileSync(file, 'utf8');
        // The last segment is what appears in the source: `Class.method` is declared as
        // `method(`, and a bare function as `function name` or `const name`.
        const name = c.symbol?.split('.').pop() ?? '';
        return name !== '' && !new RegExp(`\\b${name}\\b`).test(source);
      })
      .map(c => `${c.where} → ${c.path} › ${c.symbol}`);

    expect(
      [...new Set(broken)],
      'cited symbol is not in that file — it was renamed or moved'
    ).toEqual([]);
  });

  it('does not add new line-number citations', () => {
    expect(
      lineRefs.length,
      `hand-written line-number citations rose above ${LINE_REF_CEILING}. A line number ` +
        'cannot be verified and goes stale on the next reformat — cite the enclosing ' +
        'symbol instead (`file.ts › Class.method`), which this suite does check. If you ' +
        'converted some, lower LINE_REF_CEILING to the new count.'
    ).toBeLessThanOrEqual(LINE_REF_CEILING);
  });
});
