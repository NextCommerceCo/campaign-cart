import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import {
  NEXT_CART_OPERATIONS,
  NEXT_METHOD_GROUPS,
  NEXT_METHODS,
  WINDOW_GLOBALS,
  WINDOW_GROUPS,
} from '@/docs/content/next-methods';
import {
  renderJavaScriptApi,
  renderWindowSurface,
} from '@/docs/render/render-next-methods';
import {
  extractInterfaceCallables,
  extractPublicMembers,
  extractWindowSurface,
} from '@/docs/extract/extract-next-methods';

/**
 * Generates `src/core/guide/reference/javascript-api.md` and `window-surface.md`, and
 * fails when the committed markdown, the prose declaration, or the source drift apart.
 *
 * Regenerate:
 *   UPDATE_DOCS=1 npx vitest run src/tests/docs/nextMethods.test.ts
 *
 * The `core` equivalent of `featureReference.test.ts` / `stateReference.test.ts`, and a
 * test rather than a script for the same reason: the declarations load through Vite, so
 * TypeScript and `@/` resolve with no build step.
 *
 * What this is actually guarding against, in order of how much it cost last time:
 *
 *  1. **A public method nobody documented.** Seven of them — `swapCart`,
 *     `getVersion`, `triggerCallback`, `createVariantKey`, and the three variant
 *     lookups — were reachable as `next.*` and absent from the published list. The
 *     forward-direction check below is the test that would have caught them.
 *  2. **A row for a method that no longer exists.** The reverse direction.
 *  3. **A TSDoc block that is only `@category`.** Thirty-four of the 65 members had
 *     one: a heading to file the member under, and not one sentence. That publishes
 *     nothing, so it counts as undocumented here.
 *  4. **A `window.*` global installed and never written down.** `nextDebug` alone
 *     carries ~50 keys including all six raw stores.
 */

const UPDATE = process.env.UPDATE_DOCS === '1';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');

const FACADE = join(SRC, 'core/next-commerce.ts');
const CART_TYPES = join(SRC, 'state/cart/cart.types.ts');
const REF_DIR = join(SRC, 'core/guide/reference');

const members = extractPublicMembers(FACADE, 'NextCommerce');
const cartSignatures = extractInterfaceCallables(CART_TYPES, 'CartOperations');
const windowSurface = extractWindowSurface(SRC);

/**
 * Forbidden by `.claude/rules/documentation.md` §2 — they tell a reader nothing.
 *
 * The lookarounds exclude a hyphenated occurrence, because the exit-intent feature's
 * folder is literally `simple-exit-intent` and a link to its guide is not a style
 * violation.
 */
const FORBIDDEN =
  /(?<![\w-])(simple|simply|easy|easily|just|straightforward)(?![\w-])/i;

