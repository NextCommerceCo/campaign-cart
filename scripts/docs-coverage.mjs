/**
 * Documentation coverage gate.
 *
 * Measures three things the SDK's readers depend on, and fails when a NEW gap
 * appears:
 *
 *   1. `data-next-*` attributes  — every attribute the code reads must be
 *      documented in some feature's `guide/reference/attributes.md`.
 *   2. `EventMap` events         — every event must carry a TSDoc comment, since
 *      the site's events reference is generated from it.
 *   3. Feature guides            — every feature with an enhancer must have a
 *      `guide/overview.md`.
 *
 * Known gaps are frozen in `docs-coverage.baseline.json` (a ratchet). A gap in
 * the baseline is tolerated; anything new fails. Gaps that have since been
 * closed are reported so the baseline can shrink:
 *
 *   npm run docs:coverage          # check (CI)
 *   npm run docs:coverage:update   # rewrite the baseline from current state
 *
 * See docs/documentation-plan.md §5 Phase 0.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const FEATURES = join(SRC, 'features');
const BASELINE_PATH = join(ROOT, 'scripts/docs-coverage.baseline.json');
const UPDATE = process.env.UPDATE_DOCS_BASELINE === '1';

// ---------------------------------------------------------------------------
// file walking
// ---------------------------------------------------------------------------

/** Every file under `dir` matching `test`, skipping test files and fixtures. */
function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests' || entry.name === 'node_modules') continue;
      walk(full, test, out);
    } else if (test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const isSourceTs = name => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts');
const isMarkdown = name => name.endsWith('.md') || name.endsWith('.mdx');

// ---------------------------------------------------------------------------
// 1. data-next-* attributes
// ---------------------------------------------------------------------------

/**
 * Every `data-next-*` attribute the source reads or writes. Names ending in `-`
 * are prefix patterns (`data-next-class-<name>`), kept as-is so the docs can
 * describe the pattern rather than each instance.
 */
function scanAttributes() {
  const files = walk(SRC, isSourceTs)
    .filter(f => !f.includes(`${join(SRC, 'tests')}`))
    // Manifests are documentation, not code. Counting them makes the metric circular:
    // declaring an attribute would add it to the set of attributes that need
    // declaring, so the denominator grew every time a gap was closed.
    .filter(f => !f.endsWith('.manifest.ts'));
  const found = new Set();
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/data-next-[a-z0-9-]+/g)) found.add(m[0]);
  }
  return [...found].sort();
}

/**
 * Every place an attribute can legitimately be documented: the per-feature guides,
 * the state guides, and the two generated repo-level pages — the global index and
 * the SDK-level attributes, which own the attributes no feature does.
 */
/**
 * Every attribute name declared in a manifest.
 *
 * The looser corpus below counts an attribute as documented if it appears in *any*
 * markdown under `features/` — which a folder `README.md` can satisfy. That is not
 * enough: the global attribute index and the VS Code editor data are generated from
 * the manifests, so an attribute mentioned only in prose is missing from both while
 * coverage still reads 100%. That happened to `data-next-payment-method`.
 */
