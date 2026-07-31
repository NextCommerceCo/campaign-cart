import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Dynamic-import contract.
 *
 * Every enhancer in this SDK is code-split behind a dynamic `import()`. Nothing
 * imports them statically, so a broken specifier does NOT fail `type-check` and
 * does NOT fail any other test — the enhancer simply never instantiates and the
 * feature goes silently dead on customer pages. That is the exact failure mode
 * a folder move introduces (`sdk-structure` §9: "update the `import('…')` path
 * for any moved feature folder, or that feature never instantiates").
 *
 * This test is the guard for the structure migration: it resolves every
 * dynamic-import specifier in the three files that carry them and asserts the
 * target module exists and really exports the binding the caller destructures.
 */

const SRC = resolve(__dirname, '../..');

/** The only three files that dynamically import features. Keep this list exact. */
const IMPORT_SITES = [
  'core/attribute-scanner.ts', // activation — a broken path kills the feature
  'index.ts', // idle-time preload hints
  'core/next-commerce.ts', // FomoPopupEnhancer, loaded on demand
] as const;

/** `const { Name } = await import('spec')` — activation sites we can name-check. */
const DESTRUCTURED = /const\s*\{\s*(\w+)\s*\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Any `import('spec')` — including bare preload hints with no destructuring. */
const ANY_IMPORT = /(?<!\.)\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Resolve a specifier the way Vite does: `@/x` → `src/x`, `./x` → relative to
 * the importing file. A folder specifier resolves through its `index.ts` barrel.
 */
function resolveSpecifier(spec: string, importerAbs: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) {
    base = resolve(SRC, spec.slice(2));
  } else if (spec.startsWith('.')) {
    base = resolve(dirname(importerAbs), spec);
  } else {
    return null; // bare package import — not ours to resolve
  }

  for (const candidate of [`${base}.ts`, resolve(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readSite(site: string) {
  const abs = resolve(SRC, site);
  return { abs, source: readFileSync(abs, 'utf8') };
}

describe('dynamic-import contract', () => {
  it.each(IMPORT_SITES)('every specifier in %s resolves to a real module', site => {
    const { abs, source } = readSite(site);

    const unresolved = [...source.matchAll(ANY_IMPORT)]
      .map(m => m[1] as string)
      .filter(spec => spec.startsWith('@/') || spec.startsWith('.'))
      .filter(spec => resolveSpecifier(spec, abs) === null);

    // Named so a failure prints the dead paths, not just a count.
    expect(unresolved).toEqual([]);
  });

  it('attribute-scanner still carries the full activation table', () => {
    const { source } = readSite('core/attribute-scanner.ts');
    const found = [...source.matchAll(DESTRUCTURED)];

    // Guards the regex itself: if the call style changes, this drops to 0 and
    // the export assertions below would silently pass on an empty set.
    expect(found.length).toBeGreaterThanOrEqual(31);
  });

  it('every enhancer the scanner activates really exports that binding', async () => {
    const { abs, source } = readSite('core/attribute-scanner.ts');

    const missing: string[] = [];
    for (const [, name, spec] of source.matchAll(DESTRUCTURED)) {
      const target = resolveSpecifier(spec as string, abs);
      if (target === null) {
        missing.push(`${spec} → module not found`);
        continue;
      }
      // Import the resolved absolute path: a runtime specifier bypasses Vite's
      // `@/` alias, so the alias has to be applied before we get here.
      const mod: Record<string, unknown> = await import(/* @vite-ignore */ target);
      if (typeof mod[name as string] !== 'function') {
        missing.push(`${spec} → does not export class ${name}`);
      }
    }

    expect(missing).toEqual([]);
  });
});
