/**
 * Pulls the documentation example out of a Playwright fixture.
 *
 * A guide's markup examples are the part most likely to be quietly wrong: nothing
 * runs them, so an attribute can be renamed in the code and the snippet keeps
 * showing the old spelling forever. The e2e fixtures under `e2e/fixtures/` do not
 * have that problem — Playwright boots the real SDK against them on every
 * `npm run test:e2e`, so markup that is broken fails a test.
 *
 * A fixture marks the part worth showing with a comment pair:
 *
 * ```html
 * <!-- docs:example Add a fixed package to the cart -->
 * <button data-next-action="add-to-cart" data-next-package-id="1">Add</button>
 * <!-- /docs:example -->
 * ```
 *
 * Everything between the markers becomes the snippet; the text after
 * `docs:example` becomes its heading. A fixture with no marker yields `undefined`
 * and the feature simply has no generated example page.
 *
 * @internal
 */

import { readFileSync, existsSync } from 'node:fs';

/** One `docs:example` region lifted from a fixture. */
export interface FixtureExample {
  /** Heading text written after the opening marker. */
  title: string;
  /** The markup itself, dedented, with fixture-only comments kept as-is. */
  html: string;
  /** Fixture path relative to the repo root, for the generated attribution. */
  fixture: string;
  /** Spec path relative to the repo root, when a same-named spec exists. */
  spec?: string;
}

const REGION = /<!--\s*docs:example\s*(.*?)\s*-->\n([\s\S]*?)^[ \t]*<!--\s*\/docs:example\s*-->/m;

/**
 * Removes the shared leading indentation, so markup nested four levels deep inside
 * a fixture's `<body>` reads as a top-level snippet.
 */
function dedent(block: string): string {
  const lines = block.replace(/\s+$/, '').split('\n');
  const indents = lines
    .filter(line => line.trim() !== '')
    .map(line => line.match(/^[ \t]*/)?.[0].length ?? 0);
  const shortest = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map(line => line.slice(shortest)).join('\n');
}

/**
 * @param fixture absolute path to the fixture HTML
 * @param repoRoot absolute path to the repo root, for the relative attribution
 */
export function extractFixtureExample(
  fixture: string,
  repoRoot: string
): FixtureExample | undefined {
  if (!existsSync(fixture)) return undefined;

  const match = REGION.exec(readFileSync(fixture, 'utf8'));
  if (!match) return undefined;

  const relative = (p: string): string =>
    p.startsWith(repoRoot) ? p.slice(repoRoot.length).replace(/^\//, '') : p;

  const spec = fixture
    .replace('/fixtures/', '/')
    .replace(/\.html$/, '.spec.ts');

  return {
    title: match[1] || 'Example',
    html: dedent(match[2]),
    fixture: relative(fixture),
    ...(existsSync(spec) ? { spec: relative(spec) } : {}),
  };
}