describe('window.next public facade', () => {
  it('finds the facade and its members', () => {
    expect(
      members.length,
      `no public members found on NextCommerce in ${FACADE}`
    ).toBeGreaterThan(0);
    expect(
      cartSignatures.length,
      'no CartOperations members found'
    ).toBeGreaterThan(0);
  });

  /**
   * The forward direction: a method added to the facade must be documented. This is
   * the check that closes the hole the whole file exists for.
   */
  it('documents every public member of NextCommerce', () => {
    const documented = new Set(NEXT_METHODS.map(m => m.name));
    const missing = members
      .map(m => m.name)
      .filter(name => !documented.has(name));
    expect(
      missing,
      'public on NextCommerce but not in NEXT_METHODS — add a summary and a runnable example to src/docs/content/next-methods.ts'
    ).toEqual([]);
  });

  /** The reverse: a documented method that no longer exists must lose its row. */
  it('documents no member that has been removed', () => {
    const real = new Set(members.map(m => m.name));
    const phantom = NEXT_METHODS.map(m => m.name).filter(
      name => !real.has(name)
    );
    expect(
      phantom,
      'documented in NEXT_METHODS but not public on NextCommerce — delete the row'
    ).toEqual([]);
  });

  it('files every documented method under a real group', () => {
    const ids = new Set(NEXT_METHOD_GROUPS.map(g => g.id));
    const orphans = NEXT_METHODS.filter(m => !ids.has(m.group)).map(
      m => m.name
    );
    expect(orphans, 'group id is not in NEXT_METHOD_GROUPS').toEqual([]);
  });

  it('leaves no group empty', () => {
    const used = new Set(NEXT_METHODS.map(m => m.group));
    const empty = NEXT_METHOD_GROUPS.filter(g => !used.has(g.id)).map(
      g => g.id
    );
    expect(
      empty,
      'group with no methods would render as an empty heading'
    ).toEqual([]);
  });

  /**
   * §2 of the documentation rules: a runnable example on every public method is the
   * single biggest readability win, and `...` is explicitly not one.
   */
  it('gives every method a summary and a runnable example', () => {
    const bad = NEXT_METHODS.filter(
      m =>
        !m.summary.trim() ||
        !m.example.trim() ||
        m.example.includes('...') ||
        m.example.includes('…')
    ).map(m => m.name);
    expect(
      bad,
      'needs a non-empty summary and an example with no `...` placeholder'
    ).toEqual([]);
  });

  it('uses no forbidden word', () => {
    const offenders = [
      ...NEXT_METHODS.flatMap(m =>
        [m.summary, m.caution ?? '', m.returns ?? '']
          .filter(text => FORBIDDEN.test(text))
          .map(() => `NEXT_METHODS.${m.name}`)
      ),
      ...NEXT_METHOD_GROUPS.filter(g => FORBIDDEN.test(g.intro)).map(
        g => `group ${g.id}`
      ),
      ...WINDOW_GLOBALS.flatMap(g =>
        [g.summary, g.caution ?? '']
          .filter(text => FORBIDDEN.test(text))
          .map(() => `WINDOW_GLOBALS.${g.name}`)
      ),
    ];
    expect(
      offenders,
      'documentation.md §2 forbids simple/easy/just/straightforward'
    ).toEqual([]);
  });

  /**
   * A member with no return annotation has nothing for the signature block to show, so
   * the reader learns what comes back only if the prose says. `getCartTotals()` and the
   * `cart` getter are both in that position.
   */
  it('spells out the return value where the source does not annotate one', () => {
    const unannotated = members.filter(m => !/\):|^\w+: /.test(m.signature));
    const documented = new Map(NEXT_METHODS.map(m => [m.name, m]));
    const missing = unannotated
      .filter(m => !documented.get(m.name)?.returns?.trim())
      .map(m => m.name);
    expect(
      missing,
      'has no return type in the source, so NEXT_METHODS needs a `returns` line'
    ).toEqual([]);
  });

  /**
   * Every member carries an `@category`, and the docs group by task — the two have to
   * stay reconcilable, or a reader following one lands somewhere the other does not
   * describe. Checked as "has one at all" rather than "matches the group", because the
   * groups deliberately split `Cart` into reading and writing.
   */
  it('keeps an @category on every public member', () => {
    const uncategorised = members.filter(m => !m.category).map(m => m.name);
    expect(
      uncategorised,
      'add an @category tag so the TypeDoc grouping stays complete'
    ).toEqual([]);
  });

  /**
   * The finding this exercise started from: a TSDoc block of only `/** @category Cart *\/`
   * publishes no sentence, so it documents nothing for the next maintainer reading the
   * source. Thirty-four of 65 members were in that state.
   */
  it('gives every public member a real TSDoc summary, not a bare @category', () => {
    const bare = members
      .filter(m => !m.hasSummary)
      .map(m => `${m.name} (${m.symbol})`);
    expect(
      bare,
      'TSDoc block carries only tags — add a summary sentence above the @category line'
    ).toEqual([]);
  });
});

describe('next.cart operations', () => {
  it('documents every CartOperations member', () => {
    const documented = new Set(NEXT_CART_OPERATIONS.map(o => o.name));
    const missing = cartSignatures
      .map(c => c.name)
      .filter(name => !documented.has(name));
    expect(
      missing,
      'on CartOperations but not in NEXT_CART_OPERATIONS'
    ).toEqual([]);
  });

  it('documents no operation that has been removed', () => {
    const real = new Set(cartSignatures.map(c => c.name));
    const phantom = NEXT_CART_OPERATIONS.map(o => o.name).filter(
      name => !real.has(name)
    );
    expect(
      phantom,
      'documented but not on CartOperations — delete the row'
    ).toEqual([]);
  });

  it('states an effect for every operation', () => {
    const silent = NEXT_CART_OPERATIONS.filter(o => !o.effect.trim()).map(
      o => o.name
    );
    expect(silent, 'every operation needs an effect in reader terms').toEqual(
      []
    );
  });
});

