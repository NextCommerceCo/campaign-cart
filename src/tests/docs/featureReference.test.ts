import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, relative } from 'node:path';
import type {
  DisplayFallback,
  FeatureManifest,
  UnansweredPath,
} from '@/docs/schema/feature-manifest';
import type { DisplayPath } from '@/docs/render/render-feature-reference';
import {
  renderAttributes,
  renderDisplayPaths,
  renderEvents,
  renderErrors,
  renderGetStarted,
  renderLogs,
  renderRelations,
  renderTestedExample,
} from '@/docs/render/render-feature-reference';
import { extractEventDocs } from '@/docs/extract/extract-event-docs';
import {
  extractDisplayPaths,
  extractResolvedDisplayPaths,
  findPropertyMappings,
} from '@/docs/extract/extract-display-paths';
import { declaresPath, readDeclaredShapes } from '@/docs/extract/type-shape';
import { extractFixtureExample } from '@/docs/extract/extract-fixture-example';
import { extractLogs, extractThrows } from '@/docs/extract/extract-logs';
import { SDK_ATTRIBUTES } from '@/docs/content/sdk-attributes';
import { renderHtmlCustomData } from '@/docs/render/render-html-custom-data';
import {
  renderAttributeIndex,
  renderSdkAttributes,
} from '@/docs/render/render-attribute-index';

/**
 * Generates each feature's `guide/reference/attributes.md` and `events.md` from
 * its `*.manifest.ts`, and fails when the committed markdown drifts from what the
 * manifest produces.
 *
 * Regenerate after editing a manifest:
 *   UPDATE_DOCS=1 npm run docs:reference
 *
 * Runs as a test rather than a standalone script so the manifests are loaded
 * through Vite — TypeScript and `@/` aliases resolve with no extra build step.
 * Same pattern as src/tests/utils/analyticsVocabulary.test.ts.
 */

const UPDATE = process.env.UPDATE_DOCS === '1';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');

// Eager so the manifests are available synchronously inside `it` blocks.
const modules = import.meta.glob<{ default: FeatureManifest }>(
  '../../features/**/*.manifest.ts',
  { eager: true }
);

const eventDocs = extractEventDocs(join(SRC, 'types/global.ts'));

/**
 * Where `PROPERTY_MAPPINGS` may live, most-likely first.
 *
 * A list rather than one path because this used to be hardcoded to
 * `features/display/display-types.ts`, and relocating that file — which `sdk-structure`
 * §2 required, since four `features/cart/**` files import from it — failed doc
 * generation with an `ENOENT` rather than anything a reader could act on. Searching by
 * declaration name instead means the table can move again without breaking the docs.
 *
 * The old path stays listed on purpose: it costs one `existsSync` and it is what makes
 * this list a search rather than a second hardcoded path.
 */
const routingTableFile = findPropertyMappings([
  join(SRC, 'core/base/display-types.ts'),
  join(SRC, 'features/display/display-types.ts'),
]);

/**
 * What `PROPERTY_MAPPINGS` **claims** each namespace can show.
 *
 * Not what it can show. The table decides a path's format, validator and fallback
 * value; nothing in it makes a path resolve. Publishing it as the answer is what put
 * ten dead paths on the `cart.` page while hiding six live ones (finding 127).
 */
const routingClaims = extractDisplayPaths(routingTableFile);

/** `/abs/src/core/base/display-types.ts` → `core/base/display-types.ts`. */
const routingTableAnchor = `${relative(SRC, routingTableFile)} › PROPERTY_MAPPINGS`;

/**
 * Every interface the SDK declares, for proving the paths no branch answers.
 *
 * `package.price_retail_total` reaches no `case` and works, because the resolver ends
 * in `PropertyResolver.getNestedProperty(packageData, path)` and `Package` has that
 * field. Reading the declarations is what makes that provable instead of assumed —
 * see `@/docs/extract/type-shape`.
 */