function attributesDeclaredInManifests() {
  const declared = new Set();
  for (const file of walk(FEATURES, name => name.endsWith('.manifest.ts'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/name:\s*'(data-[a-z0-9-]+)'/g)) declared.add(m[1]);
    // Activation selectors: `activates: '[data-next-foo="bar"]'`
    for (const m of src.matchAll(/\[(data-[a-z0-9-]+)/g)) declared.add(m[1]);
  }
  const sdk = join(SRC, 'docs/content/sdk-attributes.ts');
  if (existsSync(sdk)) {
    for (const m of readFileSync(sdk, 'utf8').matchAll(/name:\s*'(data-[a-z0-9-]+)'/g)) {
      declared.add(m[1]);
    }
  }
  return declared;
}

function attributesDocumentedInGuides() {
  const files = [
    ...walk(FEATURES, isMarkdown),
    ...walk(join(SRC, 'state'), isMarkdown),
    join(ROOT, 'docs/sdk-attributes.md'),
    join(ROOT, 'docs/attribute-index.md'),
  ].filter(existsSync);
  return files.map(f => readFileSync(f, 'utf8')).join('\n');
}

// ---------------------------------------------------------------------------
// 2. EventMap events
// ---------------------------------------------------------------------------

/**
 * Every `EventMap` key with whether it carries a TSDoc description. Parsed from
 * the AST rather than by regex, because payload shapes are nested object types
 * that a line-based scan cannot bracket correctly.
 */
function scanEvents() {
  const file = join(SRC, 'types/global.ts');
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

  const events = [];
  const visit = node => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'EventMap') {
      for (const member of node.members) {
        if (!member.name) continue;
        const name = member.name.getText(sf).replace(/^['"]|['"]$/g, '');
        const docs = ts.getJSDocCommentsAndTags(member);
        const described = docs.some(d => {
          const c = d.comment;
          if (typeof c === 'string') return c.trim().length > 0;
          if (!Array.isArray(c)) return false;
          // A part is either text or a link. `{@link Foo}` parses to a JSDocLink whose
          // `text` is empty — the symbol sits in `name` — so testing `text` alone scored
          // a summary written purely as a link as *undocumented*. Same blind spot the
          // events-guide extractor had (see src/tests/docs/extract-event-docs.ts).
          return c.some(part => {
            const text = (part.text ?? '').trim();
            if (text.length > 0) return true;
            return Boolean(part.name && part.name.getText(sf).trim().length > 0);
          });
        });
        events.push({ name, described });
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return events;
}

// ---------------------------------------------------------------------------
// 3. Feature guides
// ---------------------------------------------------------------------------

/**
 * A DOM-activated feature: an `*.enhancer.ts` exporting a class that extends one
 * of the base enhancers. This excludes two kinds of file that also end in
 * `.enhancer.ts` but are not features a reader can turn on with an attribute:
 *
 * - deprecated re-export shims (`display/cart-display.enhancer.ts`, whose class
 *   actually lives in `cart/cart-summary/`)
 * - helper classes another feature constructs directly rather than
 *   `AttributeScanner` activating (`checkout/address-autocomplete/`)
 *
 * Counting either would put a permanently-unreachable row in the denominator.
 */
function isDomActivated(file) {
  return /class\s+\w+\s+extends\s+Base\w*Enhancer/.test(readFileSync(file, 'utf8'));
}

/**
 * Every DOM-activated feature, and whether it has a guide and a manifest. The
 * guide lives either in the enhancer's own folder (`add-to-cart/guide/`) or, for
 * enhancers that still sit flat in a category folder
 * (`features/display/product-display.enhancer.ts`), in a sibling folder named
 * after it (`features/display/product-display/guide/`).
 */
function scanFeatures() {
  const enhancers = walk(FEATURES, name => name.endsWith('.enhancer.ts')).filter(
    isDomActivated
  );
  return enhancers
    .map(file => {
      const dir = dirname(file);
      const base = file.split(/[\\/]/).pop().replace('.enhancer.ts', '');
      const ownFolder = dir.split(/[\\/]/).pop() === base;
      const guideDirs = ownFolder ? [dir] : [dir, join(dir, base)];
      return {
        id: base,
        path: relative(ROOT, file),
        hasGuide: guideDirs.some(d => existsSync(join(d, 'guide/overview.md'))),
        hasManifest: guideDirs.some(d => existsSync(join(d, `${base}.manifest.ts`))),
        // A snippet nobody runs is a snippet that can rot. This is true when the
        // feature's Playwright fixture marks a `docs:example` region, which is
        // what gets published as its example.
        hasTestedExample: guideDirs.some(d =>
          existsSync(join(d, 'guide/reference/tested-example.md'))
        ),
        // Generated from the feature's own logger calls, so a console line can be
        // searched back to the code that printed it.
        hasLogs: guideDirs.some(d =>
          existsSync(join(d, 'guide/reference/logs.md'))
        ),
        // "Can this fail, and what do I do about it." A feature that throws nothing
        // still gets a page saying so, so the answer is never "no page, who knows".
        hasErrors: guideDirs.some(d =>
          existsSync(join(d, 'guide/reference/errors.md'))
        ),
        // What this needs on the page, and what breaks it. Generated from the
        // manifests, deriving links in both directions.
        hasRelations: guideDirs.some(d => existsSync(join(d, 'guide/relations.md'))),
        // Zero to working. Generated from the manifest plus the tested fixture snippet.
        hasGetStarted: guideDirs.some(d => existsSync(join(d, 'guide/get-started.md'))),
        // When to reach for this feature, and when not to. Hand-written: recognising
        // the right tool for a product situation is not derivable from the code.
        hasUseCases: guideDirs.some(d => existsSync(join(d, 'guide/use-cases.md'))),
        // A feature turned on from JavaScript (`next.fomo({…})`) has no markup to
        // show, so a markup example is not a gap for it — it is not applicable.
        needsExample: guideDirs.every(d => {
          const manifest = join(d, `${base}.manifest.ts`);
          return existsSync(manifest)
            ? !/activatedByApi:/.test(readFileSync(manifest, 'utf8'))
            : true;
        }),
        hasFolder: ownFolder,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}


// ---------------------------------------------------------------------------
// 4. Stores
// ---------------------------------------------------------------------------

/**
 * Every Zustand store under `src/state/`, and whether it has a generated state
 * reference. A store is a `*.state.ts` file, or a folder containing one.
 *
 * Stores were the last layer with no reader-facing docs: features reached 100% while
 * state sat at one of seven.
 */
function scanStores() {
  const STATE = join(SRC, 'state');
  const files = walk(STATE, name => name.endsWith('.state.ts'));
  return files
    .map(file => {
      const dir = dirname(file);
      const base = file.split(/[\\/]/).pop().replace('.state.ts', '');
      const ownFolder = dir.split(/[\\/]/).pop() === base;
      const home = ownFolder ? dir : join(dir, base);
      return {
        id: base,
        hasManifest:
          existsSync(join(dir, `${base}.state-manifest.ts`)) ||
          existsSync(join(home, `${base}.state-manifest.ts`)),
        hasReference: existsSync(join(home, 'guide/reference/state-reference.md')),
        // The narrative half: what this store is for, which a generator cannot write.
        hasOverview: existsSync(join(home, 'guide/overview.md')),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// 5. Core — the engine's author-facing contracts
// ---------------------------------------------------------------------------

const CORE = join(SRC, 'core');
const CORE_GUIDE = join(CORE, 'guide');
const DOCS_CONTENT = join(SRC, 'docs', 'content');

/**
 * Core was outside this gate until Phase 6, and that was the problem: 75 files and
 * ~29,900 lines with three READMEs, reporting no gap because nothing measured it. The
 * gate said 13 metrics at 100% while a whole layer of the SDK had no documentation.
 *
 * The unit measured is **not** the file and **not** the exported symbol. By file is
 * wrong because 37% of core's lines are the debug overlay and two files are dead. By
 * exported symbol is worse: 228 exports would improve by writing TSDoc that answers a
 * contributor's question, not an author's. (Core TSDoc *is* published now — `src/core` is
 * a TypeDoc entry point since 2026-07-31 — but it publishes class and symbol pages, which
 * is not where someone building a page looks.) So the unit is the **contract a page
 * depends on** — see `src/docs/content/core-subsystems.ts`.
 *
 * A deliberate limit on the scans below: they measure what can be counted from the
 * source **without re-implementing the extractors** that generate the pages. Meta tags
 * and storage keys have reliable literal forms, so they are counted. URL parameters do
 * not — `params.get('x')` is indistinguishable by regex from a `FormData` or `Map` read,
 * and the naive scan picks up checkout fields (`address1`, `province`, `postal`) that are
 * not URL parameters at all. Rather than publish a denominator that is wrong, that
 * contract is left to the bidirectional drift test in `src/tests/docs/coreContracts.test.ts`,
 * which compares declarations against the real AST. A metric that cannot be measured
 * honestly is worse than no metric — it reads as coverage.
 */

/**
 * The files a contract may be *read* in — real SDK code only.
 *
 * Manifests and the `src/docs/` declaration files are documentation, so counting them
 * makes the metric circular: declaring a key would add it to the set of keys needing
 * declaration, and the denominator would grow every time a gap was closed. That
 * happened once already, to the attribute metric (§5m), which is why it is excluded
 * here from the start rather than after the same bug.
 */
function contractSourceFiles() {
  return walk(SRC, isSourceTs).filter(
    f => !f.endsWith('.manifest.ts') && !f.includes(join(SRC, 'docs'))
  );
}

/** Read a core guide page, or `''` when it has not been generated yet. */
function coreGuidePage(name) {
  const file = join(CORE_GUIDE, 'reference', `${name}.md`);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

/**
 * The author-facing subsystems, from the inventory. Rows marked `contributorOnly` are
 * documented for the next maintainer rather than for a page author, so they are not a
 * reader-facing gap and are excluded — the same reason `docs-coverage` refuses
 * permanently-unreachable feature rows.
 */
function scanCoreSubsystems() {
  const file = join(DOCS_CONTENT, 'core-subsystems.ts');
  if (!existsSync(file)) return [];
  const src = readFileSync(file, 'utf8');
  return src
    .split('defineCoreSubsystem(')
    .slice(1)
    .map(block => {
      const id = block.match(/id:\s*'([a-z0-9-]+)'/)?.[1];
      if (!id) return null;
      return {
        id,
        contributorOnly: /contributorOnly:/.test(block.split('defineCoreSubsystem')[0]),
        // The judgement half — the mental model and the domain rules. One file per
        // subsystem, so it can be written by several people without collision.
        hasOverview: existsSync(join(CORE_GUIDE, 'subsystems', `${id}.md`)),
      };
    })
    .filter(Boolean)
    .filter(s => !s.contributorOnly)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Every generated reference page the subsystems point at. A subsystem links to these
 * instead of restating them, so a missing one is a broken promise on a page that is
 * already published — the off-by-one class of bug §5e found 19 of.
 */
function scanCoreReferencePages() {
  const file = join(DOCS_CONTENT, 'core-subsystems.ts');
  if (!existsSync(file)) return [];
  const src = readFileSync(file, 'utf8');
  const wanted = new Set();
  for (const block of src.matchAll(/reference:\s*\[([^\]]*)\]/g)) {
    for (const m of block[1].matchAll(/'([a-z0-9-]+)'/g)) wanted.add(m[1]);
  }
  return [...wanted]
    .sort()
    .map(name => ({ id: name, exists: coreGuidePage(name) !== '' }));
}

/**
 * The `dl_*` analytics events, from `events.manifest.json` — generated by
 * `src/tests/utils/analyticsVocabulary.test.ts`, which already fails CI on drift. It is
 * the one analytics source that was machine-readable before Phase 7 and the precedent
 * the whole documentation plan was modelled on, so it is the honest denominator here.
 */
function scanAnalyticsEvents() {
  const file = join(CORE, 'analytics/schemas/events.manifest.json');
  if (!existsSync(file)) return [];
  const names = (JSON.parse(readFileSync(file, 'utf8')).events ?? []).map(e => e.name);
  const page = coreGuidePage('analytics-events');
  const declared = existsSync(join(DOCS_CONTENT, 'analytics-events.ts'))
    ? readFileSync(join(DOCS_CONTENT, 'analytics-events.ts'), 'utf8')
    : '';
  // Documented means it reached the reader *and* carries prose a generator could not
  // derive. Either half alone is how `data-next-payment-method` read 100% while being
  // absent from the index and the editor data (§5m).
  return names.map(name => ({
    id: name,
    documented: page.includes(name) && declared.includes(name),
  }));
}

/**
 * Every public member of `NextCommerce`, and whether the JavaScript API page names it.
 *
 * This is the check the plan said would have caught the seven methods missing from the
 * site (`swapCart`, `getVariantsByProductId`, and five more) while 58 of 65 were
 * documented and nothing reported a gap.
 */
function scanNextMethods() {
  const file = join(CORE, 'next-commerce.ts');
  if (!existsSync(file)) return [];
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const page = coreGuidePage('javascript-api');
  const members = [];

  const isPublic = node =>
    !node.modifiers?.some(
      m =>
        m.kind === ts.SyntaxKind.PrivateKeyword ||
        m.kind === ts.SyntaxKind.ProtectedKeyword ||
        m.kind === ts.SyntaxKind.StaticKeyword
    ) && !node.name?.getText?.().startsWith('_');

  const visit = node => {
    if (ts.isClassDeclaration(node) && node.name?.getText() === 'NextCommerce') {
      for (const member of node.members) {
        const named =
          ts.isMethodDeclaration(member) ||
          ts.isGetAccessorDeclaration(member) ||
          ts.isPropertyDeclaration(member);
        if (!named || !member.name || !isPublic(member)) continue;
        const name = member.name.getText(source);
        if (name.startsWith('#')) continue;
        members.push({ id: name, documented: page.includes(name) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return members.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Every `<meta name="…">` the SDK reads, and whether the meta-tag reference names it.
 * Interpolated names (`meta[name="${x}"]`) are skipped — they are a lookup helper, not
 * a contract with a name a reader can put on a page.
 */
function scanMetaTags() {
  const page = coreGuidePage('meta-tags');
  const found = new Set();
  for (const file of contractSourceFiles()) {
    for (const m of readFileSync(file, 'utf8').matchAll(/meta\[name=["']([^"'$]+)["']\]/g)) {
      found.add(m[1]);
    }
  }
  return [...found].sort().map(name => ({ id: name, documented: page.includes(name) }));
}

/**
 * Every literal storage key the SDK writes, and whether the storage reference names it.
 *
 * Literal `setItem` calls and `persist({ name })` only: the dynamic keys
 * (`next-campaign-cache_{currency}`, `next-price-{hash}`, `upsells_{orderId}`) have no
 * name a scanner can quote, so they are the drift test's business, not this metric's.
 */
function scanStorageKeys() {
  const page = coreGuidePage('storage-keys');
  const found = new Set();
  for (const file of contractSourceFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(
      /(?:sessionStorage|localStorage)\.(?:set|get|remove)Item\(\s*['"]([a-zA-Z0-9_-]+)['"]/g
    )) {
      found.add(m[1]);
    }
    for (const m of src.matchAll(/name:\s*['"]((?:next|os)[a-zA-Z0-9_-]*)['"]/g)) {
      found.add(m[1]);
    }
    // Keys that reach storage through a named constant rather than a literal call —
    // `export const CART_STORAGE_KEY = 'next-cart-state'`. Without this the cart's own
    // key was missing from the denominator, so the metric would have read 100% while
    // the most important key in the SDK went undocumented.
    if (file.endsWith(join('core', 'storage.ts'))) {
      for (const m of src.matchAll(/export const [A-Z0-9_]+\s*=\s*['"]([^'"]+)['"]/g)) {
        found.add(m[1]);
      }
    }
  }
  return [...found].sort().map(key => ({ id: key, documented: page.includes(key) }));
}

/**
 * Nav frontmatter on every guide page the docs site publishes.
 *
 * TypeDoc turns a document's `title` into the page's **name**, and the router turns
 * that name into the filename — so `title: "Features/Cart/Quantity Control/Attributes"`
 * both draws the sidebar path and fixes the URL at
 * `documents/Features_Cart_Quantity_Control_Attributes.html`. Three consequences this
 * measures:
 *
 * 1. **No frontmatter, no place in the tree.** The page still publishes, but under its
 *    raw file path, so it reads as a stray.
 * 2. **A duplicate title is a duplicate URL** — two pages claim one filename and one
 *    silently wins. This is reported as a hard failure rather than a percentage,
 *    because a ratchet that tolerates it would tolerate losing a page.
 * 3. **Siblings must share a prefix.** Every page in one `guide/` folder belongs under
 *    the same three segments; a typo in one title scatters it elsewhere in the sidebar.
 *
 * See `src/docs/content/nav.ts` — the single place the frontmatter is written.
 */
function scanNavFrontmatter() {
  const files = [
    ...walk(FEATURES, isMarkdown),
    ...walk(join(SRC, 'state'), isMarkdown),
    ...walk(CORE_GUIDE, isMarkdown),
    // The two cross-cutting index pages under docs/ — they belong to no feature, store or
    // subsystem, but they are published from `projectDocuments` like every other page and
    // carry the same frontmatter, so the gate measures them too.
    ...['docs/attribute-index.md', 'docs/sdk-attributes.md']
      .map(f => join(ROOT, f))
      .filter(existsSync),
  ].filter(
    f =>
      f.includes(`${sep}guide${sep}`) ||
      f.startsWith(CORE_GUIDE) ||
      dirname(f) === join(ROOT, 'docs')
  );

  return files.sort().map(file => {
    const src = readFileSync(file, 'utf8');
    const title = /^---\r?\n(?:[\s\S]*?\r?\n)?title:\s*"?([^"\r\n]+)"?/.exec(src)?.[1];
    return {
      id: relative(ROOT, file),
      folder: relative(ROOT, dirname(file)),
      title: title?.trim(),
    };
  });
}

/**
 * Site-absolute links — `](/docs/campaigns/…)` — in anything the docs site publishes.
 *
 * This closes a hole in the build's own link check, not a documentation gap.
 * TypeDoc's `validation.invalidLink` only resolves **relative** paths, so an absolute
 * one passes `npm run docs:check` silently and ships as a dead link. Three had already
 * shipped that way, pointing at the retired Fumadocs site, and nothing caught them.
 *
 * The new site has no absolute-path routes of its own — a page is reached relatively or
 * via `{@link}` — so any `](/…)` is wrong by construction. External links (`https://…`)
 * are untouched: they are somebody else's site and not this gate's business.
 */
function scanAbsoluteLinks() {
  const files = [
    ...walk(FEATURES, isMarkdown),
    ...walk(join(SRC, 'state'), isMarkdown),
    ...walk(CORE_GUIDE, isMarkdown),
    ...walk(SRC, isSourceTs), // TSDoc comments publish as page content too.
    ...['docs/attribute-index.md', 'docs/sdk-attributes.md', 'docs/site-home.md']
      .map(f => join(ROOT, f))
      .filter(existsSync),
  ];

  const hits = [];
  for (const file of [...new Set(files)].sort()) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/\]\((\/[^)]*)\)/g)) {
        hits.push(`${relative(ROOT, file)}:${i + 1} → ${m[1]}`);
      }
    });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

const attributes = scanAttributes();
const guideCorpus = attributesDocumentedInGuides();
const undocumentedAttributes = attributes.filter(a => !guideCorpus.includes(a));

const manifestDeclared = attributesDeclaredInManifests();
const attributesNotInAManifest = attributes.filter(a => !manifestDeclared.has(a));

const events = scanEvents();
const undescribedEvents = events.filter(e => !e.described).map(e => e.name);

const features = scanFeatures();
const stores = scanStores();
const storesWithoutReference = stores.filter(t => !t.hasReference).map(t => t.id);
const storesWithoutOverview = stores.filter(t => !t.hasOverview).map(t => t.id);
const featuresWithoutGuide = features.filter(f => !f.hasGuide).map(f => f.id);
const featuresWithoutManifest = features
  .filter(f => !f.hasManifest)
  .map(f => f.id);
// Only features that are turned on by markup can have a markup example.
const examplesApply = features.filter(f => f.needsExample);
const featuresWithoutLogs = features.filter(f => !f.hasLogs).map(f => f.id);
const featuresWithoutErrors = features.filter(f => !f.hasErrors).map(f => f.id);
const featuresWithoutRelations = features.filter(f => !f.hasRelations).map(f => f.id);
const featuresWithoutGetStarted = features
  .filter(f => !f.hasGetStarted)
  .map(f => f.id);
const featuresWithoutUseCases = features.filter(f => !f.hasUseCases).map(f => f.id);
const featuresWithoutTestedExample = examplesApply
  .filter(f => !f.hasTestedExample)
  .map(f => f.id);

const coreSubsystems = scanCoreSubsystems();
const coreSubsystemsWithoutOverview = coreSubsystems
  .filter(s => !s.hasOverview)
  .map(s => s.id);
const coreReferencePages = scanCoreReferencePages();
const coreReferencePagesMissing = coreReferencePages.filter(p => !p.exists).map(p => p.id);
const analyticsEvents = scanAnalyticsEvents();
const analyticsEventsWithoutDocs = analyticsEvents
  .filter(e => !e.documented)
  .map(e => e.id);
const nextMethods = scanNextMethods();
const nextMethodsWithoutDocs = nextMethods.filter(m => !m.documented).map(m => m.id);
const metaTags = scanMetaTags();
const metaTagsWithoutDocs = metaTags.filter(m => !m.documented).map(m => m.id);
const storageKeys = scanStorageKeys();
const storageKeysWithoutDocs = storageKeys.filter(k => !k.documented).map(k => k.id);

const navPages = scanNavFrontmatter();
const absoluteLinks = scanAbsoluteLinks();
const pagesWithoutNavTitle = navPages.filter(p => !p.title).map(p => p.id);

// A duplicate title is a duplicate URL, and a sibling that disagrees on its prefix
// lands somewhere else in the sidebar. Both are reported outside the ratchet — see
// scanNavFrontmatter().
const titleOwners = new Map();
for (const page of navPages.filter(p => p.title)) {
  titleOwners.set(page.title, [...(titleOwners.get(page.title) ?? []), page.id]);
}
const duplicateNavTitles = [...titleOwners]
  .filter(([, owners]) => owners.length > 1)
  .map(([title, owners]) => `${title} — ${owners.join(', ')}`);

// A page's sidebar parent is every title segment but the last. Pages in one folder sit
// side by side in the tree, so they must agree on it — the depth itself varies by layer
// (`Features/Cart/Quantity Control/Attributes` is 4 segments, `State/Cart/Overview` 3,
// `Core/Overview` 2), which is why this compares parents rather than a fixed prefix.
const navParentOf = title => title.split('/').slice(0, -1).join('/');
const navPrefixMismatches = [];
for (const folder of new Set(navPages.map(p => p.folder))) {
  const parents = new Set(
    navPages.filter(p => p.folder === folder && p.title).map(p => navParentOf(p.title))
  );
  if (parents.size > 1) {
    navPrefixMismatches.push(`${folder} — ${[...parents].join(' vs ')}`);
  }
}

const pct = (have, total) => (total === 0 ? 100 : Math.round((have / total) * 100));

const current = {
  undocumentedAttributes,
  undescribedEvents,
  featuresWithoutGuide,
  featuresWithoutManifest,
  featuresWithoutTestedExample,
  featuresWithoutLogs,
  featuresWithoutErrors,
  featuresWithoutRelations,
  featuresWithoutGetStarted,
  featuresWithoutUseCases,
  attributesNotInAManifest,
  storesWithoutReference,
  storesWithoutOverview,
  coreSubsystemsWithoutOverview,
  coreReferencePagesMissing,
  analyticsEventsWithoutDocs,
  nextMethodsWithoutDocs,
  metaTagsWithoutDocs,
  storageKeysWithoutDocs,
  pagesWithoutNavTitle,
};

if (UPDATE) {
  const baseline = {
    $comment:
      'Frozen documentation gaps (a ratchet). New gaps fail `npm run docs:coverage`; ' +
      'entries here are tolerated until closed. Regenerate: npm run docs:coverage:update',
    generated: {
      attributes: `${attributes.length - undocumentedAttributes.length}/${attributes.length}`,
      events: `${events.length - undescribedEvents.length}/${events.length}`,
      guides: `${features.length - featuresWithoutGuide.length}/${features.length}`,
      manifests: `${features.length - featuresWithoutManifest.length}/${features.length}`,
      testedExamples: `${examplesApply.length - featuresWithoutTestedExample.length}/${examplesApply.length}`,
      logs: `${features.length - featuresWithoutLogs.length}/${features.length}`,
      errors: `${features.length - featuresWithoutErrors.length}/${features.length}`,
      relations: `${features.length - featuresWithoutRelations.length}/${features.length}`,
      getStarted: `${features.length - featuresWithoutGetStarted.length}/${features.length}`,
      useCases: `${features.length - featuresWithoutUseCases.length}/${features.length}`,
      stores: `${stores.length - storesWithoutReference.length}/${stores.length}`,
      storeOverviews: `${stores.length - storesWithoutOverview.length}/${stores.length}`,
      coreSubsystemOverviews: `${coreSubsystems.length - coreSubsystemsWithoutOverview.length}/${coreSubsystems.length}`,
      coreReferencePages: `${coreReferencePages.length - coreReferencePagesMissing.length}/${coreReferencePages.length}`,
      analyticsEvents: `${analyticsEvents.length - analyticsEventsWithoutDocs.length}/${analyticsEvents.length}`,
      nextMethods: `${nextMethods.length - nextMethodsWithoutDocs.length}/${nextMethods.length}`,
      metaTags: `${metaTags.length - metaTagsWithoutDocs.length}/${metaTags.length}`,
      storageKeys: `${storageKeys.length - storageKeysWithoutDocs.length}/${storageKeys.length}`,
    },
    ...current,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline written to ${relative(ROOT, BASELINE_PATH)}`);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { undocumentedAttributes: [], undescribedEvents: [], featuresWithoutGuide: [] };

const KINDS = [
  {
    key: 'undocumentedAttributes',
    label: 'data-next-* attributes documented in a feature guide',
    have: attributes.length - undocumentedAttributes.length,
    total: attributes.length,
    fix: 'add it to the feature\'s guide/reference/attributes.md',
  },
  {
    key: 'attributesNotInAManifest',
    label: 'data-next-* attributes declared in a manifest (drives the index + editor data)',
    have: attributes.length - attributesNotInAManifest.length,
    total: attributes.length,
    fix: 'add it to the feature\'s *.manifest.ts (attributes or readsElsewhere), then run npm run docs:reference',
  },
  {
    key: 'undescribedEvents',
    label: 'EventMap events carrying a TSDoc description',
    have: events.length - undescribedEvents.length,
    total: events.length,
    fix: 'add a TSDoc comment above the event in src/types/global.ts',
  },
  {
    key: 'featuresWithoutGuide',
    label: 'features with a guide/overview.md',
    have: features.length - featuresWithoutGuide.length,
    total: features.length,
    fix: 'scaffold the guide/ set per .claude/rules/guide.md',
  },
  {
    key: 'featuresWithoutManifest',
    label: 'features with a generated reference (*.manifest.ts)',
    have: features.length - featuresWithoutManifest.length,
    total: features.length,
    fix: 'write <feature>.manifest.ts, then run npm run docs:reference',
  },
  {
    key: 'featuresWithoutLogs',
    label: 'features with a reference/logs.md',
    have: features.length - featuresWithoutLogs.length,
    total: features.length,
    fix: 'run npm run docs:reference — it is generated from the feature\'s logger calls',
  },
  {
    key: 'featuresWithoutErrors',
    label: 'features with a reference/errors.md',
    have: features.length - featuresWithoutErrors.length,
    total: features.length,
    fix: 'declare errors[] in the manifest, then run npm run docs:reference',
  },
  {
    key: 'featuresWithoutRelations',
    label: 'features with a relations.md',
    have: features.length - featuresWithoutRelations.length,
    total: features.length,
    fix: 'declare dependsOn / pairsWith / requires in the manifest, then run npm run docs:reference',
  },
  {
    key: 'featuresWithoutGetStarted',
    label: 'features with a get-started.md',
    have: features.length - featuresWithoutGetStarted.length,
    total: features.length,
    fix: 'run npm run docs:reference — it is generated from the manifest and the fixture',
  },
  {
    key: 'featuresWithoutUseCases',
    label: 'features with a use-cases.md',
    have: features.length - featuresWithoutUseCases.length,
    total: features.length,
    fix: 'write guide/use-cases.md per .claude/rules/guide.md — 2+ scenarios with effort signals, and a "When NOT to use this"',
  },
  {
    key: 'storesWithoutReference',
    label: 'stores with a generated state reference',
    have: stores.length - storesWithoutReference.length,
    total: stores.length,
    fix: 'write <store>.state-manifest.ts, then run npm run docs:reference',
  },
  {
    key: 'storesWithoutOverview',
    label: 'stores with a guide/overview.md',
    have: stores.length - storesWithoutOverview.length,
    total: stores.length,
    fix: 'write guide/overview.md per .claude/rules/guide.md — what the store is for, its concept, rules, decisions, limitations',
  },
  {
    key: 'coreSubsystemsWithoutOverview',
    label: 'core subsystems with a guide/subsystems/<id>.md',
    have: coreSubsystems.length - coreSubsystemsWithoutOverview.length,
    total: coreSubsystems.length,
    fix: 'write src/core/guide/subsystems/<id>.md per .claude/rules/guide.md — what it does for the page, the mental model, the rules, the traps',
  },
  {
    key: 'coreReferencePagesMissing',
    label: 'core reference pages the subsystem inventory links to',
    have: coreReferencePages.length - coreReferencePagesMissing.length,
    total: coreReferencePages.length,
    fix: 'generate the page under src/core/guide/reference/, or drop it from the subsystem\'s reference[] — a link the inventory promises and does not have is a broken page',
  },
  {
    key: 'analyticsEventsWithoutDocs',
    label: 'dl_* analytics events with a catalogue entry and prose',
    have: analyticsEvents.length - analyticsEventsWithoutDocs.length,
    total: analyticsEvents.length,
    fix: 'add it to src/docs/content/analytics-events.ts (when it fires, what each field means, which provider reshapes it), then regenerate',
  },
  {
    key: 'nextMethodsWithoutDocs',
    label: 'public NextCommerce members named on the JavaScript API page',
    have: nextMethods.length - nextMethodsWithoutDocs.length,
    total: nextMethods.length,
    fix: 'document it in src/docs/content/next-methods.ts with a runnable example, then regenerate — TSDoc on the class publishes a contributor-facing symbol page, not the task-shaped JavaScript API reference an author reads',
  },
  {
    key: 'metaTagsWithoutDocs',
    label: '<meta> tags the SDK reads, documented in the meta-tag reference',
    have: metaTags.length - metaTagsWithoutDocs.length,
    total: metaTags.length,
    fix: 'add it to src/docs/content/meta-tags.ts, then regenerate',
  },
  {
    key: 'storageKeysWithoutDocs',
    label: 'literal storage keys documented in the storage reference',
    have: storageKeys.length - storageKeysWithoutDocs.length,
    total: storageKeys.length,
    fix: 'add it to src/docs/content/storage-keys.ts with its TTL and what clearing it costs the visitor, then regenerate',
  },
  {
    key: 'featuresWithoutTestedExample',
    label: 'markup features whose published example is one Playwright runs',
    have: examplesApply.length - featuresWithoutTestedExample.length,
    total: examplesApply.length,
    fix:
      'wrap the useful part of e2e/fixtures/<feature>.html in ' +
      '<!-- docs:example Title --> … <!-- /docs:example -->, then run npm run docs:reference',
  },
  {
    key: 'pagesWithoutNavTitle',
    label: 'guide pages carrying nav frontmatter (title = sidebar path + URL)',
    have: navPages.length - pagesWithoutNavTitle.length,
    total: navPages.length,
    fix:
      'add title/group/category frontmatter — generated pages from the render-*.ts that ' +
      'owns them (see src/docs/content/nav.ts), hand-written pages in the file itself',
  },
];

console.log('\nDocumentation coverage\n');
for (const kind of KINDS) {
  console.log(`  ${String(pct(kind.have, kind.total)).padStart(3)}%  ${kind.have}/${kind.total}  ${kind.label}`);
}

const notActivated = walk(FEATURES, name => name.endsWith('.enhancer.ts')).filter(
  f => !isDomActivated(f)
);
if (notActivated.length) {
  console.log(
    `\n  excluded from the counts above — not DOM-activated:\n` +
      notActivated.map(f => `    ${relative(ROOT, f)}`).join('\n')
  );
}

// The published site is now built from this repo (`npm run docs` → docs/site), so the
// guide markdown this gate already measures *is* the site's content. The old
// informational metric — "attributes mentioned somewhere on the developer-docs site",
// which reached into a sibling checkout at ../../developer-docs — measured a target that
// no longer exists and was removed on 2026-07-31. Link integrity on the new site is
// gated by `npm run docs:check` instead.

let regressions = 0;
let closed = 0;

for (const kind of KINDS) {
  const frozen = new Set(baseline[kind.key] ?? []);
  const now = current[kind.key];
  const isNew = now.filter(x => !frozen.has(x));
  const fixed = [...frozen].filter(x => !now.includes(x));

  if (isNew.length) {
    regressions += isNew.length;
    console.log(`\nNEW GAP — ${kind.label}`);
    for (const x of isNew) console.log(`  ${x}`);
    console.log(`  fix: ${kind.fix}`);
  }
  if (fixed.length) {
    closed += fixed.length;
    console.log(`\nCLOSED (${fixed.length}) — ${kind.label}`);
    for (const x of fixed) console.log(`  ${x}`);
  }
}

if (closed && !UPDATE) {
  console.log(`\n${closed} gap(s) closed. Lock it in: npm run docs:coverage:update`);
}

// Outside the ratchet on purpose: these two are not "gaps to be documented later", they
// are the published URL surface breaking. A title is a filename, so two pages sharing
// one loses a page silently, and a sibling with a different prefix lands in the wrong
// part of the sidebar. Neither can be frozen away.
if (duplicateNavTitles.length) {
  console.error(`\nFAIL — ${duplicateNavTitles.length} duplicate nav title(s); each is two pages claiming one URL:`);
  for (const x of duplicateNavTitles) console.error(`  ${x}`);
  console.error('  fix: make every guide page title unique — see src/docs/content/nav.ts\n');
  process.exit(1);
}

if (absoluteLinks.length) {
  console.error(
    `\nFAIL — ${absoluteLinks.length} site-absolute link(s); the docs site has no absolute routes, ` +
      "and TypeDoc's own link check cannot see these:"
  );
  for (const x of absoluteLinks) console.error(`  ${x}`);
  console.error('  fix: use a relative path to the target .md, or {@link ExportedName}\n');
  process.exit(1);
}

if (navPrefixMismatches.length) {
  console.error(`\nFAIL — ${navPrefixMismatches.length} guide folder(s) whose pages disagree on their sidebar path:`);
  for (const x of navPrefixMismatches) console.error(`  ${x}`);
  console.error('  fix: every page in one guide/ folder shares the first three title segments\n');
  process.exit(1);
}

if (regressions) {
  console.error(
    `\nFAIL — ${regressions} new documentation gap(s). Document them, or freeze them with ` +
      'npm run docs:coverage:update if the gap is deliberate.\n'
  );
  process.exit(1);
}

console.log('\nOK — no new documentation gaps.\n');
