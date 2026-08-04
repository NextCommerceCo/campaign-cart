import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Keeps `@category` tags and `typedoc.json`'s `categoryOrder` in agreement.
 *
 * `categorizeByGroup` is `false`, so categories are the docs sidebar's top-level
 * axis and `categoryOrder` fixes their order. A category that is tagged in the
 * source but missing from the list falls into the trailing `*` bucket and is
 * ordered arbitrarily; a category listed but never tagged is a dead entry that
 * reads like a section of the API that does not exist.
 *
 * Neither shows up anywhere: TypeDoc does not warn, and `docs:coverage` measures
 * documentation gaps rather than sidebar config. The drift was found by hand at
 * 7 unordered categories covering 54 of 129 tagged symbols, which is what this
 * test exists to stop happening again.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');

/** `@category X` on a real TSDoc line — not the tag named inside prose about it. */
const CATEGORY_LINE = /^\s*\*?\s*@category[ \t]+(\S.*?)\s*$/gm;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'guide') continue;
      walk(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

function usedCategories(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of walk(join(ROOT, 'src'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(CATEGORY_LINE)) {
      const name = m[1];
      // Skip prose that quotes the tag, e.g. `/** @category Cart */` inside a
      // comment explaining the tag — those close the block on the same line.
      if (!name || name.includes('*/') || name.startsWith('`')) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

function categoryOrder(): string[] {
  const raw = readFileSync(join(ROOT, 'typedoc.json'), 'utf8');
  return (JSON.parse(raw) as { categoryOrder: string[] }).categoryOrder;
}

describe('typedoc categoryOrder', () => {
  it('orders every category the source actually tags', () => {
    const order = new Set(categoryOrder());
    const unordered = [...usedCategories()]
      .filter(([name]) => !order.has(name))
      .map(([name, n]) => `${name} (${n} uses)`)
      .sort();

    expect(
      unordered,
      'tagged in src/ but missing from categoryOrder in typedoc.json, so they ' +
        'land in the unordered "*" bucket — add them to the list'
    ).toEqual([]);
  });

  it('lists no category that nothing tags', () => {
    const used = usedCategories();
    const dead = categoryOrder().filter(name => name !== '*' && !used.has(name));

    expect(
      dead,
      'listed in categoryOrder but tagged nowhere in src/ — remove them, or the ' +
        'sidebar advertises a section of the API that does not exist'
    ).toEqual([]);
  });

  it('keeps the catch-all last so an untagged category still sorts predictably', () => {
    const order = categoryOrder();
    expect(order[order.length - 1]).toBe('*');
  });
});