const declaredShapes = readDeclaredShapes(
  Object.entries({
    ...import.meta.glob<string>('../../types/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
    ...import.meta.glob<string>('../../state/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  }).map(([path, text]) => [basename(path), text] as [string, string])
);

/** What one namespace answers, what it only claims, and where each came from. */
interface DisplaySource {
  paths: DisplayPath[];
  where: string;
  unanswered: Array<{
    name: string;
    routedTo: string;
    instead: string;
    hasFallback: boolean;
  }>;
  claimedIn?: string;
  /** Names the resolver has an explicit branch for — the trio's whole answer. */
  branchNames: string[];
  /** Names the routing table claims, answered or not. */
  claimedNames: string[];
  dataFallback?: string;
  prefixSegments?: number;
  formatsWithoutPath: string[];
  formatWhere?: string;
}

/**
 * Reads one namespace's paths out of the SDK, and checks the routing table against
 * them rather than trusting it.
 *
 * Three answers can be true of a routed name, and only the first two put it on the
 * page: the resolver has a branch for it; it has no branch but names a field of the
 * shape the resolver's open branch reads (`fallbackShapes`); or nothing answers it
 * at all, in which case it belongs in the "declared but not answered" table with a
 * working alternative beside it.
 *
 * Takes the namespace and its per-namespace declarations directly rather than a
 * whole manifest, because a feature can answer more than one namespace from the
 * same resolver — `product-display` answers `package.` from
 * `manifest.displayNamespace` and `campaign.` from
 * `manifest.additionalDisplayNamespaces`, each with its own fallback shapes and
 * unanswered list, and both must run through exactly the same checks.
 */
function displaySourceFor(
  files: Array<[string, string]>,
  namespace: string,
  fallbackShapes: DisplayFallback[] = [],
  unansweredNotes: UnansweredPath[] = []
): DisplaySource {
  const resolved = extractResolvedDisplayPaths(files, namespace);
  const claimed = routingClaims[namespace] ?? [];
  const byBranch = new Set(resolved.paths.map(p => p.name));

  /** The declared shape whose field this name routes to, when one has it. */
  const viaData = (entry: DisplayPath): boolean =>
    fallbackShapes.some(fallback => {
      const path = entry.path ?? entry.name;
      if (fallback.mappedPrefix && !path.startsWith(fallback.mappedPrefix)) {
        return false;
      }
      const field = fallback.mappedPrefix
        ? path.slice(fallback.mappedPrefix.length)
        : path;
      return declaresPath(declaredShapes, fallback.shape, field);
    });

  // A class that overrides `getDefaultFormatType` without calling `super` is the last
  // word on its namespace's formats — the routing table's declarations never reach it.
  const formatOf = (name: string, claim?: DisplayPath): string =>
    resolved.formatsAreTotal
      ? (resolved.formats[name] ?? 'auto')
      : (claim?.format !== undefined && claim.format !== 'auto'
          ? claim.format
          : (resolved.formats[name] ?? 'auto'));

  const answeredClaims = claimed.filter(e => byBranch.has(e.name) || viaData(e));
  const claimedNames = new Set(claimed.map(e => e.name));
  const notes = new Map(unansweredNotes.map(u => [u.name, u.instead]));

  return {
    // Claimed-and-answered first, in the table's own order, so an existing page keeps
    // its shape; then the paths only the resolver knew about.
    paths: [
      ...answeredClaims.map(e => ({
        name: e.name,
        format: formatOf(e.name, e),
        negated: e.negated,
        hasFallback: e.hasFallback,
      })),
      ...resolved.paths
        .filter(p => !claimedNames.has(p.name))
        .map(p => ({
          name: p.name,
          format: formatOf(p.name),
          negated: false,
          hasFallback: false,
        })),
    ],
    where: resolved.where,
    unanswered: claimed
      .filter(e => !byBranch.has(e.name) && !viaData(e))
      .map(e => ({
        name: e.name,
        routedTo: e.path ?? e.name,
        instead: notes.get(e.name) ?? '',
        hasFallback: e.hasFallback,
      })),
    ...(claimed.length ? { claimedIn: routingTableAnchor } : {}),
    branchNames: resolved.paths.map(p => p.name),
    claimedNames: claimed.map(e => e.name),
    ...(resolved.dataFallback ? { dataFallback: resolved.dataFallback } : {}),
    ...(resolved.prefixSegments === undefined
      ? {}
      : { prefixSegments: resolved.prefixSegments }),
    formatsWithoutPath: resolved.formatsWithoutPath,
    ...(resolved.formatWhere ? { formatWhere: resolved.formatWhere } : {}),
  };
}

/** Repo root, for reading `e2e/` and for the fixture paths printed in the docs. */
const ROOT = join(SRC, '..');

const manifests = Object.entries(modules)
  .map(([path, mod]) => {
    // import.meta.glob keys are relative to this file.
    const file = join(dirname(fileURLToPath(import.meta.url)), path);
    const dir = dirname(file);
    const manifest = mod.default;
    // A feature either has its own folder (`add-to-cart/add-to-cart.enhancer.ts`)
    // or still sits flat in its category (`cart/coupon.enhancer.ts`). Flat
    // features keep their guide in a folder named after them, matching what
    // `display/product-display/guide/` already does.
    const ownFolder = dir.endsWith(`/${manifest.id}`);
    return {
      file,
      dir,
      guideDir: join(ownFolder ? dir : join(dir, manifest.id), 'guide'),
      sourceDir: ownFolder ? dir : dir,
      ownFolder,
      manifest,
    };
  })
  .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));

/**
 * Non-test source of one feature, for checking the manifest against the code.
 *
 * A feature with its own folder owns everything under it. A flat feature shares
 * its category folder with unrelated features, so it owns only the files named
 * after it (`coupon.enhancer.ts`, `coupon.handlers.ts`) — otherwise a sibling's
 * attribute would satisfy this feature's check.
 */
function featureFiles(
  dir: string,
  id: string,
  ownFolder: boolean,
  extraSource: string[] = []
): Array<[string, string]> {
  const files = {
    ...import.meta.glob<string>('../../features/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
    // Some attributes are read by a shared renderer rather than by the feature's
    // own files — `data-next-discounts` is handled by
    // `core/rendering/discount-renderer` for three different features. Those files
    // are only in scope for a feature that names them in `extraSource`, so a shared
    // attribute still cannot pass this check for a feature that does not actually
    // render it. Keep this glob narrow: it must cover every path an `extraSource`
    // entry can point at, and nothing else.
    ...import.meta.glob<string>('../../core/rendering/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
    // Same reason, for the base classes: `data-next-display` and its formatting
    // modifiers are read by `core/base/base-display-enhancer`, which every display
    // feature extends. The class lives in `core/base/` rather than in the display
    // folder because four `features/cart/**` files also extend it, and a feature
    // importing another feature's internals is the cross-feature import
    // `sdk-structure` §2 forbids.
    ...import.meta.glob<string>('../../core/base/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  };
  const here = join(dirname(fileURLToPath(import.meta.url)));
  return Object.entries(files)
    .filter(([p]) => {
      const abs = join(here, p);
      if (abs.includes('/tests/') || abs.endsWith('.manifest.ts')) return false;
      // Explicitly claimed helper folders and files count as this feature's code.
      // An entry is resolved against the feature's own folder, or against `src/`
      // when it starts with `src/` — which is how a feature claims shared code.
      if (
        extraSource.some(entry => {
          const claimed = entry.startsWith('src/')
            ? join(SRC, entry.slice('src/'.length))
            : join(dir, entry);
          return abs === claimed || abs.startsWith(`${claimed}/`);
        })
      ) {
        return true;
      }
      if (ownFolder) return abs.startsWith(`${dir}/`);
      return dirname(abs) === dir && basename(abs).startsWith(`${id}.`);
    })
    .map(([p, content]) => [basename(p), content] as [string, string]);
}

/** The same source as one string, for the "is this name mentioned at all" checks. */
function featureSource(
  dir: string,
  id: string,
  ownFolder: boolean,
  extraSource: string[] = []
): string {
  return featureFiles(dir, id, ownFolder, extraSource)
    .map(([, content]) => content)
    .join('\n');
}

/** `[data-next-action="add-to-cart"]` → `[data-next-action]` */
function bareSelector(activates: string): string {
  return activates.replace(/="[^"]*"/g, '');
}

describe('feature reference docs', () => {
  it('finds at least one manifest', () => {
    expect(manifests.length).toBeGreaterThan(0);
  });

  /**
   * The reverse of the per-feature scanner check: every selector `AttributeScanner`
   * queries must be claimed by some manifest. Without this, a new feature can be
   * wired into the scanner and ship with no documentation at all — the per-feature
   * check only catches a manifest pointing at a selector that does not exist, not a
   * selector with no manifest.
   */
  it('every AttributeScanner selector is owned by a manifest', () => {
    const scanner = readFileSync(join(SRC, 'core/attribute-scanner.ts'), 'utf8');

    // The scanner's own query list, not every selector mentioned in the file.
    // Split on commas so a line holding a combined selector — the registry, or a
    // `querySelectorAll('[data-next-show], [data-next-hide]')` argument that sits on
    // its own line — is read as the selectors it actually queries.
    const queried = [
      ...scanner.matchAll(/^\s*'(\[data-next-[^']+\]|form\[data-next-[^']+\])',?$/gm),
    ].flatMap(m => m[1].split(',').map(part => part.trim()));
    expect(queried.length, 'failed to parse the scanner selector list').toBeGreaterThan(10);

    const claimed = new Set(
      manifests.flatMap(({ manifest }) =>
        [manifest.activates, ...(manifest.alsoActivates ?? [])]
          .filter((s): s is string => !!s)
          .flatMap(s => [s, bareSelector(s)])
      )
    );

    const unclaimed = queried.filter(
      selector => !claimed.has(selector) && !claimed.has(bareSelector(selector))
    );

    expect(
      unclaimed,
      'AttributeScanner activates these selectors but no manifest documents them — a feature can ship undocumented'
    ).toEqual([]);
  });

  /**
   * The global attribute index — one door to every attribute in the SDK, generated
   * from all manifests. Replaces the hand-written `data-attributes/` section, whose
   * only real value was being that single door.
   */
  it('attribute-index.md covers every manifest', () => {
    const file = join(SRC, '../docs/attribute-index.md');
    const expected = renderAttributeIndex(manifests.map(m => m.manifest));
    if (UPDATE) writeFileSync(file, expected);
    expect(existsSync(file), `${file} is missing`).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(expected);
  });

  /**
   * The editor's attribute autocomplete is generated from the same manifests as the
   * docs, so IntelliSense and the reference cannot disagree.
   */
  it('html-custom-data.json matches the manifests', () => {
    const file = join(SRC, '../docs/html-custom-data.json');
    const expected = renderHtmlCustomData(manifests.map(m => m.manifest));
    if (UPDATE) writeFileSync(file, expected);
    expect(existsSync(file), `${file} is missing`).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(expected);

    // Guard the shape the editor actually needs, not just that a file exists.
    const data = JSON.parse(expected);
    expect(data.version).toBe(1.1);
    expect(data.globalAttributes.length).toBeGreaterThan(100);
    for (const attr of data.globalAttributes) {
      expect(attr.name, 'every entry needs a name').toBeTruthy();
      expect(attr.description.kind).toBe('markdown');
      expect(attr.description.value.trim(), `${attr.name} has an empty hover`).not.toBe('');
    }
  });

  /**
   * The SDK-level attributes are declared by hand — no feature owns them — so the
   * check is that each one is still read somewhere in `src/core`. An attribute that
   * left the codebase should not keep a documentation page.
   */
  it('sdk-attributes.md matches the declared list, and each is still in core', () => {
    const file = join(SRC, '../docs/sdk-attributes.md');
    const expected = renderSdkAttributes();
    if (UPDATE) writeFileSync(file, expected);
    expect(existsSync(file), `${file} is missing`).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(expected);

    const core = Object.values(
      import.meta.glob<string>('../../core/**/*.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      })
    ).join('\n');
    const missing = SDK_ATTRIBUTES.filter(a => !core.includes(a.name)).map(a => a.name);
    expect(missing, 'declared as SDK-level but not read anywhere in src/core').toEqual([]);
  });

  /**
   * Cross-links between guides must resolve **in the repo**, because that is where
   * they are authored and read. The site generator maps a resolved source path to
   * its published route, so a link that is right here is right there too — and a
   * wrong one is wrong in both places. Reference pages sit one level deeper than
   * overviews (`…/guide/reference/`), which is exactly the off-by-one this catches.
   */
  it('has no broken cross-links between guides', () => {
    const pages = import.meta.glob<string>('../../features/**/guide/**/*.md', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const here = dirname(fileURLToPath(import.meta.url));
    const broken: string[] = [];

    for (const [path, body] of Object.entries(pages)) {
      const file = join(here, path);
      for (const [, target] of body.matchAll(
        /\]\((?!https?:|\/|#)([^)\s]+?\.md)(?:#[^)]*)?\)/g
      )) {
        const resolved = join(dirname(file), target);
        if (!existsSync(resolved)) {
          broken.push(`${relative(SRC, file)} → ${target}`);
        }
      }
    }

    expect(broken, 'these links do not resolve on disk').toEqual([]);
  });

  /**
   * Every `guide/` folder must belong to a feature the site can name.
   *
   * The generator derives a feature's title from its guide folder's parent, so a
   * `guide/` sitting directly in a category folder publishes as a phantom feature
   * — `features › cart` — with no overview. That happened for real: `coupon`'s
   * pages were written to `features/cart/guide/` before flat features were routed
   * to `features/cart/coupon/guide/`, and the orphan stayed behind.
   */
  it('has no orphaned guide folders', () => {
    const known = new Set(manifests.map(m => m.manifest.id));
    // State stores keep guides too and are not features; they live under state/.
    const guideDirs = Object.keys(
      import.meta.glob('../../features/**/guide/**/*.md', { eager: true })
    ).map(p => join(dirname(fileURLToPath(import.meta.url)), p));

    const orphans = [
      ...new Set(
        guideDirs
          .map(f => f.replace(/\/guide\/.*$/, ''))
          .filter(featureDir => !known.has(basename(featureDir)))
          .map(featureDir => relative(SRC, featureDir))
      ),
    ];

    expect(
      orphans,
      'these folders hold a guide/ but match no manifest id — the docs site would publish them as features with no overview'
    ).toEqual([]);
  });

  /**
   * Every `data-*` attribute written in a guide's HTML snippet must be one some
   * manifest declares.
   *
   * A snippet is prose as far as the compiler is concerned, so an attribute can be
   * renamed in the code and the example keeps showing the old spelling forever —
   * which is exactly how the retired `data-attributes/` door came to document eight
   * attributes that never existed. Cross-feature examples are fine: an add-to-cart
   * example may show the selector it pairs with, so the check is against the union
   * of all manifests rather than the owning feature.
   */
  it('uses only real attributes in its HTML snippets', () => {
    const declared = new Set([
      ...manifests.flatMap(({ manifest }) =>
        [
          ...manifest.attributes.map(a => a.name),
          ...(manifest.readsElsewhere ?? []).map(a => a.name),
          ...(manifest.sets ?? []).map(a => a.name),
        ].flatMap(name => name.split(' / '))
      ),
      ...SDK_ATTRIBUTES.map(a => a.name),
    ]);

    const pages = import.meta.glob<string>('../../features/**/guide/**/*.md', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const here = dirname(fileURLToPath(import.meta.url));
    const unknown: string[] = [];

    for (const [path, body] of Object.entries(pages)) {
      for (const [, snippet] of body.matchAll(/```html\n([\s\S]*?)```/g)) {
        for (const [, attr] of snippet.matchAll(/\s(data-[a-z0-9-]+)/g)) {
          if (declared.has(attr)) continue;
          const where = `${relative(SRC, join(here, path))}: ${attr}`;
          if (!unknown.includes(where)) unknown.push(where);
        }
      }
    }

    expect(
      unknown,
      'these appear in a guide snippet but no manifest declares them — either the attribute is fiction, or a manifest inventory is incomplete'
    ).toEqual([]);
  });

  /**
   * The forbidden words from `.claude/rules/documentation.md` §2.
   *
   * They are banned for being dismissive — "just add the attribute" tells a reader who
   * is stuck that their problem is trivial. A plain word search is useless here: the
   * feature `simple-exit-intent` is named after one, and `fomo-popup` legitimately
   * quotes "Sarah from Denver just bought this". So code spans, fenced blocks, and the
   * feature's own id are stripped first, and `just` is only flagged in the
   * instructional form ("just add", "just set"), not in "not just the total".
   */
  it('avoids the forbidden dismissive words', () => {
    const pages = import.meta.glob<string>('../../features/**/guide/**/*.md', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const here = dirname(fileURLToPath(import.meta.url));
    const ids = manifests.map(m => m.manifest.id);
    const hits: string[] = [];

    for (const [path, body] of Object.entries(pages)) {
      const file = join(here, path);
      let prose = body
        .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '') // fenced blocks
        .replace(/`[^`\n]*`/g, '') // inline code
        .replace(/"[^"\n]*"/g, ''); // quoted copy
      for (const id of ids) prose = prose.split(id).join('');

      for (const [, word] of prose.matchAll(
        /\b(simply|simple|straightforward|easy|just\s+(?:add|set|put|use|call|drop|write|wrap|make))\b/gi
      )) {
        hits.push(`${relative(SRC, file)}: "${word}"`);
      }
    }

    expect(
      hits,
      'documentation.md §2 forbids these — say what the reader has to do instead of telling them it is not hard'
    ).toEqual([]);
  });

  /**
   * Every use case needs an effort signal. `.claude/rules/guide.md` requires one so a
   * reader — and whoever is planning their week — can tell a markup change from a
   * backend change before committing to the approach.
   */
  it('gives every use case an effort signal', () => {
    const pages = import.meta.glob<string>(
      '../../features/**/guide/use-cases.md',
      { query: '?raw', import: 'default', eager: true }
    );
    const here = dirname(fileURLToPath(import.meta.url));
    const EFFORTS = /> Effort: (lightweight|moderate|requires backend changes|complex setup)/;
    /**
     * Headings that are part of the page's furniture rather than a use case. An
     * earlier version of this check demanded an effort signal on *every* `##`, which
     * pushed writers into deleting useful footers to satisfy it — the test dictating
     * the content instead of checking it.
     */
    const NOT_A_SCENARIO = /^(when not to use|next steps|related|see also)\b/i;
    const bad: string[] = [];

    for (const [path, body] of Object.entries(pages)) {
      const name = relative(SRC, join(here, path));
      const scenarios = body
        .split(/^## /m)
        .slice(1)
        .filter(section => !NOT_A_SCENARIO.test(section));

      if (scenarios.length < 2) {
        bad.push(`${name}: needs at least 2 use cases, found ${scenarios.length}`);
      }
      for (const section of scenarios) {
        if (!EFFORTS.test(section)) {
          const title = section.split('\n')[0].trim();
          bad.push(`${name}: "${title}" has no valid "> Effort:" line`);
        }
      }
      if (!/^## When NOT to use this/m.test(body)) {
        bad.push(`${name}: missing the "When NOT to use this" section`);
      }
    }

    expect(bad, 'see .claude/rules/guide.md for the use-cases format').toEqual([]);
  });

  /**
   * Every feature named in a `dependsOn`, `pairsWith`, or `conflicts` entry must be a
   * real manifest id.
   *
   * These ids are what `relations.md` turns into cross-links, and what the inbound
   * derivation matches on. A typo does not merely produce a dead link — the reverse
   * link silently never appears on the other feature's page, which is the exact
   * integration bug relations.md exists to prevent.
   */
  it('names only real features in its relations', () => {
    const known = new Set(manifests.map(m => m.manifest.id));
    const bad: string[] = [];

    for (const { manifest } of manifests) {
      const links = [
        ...(manifest.dependsOn ?? []).map(l => ['dependsOn', l.feature] as const),
        ...(manifest.pairsWith ?? []).map(l => ['pairsWith', l.feature] as const),
        ...(manifest.conflicts ?? []).map(l => ['conflicts', l.feature] as const),
      ];
      for (const [field, id] of links) {
        if (!known.has(id)) bad.push(`${manifest.id}.${field} → ${id}`);
      }
    }

    expect(bad, 'these point at no manifest — check the id spelling').toEqual([]);
  });

  describe.each(manifests)('$manifest.id', ({ dir, guideDir, ownFolder, file, manifest }) => {
    const refDir = join(guideDir, 'reference');

    const generated = (manifest.reference ?? 'generated') === 'generated';

    it.runIf(generated).each([
      ['attributes.md', () => renderAttributes(manifest)],
      ['events.md', () => renderEvents(manifest, eventDocs)],
    ])('%s matches the manifest', (name, render) => {
      const expected = render();
      const file = join(refDir, name);
      if (UPDATE) {
        mkdirSync(refDir, { recursive: true });
        writeFileSync(file, expected);
      }
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      expect(readFileSync(file, 'utf8')).toBe(expected);
    });

    it.runIf(generated)('describes every attribute it declares', () => {
      const undescribed = manifest.attributes
        .filter(a => !a.description?.trim())
        .map(a => a.name);
      expect(
        undescribed,
        'a generated reference needs prose in the manifest — add a description, or set reference: \'hand-written\''
      ).toEqual([]);
    });

    // Under `hand-written` the manifest is the inventory: the page keeps its prose,
    // but every attribute in the inventory must actually appear on it, so an
    // attribute added to the code cannot be missed by the docs.
    it.runIf(!generated)('has a hand-written page covering every declared attribute', () => {
      const file = join(refDir, 'attributes.md');
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      const page = readFileSync(file, 'utf8');
      const uncovered = manifest.attributes
        .flatMap(a => a.name.split(' / '))
        .filter(name => !page.includes(name));
      expect(
        uncovered,
        `declared in ${manifest.id}.manifest.ts but absent from its hand-written attributes.md`
      ).toEqual([]);
    });

    /**
     * Every `data-next-display` namespace this feature answers — the primary
     * {@link FeatureManifest.displayNamespace} plus any in
     * {@link FeatureManifest.additionalDisplayNamespaces} — run through exactly the
     * same checks below. `product-display` is why this is a list rather than one
     * namespace: it resolves both `package.` and `campaign.` out of the same
     * `getPropertyValue`, and `campaign.` had none of the checks below until this
     * loop existed — `PROPERTY_MAPPINGS` has no entry for it and `docs:coverage`
     * scored the feature covered because it counts by owning feature, not by
     * namespace (finding 143 in `docs/code-findings.md`).
     */
    const displayNamespaces = [
      ...(manifest.displayNamespace
        ? [
            {
              namespace: manifest.displayNamespace,
              doc: manifest.displayPaths,
              fallback: manifest.displayFallback,
              unanswered: manifest.displayUnanswered,
              file: 'display-paths.md',
              leaf: 'Display Paths',
            },
          ]
        : []),
      ...(manifest.additionalDisplayNamespaces ?? []).map(a => ({
        namespace: a.namespace,
        doc: a.displayPaths,
        fallback: a.displayFallback,
        unanswered: a.displayUnanswered,
        file: `display-paths-${a.namespace}.md`,
        leaf: `${a.namespace.charAt(0).toUpperCase()}${a.namespace.slice(1)} Display Paths`,
      })),
    ];

    // The path inventory is generated for both modes: a hand-written page keeps
    // its prose and still gets a complete, current list of paths beside it.
    it.each(displayNamespaces)(
      '$namespace: display-paths.md matches the source that resolves the namespace',
      ({ namespace, doc, fallback, unanswered, file, leaf }) => {
        const path = join(refDir, file);
        const expected = renderDisplayPaths(
          manifest,
          displaySourceFor(
            featureFiles(dir, manifest.id, ownFolder, manifest.extraSource),
            namespace,
            fallback ?? [],
            unanswered ?? []
          ),
          namespace,
          doc,
          leaf
        );
        if (UPDATE) {
          mkdirSync(refDir, { recursive: true });
          writeFileSync(path, expected);
        }
        expect(existsSync(path), `${relative(SRC, path)} is missing`).toBe(true);
        expect(readFileSync(path, 'utf8')).toBe(expected);
      }
    );

    /**
     * The gate finding 114 asked for, in both directions — now for every namespace,
     * not only the three that route through no table.
     *
     * Forwards: a property added to the resolver with no entry in the manifest fails
     * here, so a new path cannot ship undocumented. Backwards: an entry for a
     * property the enhancer cannot answer fails here too — which is finding 109
     * exactly. `bundle-selector` documented `compare`, `savings`, `savingsPercentage`
     * and `hasSavings` for months because they exist in the card renderer's format
     * table, a different mechanism on a different attribute, and nothing compared the
     * doc against the method that actually answers a `bundle.` path.
     *
     * Prose is required for a namespace no table routes, because those pages replaced
     * hand-written ones whose per-path meaning is the reason to read them. The routed
     * five publish the API's own field names and carry no prose today; what they must
     * carry instead is `displayUnanswered`, checked below.
     */
    it.each(displayNamespaces)(
      '$namespace: documents exactly the paths its namespace resolves',
      ({ namespace, doc, fallback, unanswered }) => {
        const source = displaySourceFor(
          featureFiles(dir, manifest.id, ownFolder, manifest.extraSource),
          namespace,
          fallback ?? [],
          unanswered ?? []
        );

        if (!doc) {
          expect(
            source.claimedNames,
            `nothing routes \`${namespace}.\`, so ${manifest.id} owns every path it answers and displayPaths must carry a description for each one`
          ).not.toEqual([]);
          return;
        }

        const resolved = source.paths.map(p => p.name);
        const documented = doc.paths.map(p => p.name);

        expect(
          resolved.filter(name => !documented.includes(name)),
          `${manifest.id} resolves these \`${namespace}.\` display paths but its manifest does not describe them — add them to displayPaths.paths, or a page author gets a value with no documentation`
        ).toEqual([]);
        expect(
          documented.filter(name => !resolved.includes(name)),
          `${manifest.id}.manifest.ts describes these \`${namespace}.\` display paths but ${source.where} does not answer them — the page would teach markup that renders nothing`
        ).toEqual([]);
        expect(
          documented.filter(name => !doc.paths.find(p => p.name === name)?.description.trim()),
          'every documented path needs a description — the table is the reason the page exists'
        ).toEqual([]);
      }
    );

    /**
     * The routing table, checked as a claim rather than published as the answer.
     *
     * This is finding 127. `reference/display-paths.md` for `cart.` was rendered
     * straight from `PROPERTY_MAPPINGS.cart`, so it named ten paths
     * `CartDisplayEnhancer.resolveValue` has no branch for and omitted six it answers.
     * A routing entry supplies a format, a validator and a fallback value — never a
     * resolver. `discountCode` was the worst of them: its `fallback: ''` made a dead
     * path render an empty string, which reads as deliberate.
     *
     * Both directions fail here. A name the table declares that nothing answers must
     * be listed in `displayUnanswered`, and a name listed there that the resolver
     * *does* answer must be removed — so the list can only shrink, and only by making
     * the path work.
     */
    it.each(displayNamespaces)(
      '$namespace: accounts for every path its routing table claims',
      ({ namespace, fallback, unanswered: declaredUnanswered }) => {
        const source = displaySourceFor(
          featureFiles(dir, manifest.id, ownFolder, manifest.extraSource),
          namespace,
          fallback ?? [],
          declaredUnanswered ?? []
        );
        const listed = (declaredUnanswered ?? []).map(u => u.name);
        const unanswered = source.unanswered.map(u => u.name);

        expect(
          unanswered.filter(name => !listed.includes(name)),
          `\`${source.claimedIn}\` routes \`${namespace}.\` to these, ${source.where} has no branch for them, and no declared shape has the field either — so writing one renders nothing. Add them to displayUnanswered with what to write instead, or add the branch that answers them`
        ).toEqual([]);
        expect(
          listed.filter(name => !unanswered.includes(name)),
          `${manifest.id}.manifest.ts lists these as unanswered for \`${namespace}.\`, but ${source.where} answers them now — take them out of displayUnanswered so the page stops warning about a path that works`
        ).toEqual([]);

        const answered = new Set(source.paths.map(p => p.name));
        const pointless = (declaredUnanswered ?? []).flatMap(entry => {
          if (!entry.instead.trim()) return [`${entry.name}: no alternative given`];
          // A caution that points at a second dead path is worse than no caution.
          return [...entry.instead.matchAll(/`([a-zA-Z]+)\.([\w.[\]]+)`/g)]
            .filter(m => m[1] === namespace && !answered.has(m[2] ?? ''))
            .map(m => `${entry.name} → ${m[0]}`);
        });
        expect(
          pointless,
          'every unanswered path needs a working alternative, and a path of this namespace named in one must be answered'
        ).toEqual([]);
      }
    );

    /**
     * `displayFallback` is a claim about the code as much as about the types.
     *
     * It only means anything where the resolver really ends in a
     * `PropertyResolver.getNestedProperty(data, path)` — that branch is what makes
     * `package.price_retail_total` work with no case behind it. Declaring shapes for a
     * namespace that has no such branch would silently prove paths that cannot
     * resolve; leaving them off one that does would report live paths as dead.
     */
    it.each(displayNamespaces)(
      '$namespace: declares a fallback shape exactly when its resolver reads one',
      ({ namespace, fallback }) => {
        const source = displaySourceFor(
          featureFiles(dir, manifest.id, ownFolder, manifest.extraSource),
          namespace
        );
        const declared = fallback ?? [];

        expect(
          declared.length > 0,
          source.dataFallback
            ? `${source.dataFallback} resolves a \`${namespace}.\` path with no branch by reading it off runtime data, so ${manifest.id}.manifest.ts must declare the shape that read lands on`
            : `${manifest.id}.manifest.ts declares a displayFallback shape for \`${namespace}.\`, but ${source.where} never reads a path off runtime data — every path it answers is an explicit branch, so the declaration would prove paths that cannot resolve`
        ).toBe(!!source.dataFallback);

        for (const shape of declared) {
          expect(
            declaredShapes.has(shape.shape),
            `${manifest.id}.manifest.ts says its \`${namespace}.\` display fallback reads a \`${shape.shape}\`, but no interface of that name is declared under src/types or src/state`
          ).toBe(true);
        }
      }
    );

    /**
     * The root cause behind finding 109, gated in the source instead of on the page.
     *
     * The check above compares the *manifest* against the resolver, which stops a wrong
     * page from being published. It does not touch what made the page wrong: a
     * `FORMAT_MAP` sitting twenty lines above `getPropertyValue` and listing four
     * properties it has no case for. Whoever wrote that reference read the table, and
     * the table gave no hint that half of it was fiction — a declared format reads as
     * proof the property exists.
     *
     * So the table must be a subset of what the resolver answers. An entry with no case
     * behind it is dead in every direction — the format is never applied, because a
     * property nothing resolves has no value to format — and its only remaining effect
     * is to mislead the next reader.
     *
     * Vacuous for the namespaces `PROPERTY_MAPPINGS` routes, which have no per-enhancer
     * table to compare.
     */
    it.each(displayNamespaces)(
      '$namespace: declares no format for a property its resolver cannot answer',
      ({ namespace }) => {
        const source = displaySourceFor(
          featureFiles(dir, manifest.id, ownFolder, manifest.extraSource),
          namespace
        );

        expect(
          source.formatsWithoutPath ?? [],
          `${source.formatWhere ?? manifest.id} declares a default format for these, but ` +
            `${source.where ?? 'the resolver'} has no case for any of them, so ` +
            `\`data-next-display="${namespace}.…"\` using one renders ` +
            'nothing. A format table is not an inventory of paths, but it reads like one — ' +
            'that is how four fictional bundle paths reached a published page (finding 109 ' +
            'in docs/code-findings.md). Delete the entry, or add the case that answers it'
        ).toEqual([]);
      }
    );

    /**
     * `prefix` is a claim about the markup a reader types. Checking its segment count
     * against the `parts.slice(n)` the enhancer parses is what stops it going stale
     * the day a class reads one more segment out of the path.
     */
    it.each(displayNamespaces.filter(n => !!n.doc))(
      '$namespace: publishes a prefix with as many segments as the enhancer parses',
      ({ namespace, doc }) => {
        const source = displaySourceFor(
          featureFiles(dir, manifest.id, ownFolder, manifest.extraSource),
          namespace
        );
        if (source.prefixSegments === undefined) return;
        expect(
          doc?.prefix.split('.').length,
          `${manifest.id}'s \`${namespace}.\` prefix "${doc?.prefix}" does not match the ${source.prefixSegments} segments ${source.where} parses before the property`
        ).toBe(source.prefixSegments);
      }
    );

    /**
     * Log messages, read from the feature's own `logger.*` calls. A console line is
     * only searchable back to its cause if the page carries the exact wording, and
     * 384 messages transcribed by hand would be wrong within a week.
     */
    const logs = extractLogs(
      featureFiles(dir, manifest.id, ownFolder, manifest.extraSource)
    );
    const logsGenerated = (manifest.pages?.logs ?? 'generated') === 'generated';

    it.runIf(logsGenerated)('logs.md matches the logger calls in the source', () => {
      const expected = renderLogs(manifest, logs);
      const file = join(refDir, 'logs.md');
      if (UPDATE) {
        mkdirSync(refDir, { recursive: true });
        writeFileSync(file, expected);
      }
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      expect(readFileSync(file, 'utf8')).toBe(expected);
    });

    /**
     * A hand-written logs page keeps its When / Meaning / Action prose, which is
     * worth more than a generated table — but it must still cover every message a
     * reader would look up. Only `error` and `warn` are required: those are the
     * lines someone searches after something went wrong. A `debug` line is read in
     * the context of the ones around it.
     *
     * Matched on the text before the first `{`, since a page writes a runtime value
     * as `{url}` where the code interpolates it.
     */
    it.runIf(!logsGenerated)('has a hand-written logs page covering every error and warn', () => {
      const file = join(refDir, 'logs.md');
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      const page = readFileSync(file, 'utf8');

      const missing = logs
        .filter(l => l.level === 'error' || l.level === 'warn')
        .filter(l => !page.includes(l.message.split('{')[0].trim()))
        .map(l => `${l.level}: ${l.message}  (${l.where})`);

      expect(
        missing,
        `${manifest.id} can print these but its hand-written logs.md does not mention them`
      ).toEqual([]);
    });

    /**
     * The feature's own "I started" line, for the verify step of get-started. Any
     * `initialized` message at debug or info level; features word it differently
     * (`AddToCartEnhancer initialized`, `Initialized { … }`).
     */
    const initLog = logs.find(
      l =>
        (l.level === 'debug' || l.level === 'info') &&
        /initiali[sz]ed/i.test(l.message)
    )?.message;

    const getStartedGenerated =
      (manifest.pages?.getStarted ?? 'generated') === 'generated';

    it.runIf(getStartedGenerated)('get-started.md matches the manifest and fixture', () => {
      const expected = renderGetStarted(
        manifest,
        manifests.map(m => m.manifest),
        example,
        initLog
      );
      const file = join(guideDir, 'get-started.md');
      if (UPDATE) {
        mkdirSync(guideDir, { recursive: true });
        writeFileSync(file, expected);
      }
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      expect(readFileSync(file, 'utf8')).toBe(expected);
    });

    const relationsGenerated =
      (manifest.pages?.relations ?? 'generated') === 'generated';

    it.runIf(relationsGenerated)('relations.md matches the manifests', () => {
      const expected = renderRelations(
        manifest,
        manifests.map(m => m.manifest)
      );
      const file = join(guideDir, 'relations.md');
      if (UPDATE) {
        mkdirSync(guideDir, { recursive: true });
        writeFileSync(file, expected);
      }
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      expect(readFileSync(file, 'utf8')).toBe(expected);
    });

    /**
     * A hand-written relations page keeps its prose, but every feature the manifest
     * links to must appear on it. Without this, declaring a new conflict updates the
     * generated pages and silently misses the hand-written ones — and a conflict a
     * reader does not see is the whole failure mode of this file.
     *
     * Matched on the id and on the class name, since the older pages name features as
     * `CartItemListEnhancer` rather than `cart-item-list`.
     */
    it.runIf(!relationsGenerated)('has a hand-written relations page naming every linked feature', () => {
      const file = join(guideDir, 'relations.md');
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      const page = readFileSync(file, 'utf8');

      const linked = [
        ...(manifest.dependsOn ?? []),
        ...(manifest.pairsWith ?? []),
        ...(manifest.conflicts ?? []),
      ].map(l => l.feature);

      const missing = [...new Set(linked)].filter(id => {
        const pascal = id
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
        return !page.includes(id) && !page.includes(pascal);
      });

      expect(
        missing,
        `${manifest.id}.manifest.ts links to these but its hand-written relations.md does not name them`
      ).toEqual([]);
    });

    /**
     * Errors. The manifest carries the judgement a generator cannot — recoverable
     * versus fatal, and the fix — while the source decides what exists, so a new
     * `throw` cannot ship undocumented and a deleted one cannot linger in the docs.
     */
    const thrown = extractThrows(
      featureFiles(dir, manifest.id, ownFolder, manifest.extraSource)
    );
    const errorsGenerated = (manifest.pages?.errors ?? 'generated') === 'generated';

    it.runIf(errorsGenerated)('errors.md matches the manifest', () => {
      const expected = renderErrors(manifest);
      const file = join(refDir, 'errors.md');
      if (UPDATE) {
        mkdirSync(refDir, { recursive: true });
        writeFileSync(file, expected);
      }
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      expect(readFileSync(file, 'utf8')).toBe(expected);
    });

    it.runIf(errorsGenerated)('declares every error its own code throws', () => {
      const declared = new Set((manifest.errors ?? []).map(e => e.message));
      const missing = thrown
        .filter(e => !declared.has(e.message))
        .map(e => `${e.message}  (${e.where})`);
      expect(
        missing,
        `${manifest.id} throws these but its manifest does not declare them — add them to errors[] with a kind and a fix`
      ).toEqual([]);
    });

    it.runIf(errorsGenerated)('declares no error that is not thrown', () => {
      const inSource = new Set(thrown.map(e => e.message));
      const phantom = (manifest.errors ?? [])
        // An API message is passed through, not thrown here.
        .filter(e => !e.fromApi && !inSource.has(e.message))
        .map(e => e.message);
      expect(
        phantom,
        `declared in ${manifest.id}.manifest.ts but nothing throws it — remove it, or set fromApi: true if the API raises it`
      ).toEqual([]);
    });

    it.runIf(!errorsGenerated)('has a hand-written errors page covering every throw', () => {
      const file = join(refDir, 'errors.md');
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      const page = readFileSync(file, 'utf8');
      const missing = thrown
        .filter(e => !page.includes(e.message.split('{')[0].trim()))
        .map(e => `${e.message}  (${e.where})`);
      expect(
        missing,
        `${manifest.id} throws these but its hand-written errors.md does not mention them`
      ).toEqual([]);
    });

    /**
     * The one snippet per feature that is known to work, because Playwright runs
     * it. Generated only for features whose fixture marks a `docs:example` region
     * — the alternative, dumping a whole fixture, would publish test scaffolding
     * (debug spans, duplicate variants) as if it were recommended markup.
     */
    const example = extractFixtureExample(
      join(ROOT, 'e2e/fixtures', `${manifest.id}.html`),
      ROOT
    );

    it.runIf(!!example)('tested-example.md matches the e2e fixture', () => {
      if (!example) return;
      const expected = renderTestedExample(manifest, example);
      const file = join(refDir, 'tested-example.md');
      if (UPDATE) {
        mkdirSync(refDir, { recursive: true });
        writeFileSync(file, expected);
      }
      expect(existsSync(file), `${relative(SRC, file)} is missing`).toBe(true);
      expect(readFileSync(file, 'utf8')).toBe(expected);
    });

    it('is named after the id it declares', () => {
      expect(basename(file)).toBe(`${manifest.id}.manifest.ts`);
    });

    it('names only attributes that appear in the feature source', () => {
      const source = featureSource(dir, manifest.id, ownFolder, manifest.extraSource);
      const declared = [
        ...manifest.attributes.map(a => a.name),
        ...(manifest.readsElsewhere ?? []).map(a => a.name),
      ]
        // Entries like `min / max / step` and `data-selected-package / …`
        // document several names in one row.
        .flatMap(name => name.split(' / '))
        .filter(name => name.startsWith('data-'))
        // The activating attribute is consumed by AttributeScanner to decide
        // which feature to instantiate, so the feature itself never reads it.
        // The scanner-registration test below covers it instead.
        .filter(name => !(manifest.activates ?? '').includes(name));

      const missing = declared.filter(name => !source.includes(name));
      expect(missing, `documented but never read by ${manifest.id}`).toEqual([]);
    });

    it('emits only events the feature source actually emits', () => {
      const source = featureSource(dir, manifest.id, ownFolder, manifest.extraSource);
      const missing = manifest.emits.filter(
        event => !source.includes(`'${event}'`)
      );
      expect(missing, `documented but never emitted by ${manifest.id}`).toEqual(
        []
      );
    });

    /**
     * A feature with no activating attribute has no markup to show, so its
     * get-started page is only useful if the manifest carries a real call. Without
     * this the page can only say "call the method", which is the `…` placeholder the
     * guide rules forbid.
     */
    it.runIf(!!manifest.activatedByApi)('carries a runnable apiExample', () => {
      expect(
        manifest.apiExample?.trim(),
        `${manifest.id} is turned on from JavaScript, so its get-started page has no markup to show — add apiExample with a real call`
      ).toBeTruthy();
      expect(
        manifest.apiExample ?? '',
        'no ellipsis placeholders — use real values or {TOKENS}'
      ).not.toMatch(/…|\.\.\./);
    });

    it('declares exactly one way of being turned on', () => {
      const ways = [manifest.activates, manifest.activatedByApi].filter(Boolean);
      expect(ways, 'set either activates (an attribute) or activatedByApi (a next.* call)').toHaveLength(1);
    });

    it.runIf(!!manifest.activates)('is registered in AttributeScanner under every activating selector', () => {
      const scanner = readFileSync(join(SRC, 'core/attribute-scanner.ts'), 'utf8');
      const selectors = [manifest.activates ?? '', ...(manifest.alsoActivates ?? [])];
      const unqueried = selectors.filter(
        s => !scanner.includes(s) && !scanner.includes(bareSelector(s))
      );
      expect(
        unqueried,
        `${manifest.id} claims these selectors but AttributeScanner never queries them — the feature would never instantiate through them`
      ).toEqual([]);
    });
  });
});