describe('window surface', () => {
  /** Every name a row accounts for, `covers` expanded. */
  const documentedNames = new Set(
    WINDOW_GLOBALS.flatMap(g => g.covers ?? [g.name])
  );

  it('finds globals in the source', () => {
    expect(
      windowSurface.installs.length,
      'no window installs found'
    ).toBeGreaterThan(0);
  });

  it('documents every global the SDK installs', () => {
    const missing = windowSurface.installs
      .map(g => g.name)
      .filter(name => !documentedNames.has(name));
    expect(
      missing,
      'assigned to window somewhere under src/core or src/features but not in WINDOW_GLOBALS'
    ).toEqual([]);
  });

  it('documents every SDK-namespaced global the SDK reads', () => {
    const missing = windowSurface.reads
      .map(g => g.name)
      .filter(name => !documentedNames.has(name));
    expect(missing, 'read from window but not in WINDOW_GLOBALS').toEqual([]);
  });

  it('documents no global that is no longer touched', () => {
    const real = new Set([
      ...windowSurface.installs.map(g => g.name),
      ...windowSurface.reads.map(g => g.name),
    ]);
    const phantom = [...documentedNames].filter(name => !real.has(name));
    expect(
      phantom,
      'documented in WINDOW_GLOBALS but no longer assigned or read — delete the row'
    ).toEqual([]);
  });

  it('agrees with the source about which direction each global goes', () => {
    const installed = new Set(windowSurface.installs.map(g => g.name));
    const wrong = WINDOW_GLOBALS.filter(g => {
      const names = g.covers ?? [g.name];
      const anyInstalled = names.some(n => installed.has(n));
      return g.direction === 'install' ? !anyInstalled : anyInstalled;
    }).map(g => `${g.name} (documented as ${g.direction})`);
    expect(
      wrong,
      'a global the SDK assigns is an `install`; one it only reads is a `read`'
    ).toEqual([]);
  });

  it('files every global under a real audience group', () => {
    const audiences = new Set(WINDOW_GROUPS.map(g => g.audience));
    const orphans = WINDOW_GLOBALS.filter(g => !audiences.has(g.audience)).map(
      g => g.name
    );
    expect(orphans, 'audience is not in WINDOW_GROUPS').toEqual([]);
  });

  it('describes every global', () => {
    const silent = WINDOW_GLOBALS.filter(g => !g.summary.trim()).map(
      g => g.name
    );
    expect(silent, 'every global needs one sentence saying what it is').toEqual(
      []
    );
  });

  /** A `page`-audience global is something a reader is meant to use, so show them how. */
  it('gives every supported global a runnable example', () => {
    const bad = WINDOW_GLOBALS.filter(
      g =>
        g.audience === 'page' &&
        (!g.example?.trim() || g.example.includes('...'))
    ).map(g => g.name);
    expect(bad, 'a global on the supported page API needs an example').toEqual(
      []
    );
  });
});

describe('generated pages', () => {
  const cases = [
    {
      out: join(REF_DIR, 'javascript-api.md'),
      render: () =>
        renderJavaScriptApi({
          groups: NEXT_METHOD_GROUPS,
          methods: NEXT_METHODS,
          members,
          cartOperations: NEXT_CART_OPERATIONS,
          cartSignatures,
        }),
    },
    {
      out: join(REF_DIR, 'window-surface.md'),
      render: () =>
        renderWindowSurface({
          groups: WINDOW_GROUPS,
          globals: WINDOW_GLOBALS,
          installs: windowSurface.installs,
          reads: windowSurface.reads,
        }),
    },
  ];

  it.each(cases)('$out matches its source', ({ out, render }) => {
    const expected = render();
    if (UPDATE) {
      mkdirSync(REF_DIR, { recursive: true });
      writeFileSync(out, expected);
    }
    expect(
      existsSync(out),
      `${relative(SRC, out)} is missing — regenerate with UPDATE_DOCS=1`
    ).toBe(true);
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });

  /**
   * Every relative link has to land on a real file.
   *
   * `.claude/rules/documentation.md` §4 says cross-link rather than duplicate, which
   * only works while the links resolve — and these pages sit three and four levels
   * deep, so a link into `state/` or the repo-root `docs/` is exactly the kind a
   * reader finds broken before an author does. In-page anchors (`#…`) and absolute
   * URLs are out of scope.
   */
  it.each(cases)('$out links only to files that exist', ({ out, render }) => {
    const markdown = render();
    const broken: string[] = [];
    for (const match of markdown.matchAll(/\]\(([^)#\s]+\.md)\)/g)) {
      const target = match[1];
      if (!target || /^[a-z]+:/.test(target)) continue;
      if (!existsSync(join(dirname(out), target))) broken.push(target);
    }
    expect(
      broken,
      `unresolved relative links in ${relative(SRC, out)}`
    ).toEqual([]);
  });
});
