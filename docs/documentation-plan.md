# Documentation Plan — Campaign Cart SDK

> Status: **direction changed 2026-07-31.** Decisions: **typed TS feature manifests**
> as the single source of truth (unchanged, shipped); the **published output is now a
> versioned TypeDoc HTML site served from this repo** — the external `developer-docs`
> (Fumadocs) site is out of scope. Owner: Bond.
>
> **Read [§8](#8-direction-change-2026-07-31--the-typedoc-site-becomes-the-product)
> first.** §4, §5e and §5p describe the retired developer-docs target and are kept as
> history, not as work.

The goal is one readable answer per question. Today a reader looking up
`data-next-quantity` finds four different answers across four sections and
cannot tell which is current.

---

## 0. Start here in a new session

**Phases 0–7 are done** (content). Phase 6 (`src/core`) and Phase 7 (analytics) landed
2026-07-31 — see §5r. **Phases 8–12 (§8) are the new, open work:** the TypeDoc site,
its nav, versioning, and unhooking developer-docs. Which TypeDoc plugins to use — and
which of §8's own conclusions the plugin sweep corrected — is
[§8.1](#81-plugins--evaluated-2026-07-31).

Run these three to confirm the baseline before changing anything:

```bash
npm run type-check          # clean
npx vitest run              # 1532 pass, 209 skipped (59 files)
npm run docs:coverage       # 19 metrics at 100%, empty baseline
```

The content programme is done; what is left is the **output** (§8), the lint decision in
item 1 below, and the 79 code defects in [code-findings.md](./code-findings.md) — which
grew from 24 to 79 during Phase 6/7, including one that should be looked at this week
(finding 51: the Konami shortcut creates a real order on any production checkout).

To see the docs locally, once Phase 8 lands:

```bash
npm run docs         # build → docs/site  (8s, 882 pages)
npm run docs:serve   # typedoc --watch + static server on :3500
```

The old instructions (`cd ../../developer-docs && next dev`) no longer apply — that site
is not a target any more (§8).

### One decision blocking the rest

1. **Lint — measured properly on 2026-07-31, and the numbers point one way.**
   `npm run lint` (= `eslint src --ext .ts`) reports **13,621 problems: 12,412 errors +
   1,209 warnings**, of which **7,438 are auto-fixable**. CI runs `type-check`,
   `test:coverage`, `docs:coverage`, and `build` — **no lint step**, which is how it
   accumulated.

   | Bucket | Count |
   |---|---|
   | `prettier/prettier` — pure formatting, 100% auto-fixable | **7,343** (54%) |
   | `no-unsafe-*` cluster — one `any` root cause per file | **3,914** |
   | Policy warnings (`no-explicit-any` 1,015, `no-console` 194) | 1,209 |
   | **Genuinely needs a human decision** | **1,044** |

   The `no-unsafe-*` mass is **concentrated, not spread**: 124 of 329 files, with the top
   10 files holding 56% and the top 50 holding 90%. `src/core/analytics/**` supplies 8 of
   the 15 worst files; `conditional-display.enhancer.ts` and `checkout-form.enhancer.ts`
   supply another 861 non-prettier errors between them.

   What the numbers say about the three options:
   - **(a) auto-fix + reformat** clears 7,474 findings and rewrites **235 of 329 files**,
     leaving 6,142 — it does *not* reach zero, and it poisons `git blame` across ~72% of
     `src` in one commit.
   - **(b) drop the strict tier** (`.eslintrc.json:11`) removes 4,222 findings but **buys
     no speed** — `prefer-nullish-coalescing` and `prefer-optional-chain` come from the
     local `rules` block and are type-aware anyway, so the 19.6s parse stays. It also
     deletes `no-floating-promises`, `no-misused-promises`, and `no-base-to-string`, which
     is where the real defects in a 10-finding sample actually were. Worst trade of the
     three.
   - **(c) ratchet**, scoped per-`(file, rule)` → **1,074 pairs**, ~63 KB baseline. This
     is the only granularity that grandfathers the legacy files while still failing a
     *new* rule in an *old* file, and it is the exact shape
     [`docs-coverage.mjs`](../scripts/docs-coverage.mjs) already handles (string ids, frozen
     sets, `UPDATE_*_BASELINE=1` to re-freeze).

   **Recommendation: (a) for the formatting half as one isolated commit, then (c) for the
   rest, and add `npm run lint` to CI** — without the CI step a ratchet gates nothing.
   After (a), only 1,044 findings need human judgement at all.

   **What a repo-wide reformat actually breaks — measured, not guessed.** Verifying the
   `format` fix ran the formatter for real: **228 files, 14,774 insertions / 7,500
   deletions**. `type-check` stays clean, but **19 tests fail**, in two very different
   ways:

   - ~~**17 × `logs.md` drift.**~~ **Fixed 2026-07-31 (task G) — this constraint is
     gone.** The generated pages cited `file:line`, and reflowing shifted every number,
     so option (a) had to be *reformat + regenerate in one commit*. Generated pages now
     cite the **enclosing symbol** instead (`sdk-initializer.ts › SDKInitializer.initialize`),
     which no reformat can move. Re-measured after the change: **233 files reformatted,
     all 11 documentation suites still pass with nothing regenerated.** Option (a) is now
     a plain formatting commit. See §0a.
   - **2 × latent format-sensitivity in the checks themselves — now fixed.** The
     scanner-selector check harvested any line that was just a quoted `data-next-*`
     string, so Prettier moving `querySelectorAll('[data-next-show], [data-next-hide]')`'s
     argument onto its own line made it read as one unknown selector; it now splits on
     commas. And the analytics vocabulary's emit-site scan required quotes, so Prettier
     dropping unnecessary object-key quotes made `dl_search` and `dl_start_trial` look
     unreferenced and reported them as stale vocabulary; it now matches the bare
     identifier. **Both were bugs waiting for any reformat** — worth having found before
     a 228-file commit rather than during one.

   **Two bugs fixed while measuring this** (they were blocking any option):
   `npm run format` was `prettier --write src/**/*.ts` **unquoted**, so `sh` — which has no
   `globstar` — expanded it to `src/*/*.ts` and reached **28 of 329 files**; 228 files are
   unformatted, exactly matching eslint's `prettier/prettier` file count. And
   `.eslintrc.json` `ignorePatterns` omitted `coverage/`, `playground/`, `public/`,
   `utilities/`, and `vite.config.legacy.ts`, so `npx eslint .` died with **46 fatal parse
   errors** on files nobody intends to lint. Both fixed.
2. ~~**Retiring `data-attributes/`**~~ — **no longer this repo's decision (2026-07-31).**
   It lives in the `developer-docs` repo, which §8 takes out of scope. The 62 files are
   still on disk there and still document the removed profile system as if it worked, so
   if that site stays online someone should still run
   `cd developer-docs && git rm -r content/docs/campaigns/data-attributes`. Nothing in
   campaign-cart depends on it either way.

## 0a. Generated pages cite symbols, not lines (task G) — **DONE 2026-07-31**

**The rule: nothing generated may embed a source line number.** A line is not a property
of the code, it is a property of the code's *formatting*, so citing one couples every
generated page to whitespace. Adding a single blank line near the top of
`sdk-initializer.ts` rewrote 30 anchors in `core/guide/reference/logs.md` and failed two
drift tests — which is what made `npm run format` and the 12k-finding lint cleanup
unrunnable, and what blocked task C1.

Anchors are now `file › EnclosingSymbol`:

```
core/sdk-initializer.ts › SDKInitializer.initializeAnalytics
public/loader.js › moduleScript
```

One helper owns the format — [`src/docs/extract/source-anchor.ts`](../src/docs/extract/source-anchor.ts):
`anchorOf(sf, node, file)` resolves a node to its enclosing symbol, `anchor(file, symbol)`
composes from parts, and `fileOf(anchor)` parses the file back out. **Parse with `fileOf`,
never `split(':')`** — that idiom silently returned the whole anchor once the format
changed, and it existed in two places.

**Seven producers were converted.** They were not findable by grepping one pattern; each
had its own spelling, and the last two only surfaced when a full reformat was run against
the whole suite:

| Producer | What it cites |
|---|---|
| `extract-logs.ts` | every log message and literal `throw` (the bulk — 596 anchors) |
| `extract-core-contracts.ts` | meta tags and URL parameters — now cites the **file only**, since the `consumer` column already names the symbol |
| `extract-boot-sequence.ts` | boot steps, signals, events, retry policy |
| `extract-storage-keys.ts` | every storage key site |
| `extract-next-methods.ts` | `NextCommerce` members and `window.*` installs |
| `extract-analytics-events.ts` | each `dl_*` event's **Built at** |
| `coreLogs.test.ts` | hand-declared logs, resolved from their verbatim `anchor` text |

**Three dedupe keys had to widen to compensate.** A line is unique; a symbol is not, so
collapsing the anchor merges rows that used to be distinct. `Collector.add` in
`extract-core-contracts.ts` now keys on `(where, consumer, access)` — without `consumer`,
two methods in one file became one row and the page under-reported who reads a value.
`extract-analytics-events.ts` drops an exact `(file, symbol, how)` repeat, and sorts by
symbol rather than by position. **Anywhere else that keys on an anchor, check this.**

Verified end to end: 233 files reformatted → `type-check` clean, full suite
**1592 passed / 0 failed**, all 11 documentation suites green **with nothing
regenerated**, `docs:coverage` still 100% on 20 metrics.

**Still line-coupled, deliberately out of scope:** ~154 refs in *hand-written* prose
(`src/docs/content/core-subsystems.ts`, `storage-keys.ts`, `meta-tags.ts`, and the
`source:` fields in `analytics-events.ts`). These are literal strings that no extractor
regenerates, so they cannot fail a drift test — which is exactly the problem: **a reformat
makes them quietly wrong instead of loudly wrong.** Nothing gates them today. Logged in
[code-findings.md](./code-findings.md).

### The one unblocked task — **DONE 2026-07-31**

`e2e/fixtures/accept-upsell.html` + `e2e/accept-upsell.spec.ts` are written and the
5 tests pass. Every documentation metric is now at 100% with an empty baseline. See
§5o.

### `src/core` (Phase 6) and analytics (Phase 7) — **DONE 2026-07-31**

Core and analytics are now in the gate and at 100%. §5q is the plan that was written for
them; **§5r is what actually shipped, including the eight places §5q turned out to be
wrong.** Read §5r rather than §5q if you only read one.

### Build-time docs machinery moved out of `core/` (task E1) — **DONE 2026-07-31**

`src/core/docs/` was ~11,000 lines of generator/renderer/content code that runs only at
build time (via `src/tests/docs/*.test.ts` and `scripts/docs-coverage.mjs`), sitting
inside `core/`, which the `sdk-structure` skill §1 defines as the SDK's **runtime
engine**. It has moved to a new top-level layer, **`src/docs/`**, split by what each
piece is:

- `src/docs/schema/{feature-manifest,state-manifest}.ts` — the two type/builder modules
  every shipped `*.manifest.ts` and `*.state-manifest.ts` file imports (`defineFeature`,
  `defineStore`). Tree-shaken out of the production bundle (verified by
  [`src/tests/contract/bundle-contents.test.ts`](../src/tests/contract/bundle-contents.test.ts)),
  but the import happens from files that ship, so this is the one part with a real edge
  to the rest of `src/`.
- `src/docs/content/*.ts` — the hand-written declaration files (`core-logs.ts`,
  `analytics-events.ts`, `meta-tags.ts`, `storage-keys.ts`, `next-methods.ts`,
  `sdk-attributes.ts`, `url-parameters.ts`, `core-manifest.ts`, `core-subsystems.ts`,
  `nav.ts`) — prose and inventories, never imported by anything that ships.
- `src/docs/render/render-*.ts` — the markdown generators, moved unchanged.
- `src/docs/extract/extract-*.ts` — the AST extractors, moved here from
  `src/tests/docs/` (where they lived alongside the `*.test.ts` drift tests that call
  them) because one of them, `render-boot-sequence.ts`, imported an extractor from
  `@/tests/docs/`  — a production-layer-shaped file reaching into `src/tests/`. Moving
  both under `src/docs/` fixes the direction: `render/` now imports `extract/` as a
  sibling, and `src/tests/docs/*.test.ts` imports both from `@/docs/**` (the general
  `@/*` alias already covers it — no new tsconfig/vite alias was needed).

`src/tests/docs/` now holds only the eleven `*.test.ts` drift tests.

One consequence, not a regression: `src/core` was a TypeDoc entry point with
`entryPointStrategy: "expand"`, so every file directly under it — including
`core/docs/**` — got its own symbol page. That published ~163 pages of build-tooling
(`renderCoreLogs`, `defineFeature`, `CoreLogRow`, …) as if they were part of the SDK's
public "Core" reference. `src/docs/` is not in `typedoc.json`'s `entryPoints`, so those
pages no longer publish — `npm run docs` now produces 760 pages, not 882/923. That is a
correctness fix (build machinery was never meant to be contributor-facing API
reference), not a lost feature; every guide/state/feature/core-subsystem page some
prior baseline counted is still there.

One test broke as a **direct, intended consequence**, and was left broken rather than
patched: `featureReference.test.ts`'s `'sdk-attributes.md matches the declared list, and
each is still in core'` globbed `src/core/**/*.ts` to check that every SDK-level
attribute is read somewhere in core — but `sdk-attributes.ts` (which declares them) used
to live inside that same glob, so the check was checking its own declaration, always
true. With the file moved out, the check is real for the first time, and it found that
`data-next-page-type` is declared as SDK-level but is not read anywhere in `src/core` —
only mentioned in a TSDoc comment in `src/types/global.ts`. That is a pre-existing
documentation/behaviour gap this move exposed, not one it created; `featureReference.test.ts`
belongs to a different task and was left as-is per that task's own instruction.

### Not worth doing, and why

- **`object-attributes.md` for all 29 features.** The 8 that have one link to the TypeDoc
  interface and add a "which fields matter here" layer. That only makes sense for a
  feature that hands the author a data object; the other 21 would be filler.
- **`testing.md` for all 29.** Same reasoning — add it only where a feature has a real
  testing trap.
- **Folding the 5 remaining site doors into `guides/` as a "safe" step.** It is not safe:
  moving a page changes its URL, so it needs the same redirect decision as item 2.

### Bugs found while documenting

**79** entries in [code-findings.md](./code-findings.md), triaged with `file:line` — 24
before Phase 6, then 55 more from documenting core and analytics. The rate is the argument
for the exercise: nothing else in the toolchain was looking at this code.

The three to look at first, all newly verified:

- **finding 51** — the Konami shortcut is armed on every production page and creates a
  **real order**, resetting the shopper's cart on the way out.
- **finding 36** — the ESM bundle every customer page loads is **not minified**, despite
  the config saying terser.
- **finding 75** — analytics sends the shopper's email address in the clear; there is no
  hashing anywhere in `src/core`, contrary to a project note that said there was.

The original triage note follows.

24 open defects in [code-findings.md](./code-findings.md), triaged P1–P3 with `file:line`.
The five to look at first: Klarna reaching the API as `card_token` on the `OrderBuilder`
path, order creation implemented twice (the cause of that divergence),
`sdk.getCartData().cartLines` always empty, `removeCoupon` being case-sensitive while
`applyCoupon` is not, and — newest, §5o — a pre-selected upsell card leaving the accept
button permanently disabled.

---

## 1. Baseline (measured 2026-07-30 by `npm run docs:coverage`)

| Layer | Source of truth | Generated? | Coverage |
|---|---|---|---|
| Types / data shapes | TS source | yes — TypeDoc → `docs/api` → site `sdk-reference` | 36 pages, healthy |
| Feature narrative | `src/**/guide/*.md` | yes — `generate-feature-guides.mjs` | **11 of 30 features** (37%) have a `guide/` |
| **`data-next-*` attributes** | **none** | **no** — hand-written in 3+ places | **141 attributes; 94 (67%) in a feature guide, 113 (80%) mentioned anywhere on the site, 28 documented nowhere** |
| **Events** | `EventMap` (`src/types/global.ts`) | **no** — hand-written | **72 events; 0 (0%) carry a TSDoc description** |
| State / stores | store types | no | scattered across sections |
| **The engine (`src/core`)** | **none** | **no** | **not measured at all** — 75 files, ~29,900 lines, 3 READMEs (two of them carrying wrong claims). Added to the gate in Phase 6; see §5r |

That last row was added on 2026-07-31 and is the reason it is worth writing a baseline
down: core was missing from this table for the whole programme, so every review of "are we
done?" answered yes.

Live numbers come from `npm run docs:coverage`; the frozen gaps are in
[`scripts/docs-coverage.baseline.json`](../scripts/docs-coverage.baseline.json).

Duplication, concretely:

- `data-next-quantity` appears in **43 site pages**, 18 of them hand-written.
- **158 hand-written pages** under `content/docs/campaigns` (305 total incl. generated).
- Seven doors documenting overlapping facts: `data-attributes/` (62 files),
  `feature-guides/` (136, generated), `cart-system/`, `cart-summary/`,
  `bundle-selector/`, `package-toggle/`, `upsells/`, `javascript-api/`,
  `utilities/`.

The tooling is not the gap — TypeDoc + `typedoc-plugin-markdown` +
`typedoc-plugin-frontmatter` + Fumadocs are the right choices and already wired.
The gap is that the **HTML API**, which is how customers actually use the SDK,
has no machine-readable source of truth.

## 2. New libraries to add: none

Everything below uses what is already installed. **No longer true after §8.1** — the site
removed two dependencies (the markdown plugins) and added four: three TypeDoc plugins plus
`mermaid`, each replacing hand-written site code rather than adding a feature. The
[§8.1](#81-plugins--evaluated-2026-07-31) table is the authority on what is installed and
why.

- **TypeDoc** keeps owning types, methods, and data shapes — and after §8 it owns the
  whole site.
- ~~**Fumadocs** keeps rendering the site.~~ Superseded by §8: TypeDoc renders the site.
- The attribute/event generator follows the precedent already working in this
  repo — [`src/tests/utils/analyticsVocabulary.test.ts`](../src/tests/utils/analyticsVocabulary.test.ts)
  generates `events.manifest.json` from a typed const and **fails CI on drift**.
  Same shape here: a vitest-run generator (`UPDATE_DOCS=1 npm run docs:generate`)
  that writes markdown and asserts no drift. Type-checked, CI-gated, no new
  build step.
- ~~`next-validate-link` is already a devDependency in `developer-docs` and is not
  wired into CI. Wiring it is free.~~ Superseded by §8: link validation is TypeDoc's own
  (`validation.invalidLink` + `npm run docs:check`), so nothing external is needed.

## 3. Design — the feature manifest

Each feature declares its HTML contract in a `*.manifest.ts` beside its
enhancer. The manifest is plain data and must **not** import the enhancer, so
lazy-loading in `AttributeScanner` is unaffected.

```ts
// src/features/cart/quantity-control/quantity-control.manifest.ts
import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'quantity-control',
  category: 'cart',
  status: 'core',                                  // core | optional | deprecated
  summary: 'Steps a cart line up or down by one, or sets it to a value.',
  activates: '[data-next-quantity="increase"]',
  logPrefix: 'QuantityControl',
  attributes: [
    {
      name: 'data-next-quantity',
      type: "'increase' | 'decrease' | 'set'",
      required: true,
      description: 'Which direction the button moves the line quantity.',
    },
    {
      name: 'data-next-package-id',
      type: 'number',
      required: true,
      description: 'The cart line to change, by package ref_id.',
    },
    {
      name: 'data-next-max-quantity',
      type: 'number',
      default: '99',
      description: 'Upper bound. The button disables when the line reaches it.',
      notes: 'Ignored in `set` mode — the value wins.', // markdown escape hatch
    },
  ],
  emits: ['cart:quantity-changed'],   // typed `keyof EventMap` — a renamed event breaks the build
  conflicts: [{ feature: 'package-selector', mode: 'swap', because: 'double cart writes' }],
});
```

### What the manifest generates

| Output | Replaces | Path |
|---|---|---|
| `guide/reference/attributes.md` | hand-written, incomplete | per feature |
| `guide/reference/events.md` | hand-written | per feature |
| **Global attribute index** — all 141 in one door | `data-attributes/` (62 files) | site `reference/attributes` |
| **Feature catalog** — 30 entries, core vs optional | does not exist today | site `reference/features` |
| `AttributeScanner` selector list | hardcoded array at [`attribute-scanner.ts:56-85`](../src/core/attribute-scanner.ts#L56-L85) | generated |
| VS Code `html.customData` | does not exist | Phase 5 |

Generating the scanner registry from the manifests has a useful consequence: **a
feature without a manifest does not boot**, so documentation cannot fall behind
the code.

### What stays hand-written

`overview.md`, `use-cases.md`, `glossary.md`. Judgement cannot be generated and
should not be. Format stays as [`.claude/rules/guide.md`](../.claude/rules/guide.md).

This list shrank as the phases went on, and the reason is worth recording: `logs.md`,
`errors.md`, `relations.md`, and `get-started.md` all *looked* like narrative and were
not. Each turned out to be a rearrangement of facts already in the source or the
manifests — see §5h, §5i, §5k, §5l. What genuinely stays hand-written is only the part
that requires judgement about a product situation: what this is for, when to reach for
it, and what the domain words mean.

## 4. Target site structure (7 doors → 4) — **SUPERSEDED by §8 (2026-07-31)**

> This describes the IA of the retired `developer-docs` site. The target is now the
> TypeDoc site's own navigation, designed in §8 Phase 9. Kept as history.

```
campaigns/
  start/          install, loader, first cart page, configuration   [hand-written]
  guides/         cart, bundle-selector, checkout, upsells, analytics
                  (absorbs cart-system/, cart-summary/, package-toggle/,
                   upsells/, feature-guides/ narrative)             [hand-written]
  reference/                                                        [GENERATED]
    features/     the catalog — what the SDK can do
    attributes/   all 141 data-next-* attributes, one door
    events/       all 60 EventMap events
    javascript-api/  window.next / sdk.cart.* methods
    data-shapes/  TypeDoc types + state schemas
  recipes/        copy-paste patterns                               [hand-written]
```

Deleted: `data-attributes/`, and the per-feature tutorial doors fold into
`guides/`. **Redirects for every removed URL are mandatory** — those paths are
in customers' hands.

## 5. Phases

| # | Work | Acceptance | Est. |
|---|---|---|---|
| **0** | Coverage gate — **DONE 2026-07-30** | `npm run docs:coverage` in CI, ratchet frozen; link validation green (190 → 0 errors) and gating the docs build. See §5a | 0.5d |
| **1** | Pilot — **DONE 2026-07-30** | `defineFeature` + renderer + drift test, applied to `add-to-cart`, `package-selector`, `quantity-control`. No content lost, real content gained. See §5b | 1d |
| **2** | Events — **DONE 2026-07-30** | 73/73 `EventMap` entries documented, per-field. 16 dead events marked `@deprecated`; two delivery channels documented; one type hole closed. See §5c | 0.5d |
| **3** | Roll out — **DONE 2026-07-30** | **28/28 manifests, 28/28 `overview.md`**; reverse scanner check on; orphan check added. Site publishes 30 guides / 164 pages, up from 12 / 106. See §5d | 2–3d |
| **4** | Site IA — **SUPERSEDED by §8** (the site is no longer a target; nav work moved to §8 Phase 9) | Redirect map verified (40/40 URLs backed by a file, 40/40 files mapped, 26/26 destinations and 4/4 anchors resolve) and applied to `netlify.toml` **and** `public/_redirects`; 7 inbound links + 3 generator sources + 1 nav entry rewired; link validation 0 errors. **Not done:** the 62 files are still on disk — a recursive delete was refused by the permission layer, so it is one human command. See §5p | 1–2d |
| **5** | Extras — **DONE 2026-07-30** | VS Code `html.customData` generated from the manifests: **165 attributes** with hover docs, value completions, and doc links (§5f). Examples now come from the Playwright fixtures — **25 of 26** markup features publish a snippet a browser test runs (§5g). `logs.md` generated from the source's `logger.*` calls — **29 of 29** features, up from 11 (§5h). `errors.md` — **29 of 29**, up from 11, including `checkout-form`'s 27 (§5i). `relations.md` — **29 of 29**, up from 11, with conflicts and pairings derived in both directions (§5k). `get-started.md` — **29 of 29**, up from 11, assembled from the four generators above (§5l). `use-cases.md` + `glossary.md` — **29 of 29**, up from 11 and 13 (§5m) | 1d |
| **6** | `src/core` — **DONE 2026-07-31.** 11 subsystems in the gate, 10 generated reference pages, 11 hand-written overviews, 6 new metrics, 6 new drift test files. Both core READMEs corrected. See §5r | 2d |
| **7** | Analytics — **DONE 2026-07-31.** Event catalogue (35, from the already-gated `DL_EVENTS`) and provider matrix (5 adapters) generated and drift-checked; `core/analytics/README.md` rewritten — its provider list, two import paths, a `setDebugMode` call on an array, and a RudderStack claim were all wrong. See §5r | 1.5–2d |

## 5a. Phase 0 as shipped (2026-07-30)

**campaign-cart**

- [`scripts/docs-coverage.mjs`](../scripts/docs-coverage.mjs) — measures the three
  numbers in §1 and fails on any **new** gap. `EventMap` is read through the
  TypeScript AST rather than by regex, because the payload shapes are nested
  object types a line scan cannot bracket.
- [`scripts/docs-coverage.baseline.json`](../scripts/docs-coverage.baseline.json)
  — the ratchet: 138 known gaps frozen, so CI is green today and can only
  improve. Closed gaps are reported, not failed; `npm run docs:coverage:update`
  shrinks the baseline.
- Wired into `.github/workflows/build.yml` after the test step.

**developer-docs**

- Link validation went from **190 errors to 0**, and now gates `npm run build`.
  Most of the 190 were validator blind spots, not rotten content:
  - no `pathToUrl`, so every relative link reported "'baseUrl' option is missing"
    (~174 errors);
  - fragments were taken from the table of contents only, which misses TypeDoc's
    inline `<a id="…">` property anchors and silently drops headings after
    certain code fences. Anchors are now computed with `github-slugger` — the
    same slugifier the site renders with — unioned with inline anchors and the
    TOC.
- Two generator bugs fixed: `generate-feature-guides.mjs` rewrote
  `get-started.md` links to a route that does not exist (get-started is merged
  into `overview`), and the same merge left `state/campaign` linking into
  nowhere.
- 10 genuinely broken links fixed in hand-written pages (wrong fragment slugs,
  and index-page relative links like `./get-started` resolving one level too
  high).

Note: validation now **blocks the docs deploy** on a broken link. To make it
advisory instead, move `npm run validate-links` out of the `build` script into a
separate CI step.

## 5b. Phase 1 as shipped (2026-07-30)

Files: [`src/docs/schema/feature-manifest.ts`](../src/docs/schema/feature-manifest.ts)
(schema), [`render-feature-reference.ts`](../src/docs/render/render-feature-reference.ts)
(markdown), [`src/tests/docs/featureReference.test.ts`](../src/tests/docs/featureReference.test.ts)
(generate + drift), [`extract-event-docs.ts`](../src/tests/docs/extract-event-docs.ts)
(EventMap TSDoc → event docs). Regenerate with `npm run docs:reference`.

**Three design corrections to §3, made while building it:**

1. **Manifests are build-time only, and the scanner is not generated from them.**
   Importing a manifest into `AttributeScanner` would ship every description in
   the bundle that loads on customer landing pages. Instead a test asserts each
   manifest's `activates` selector appears in
   [`attribute-scanner.ts`](../src/core/attribute-scanner.ts). Same guarantee —
   a feature whose selector the scanner never queries fails CI — at zero bundle
   cost. Phase 3's "generate the registry" item is replaced by "turn on the
   reverse check": every scanner selector must have a manifest.
2. **The schema needed more than a flat attribute list.** The hand-written
   `package-selector` page is 399 lines with real structure, and a flat list
   would have flattened it. Added `group` (per-attribute headings), `sections`
   (free markdown, for contracts that are not one-attribute-per-row like the
   template resolution order and the display-path grammar), `readsElsewhere`
   (attributes read from *other* elements — the thing readers hunt for longest),
   and `notes` on written values.
3. **Events come from `EventMap` TSDoc, not from the manifest.** A manifest lists
   only *which* events a feature emits; the prose lives on `EventMap`, extracted
   through the TypeScript AST. A second file of event prose would have been a
   guaranteed drift. This pulled Phase 2's mechanism forward for the 5 events the
   pilots emit, so `events.md` generates with no loss of the existing prose.

**Drift checks now enforced** (in `npm run test`, so CI already gates them):
committed markdown matches the manifest; every documented attribute appears in
the feature's source; every declared `emits` appears as an emit site; `activates`
is registered in `AttributeScanner`; folder name matches `id`.

**Result — nothing lost, real content gained:**

| Feature | Before | After | Change |
|---|---|---|---|
| `quantity-control` | 74 lines | 119 | + the 6 attributes it *writes* (`data-quantity`, `data-in-cart`, `aria-disabled`, `data-original-content`, native `min`/`max`/`step`), 4 CSS classes, and the `{quantity}` / `{step}` template tokens — none of which were documented |
| `add-to-cart` | 89 | 139 | + `data-next-property-container`, `data-next-property`, `data-next-default-property`, `data-next-selection-mode` |
| `package-selector` | 398 | 327 | all 28 attribute names preserved (verified by set comparison); shorter because 8 enhancer-set attributes collapsed from heading-plus-table blocks into one dense table |

**A documentation bug the drift check surfaced:** the `add-to-cart` guide
documented `data-next-profile` → `ProfileManager.applyProfile(key)`. No
`ProfileManager` exists in `src` and `data-next-profile` is not in the scanner's
selector list. The generated `attributes.md` dropped it, but five hand-written guide
files still described it as live, as did the site page `campaigns/guides/profiles.md`.

**Answered 2026-07-31: the feature is gone for good** — removed in **v0.4.6
(2026-04-01)**, commit `f77c78e`, listed under *Removed* in
[CHANGELOG.md](../CHANGELOG.md) along with `ProfileSwitcherEnhancer`, `ProfileMapper`,
and `profileStore`. The changelog had the answer the whole time; nobody had looked.
The guide files and the two site pages were deleted on 2026-07-30, the dead activation
in `attribute-parser.ts` was removed (see
[code-findings.md](./code-findings.md)), and the last live-sounding profile pages go
with `data-attributes/` (§5p). The one thing to remember: **content that used
`data-next-show-if-profile` to hide itself is now visible**, since the attribute is
inert.

## 5c. Phase 2 as shipped (2026-07-30)

Event coverage went **0% → 100% (73/73)**, each with a summary, per-field
descriptions, and a JSON `@example` where the payload has fields. One source:
the TSDoc on [`EventMap`](../src/types/global.ts) feeds both the generated
`reference/events.md` and the TypeDoc SDK reference — which now renders per-field
rows and strikes through the deprecated names.

**16 events are declared but never emitted by this build.** They were
indistinguishable from live ones, so a handler wired to any of them silently never
fires. Each is now marked `@deprecated` naming the event to use instead:

| Dead event | Use instead |
|---|---|
| `campaign:loaded` | read `useCampaignStore.getState().data` |
| `config:updated` | read `useConfigStore.getState()` |
| `selector:action-completed` | `cart:item-added` / `cart:package-swapped` |
| `shipping:method-selected` | `shipping:method-changed` |
| `checkout:express-started` | `express-checkout:initialized` |
| `checkout:express-completed`, `express-checkout:completed` | `order:completed` |
| `checkout:express-failed`, `express-checkout:failed`, `express-checkout:error` | `payment:error` / `error:occurred` |
| `express-checkout:started` | — |
| `express-checkout:redirect-missing` | `order:redirect-missing` |
| `address:location-fields-shown` | `checkout:location-fields-shown` |
| `message:displayed` | — |
| `offer:selected`, `offer:applied` | offers are server-side; read discounts on `cart:updated` |

**`campaign:loaded` is worse than dead:** [`sdk-initializer.ts:639`](../src/core/sdk-initializer.ts#L639)
subscribes to it, and nothing emits it — so that handler never runs. Worth a look
independently of docs.

**The SDK has two event channels, and the docs never said so.** Most events go
through the EventBus (`next.on(…)`), but some are dispatched as DOM
`CustomEvent`s on `document`. `bundle:price-updated`, `selector:price-updated`,
and `toggle:price-updated` are **only** on the DOM channel — `next.on()` for them
never fires. `checkout:location-fields-shown` and
`checkout:billing-location-fields-shown` go out on both. Each now says which
channel to use.

**One type hole closed.** `scroll-hint:updated` was emitted with
`emit('scroll-hint:updated' as any, …)`, which bypassed `EventMap` entirely — so
it was undocumentable and unsubscribable in a type-safe way. It is now a real
`EventMap` entry and the cast is gone. That is why the event count is 73, not 72.

## 5d. Phase 3 progress

**Scope decision: the unit of work per feature is a manifest + an `overview.md`,
not a full 7-file guide set.** A manifest generates `reference/attributes.md` and
`reference/events.md`; the site's generator discovers any `guide/` folder, so a
manifest-only feature publishes with a Reference subsection but **no landing
page**. Adding `overview.md` — the highest-value hand-written file, and the one
the site merges `get-started` into — makes the section coherent. `use-cases`,
`relations`, and `glossary` stay a later, separate pass. Writing 7 files × 19
features before anything ships would delay every feature's reference for the sake
of files a reader reaches last.

**Done — cart category complete (10/10), display started (3/7 + shared core):**
`add-to-cart`, `package-selector`, `quantity-control`, `remove-item`,
`accept-upsell`, `package-toggle`, `coupon`, `cart-item-list`,
`bundle-selector`\*, `cart-summary`\*, plus `display-core`,
`conditional-display`, `timer`, `quantity-text`. (\* = inventory mode, below.)

**Display category complete too (8/8):** `display-core`, `product-display`,
`selection-display`, `order-display`, `shipping-display`, `conditional-display`,
`quantity-text`, `timer`.

**Order, ui, and behavior complete too:** `upsell`, `order-item-list`,
`accordion`, `tooltip`, `scroll-hint`, `fomo-popup`, `simple-exit-intent`.

**Checkout complete too:** `checkout-form`, `checkout-review`, `prospect-cart`,
`express-checkout-container`. **All 28 features now have a manifest.**

### The reverse check is on

Every selector `AttributeScanner` queries must now be claimed by a manifest.
Without it, only the forward direction was covered — a manifest naming a selector
that does not exist — so a new feature could be wired into the scanner and ship
with no documentation at all.

Turning it on immediately found that **a feature can have more than one activating
selector**, which the schema had assumed away: `conditional-display` answers
`data-next-hide` as well as `data-next-show`, `timer` scans its display and expired
elements independently, and `upsell` has two selector forms. `alsoActivates` now
carries those, and both directions of the check consider them — so a reader learns
that either attribute turns the feature on, rather than guessing that `hide` is a
modifier of `show`.

### Three activation kinds, not one

The schema started assuming every feature is turned on by one attribute. It is
now: `activates` (+ `alsoActivates`) for markup, `activatedByApi` for the two
JavaScript-started features, and — for `prospect-cart` — the selector of the
feature that starts it, since its options go on that same `<form>`. A test
requires exactly one primary kind, so no feature can claim no way of being
switched on.

### Every feature now has an overview

All 16 missing `overview.md` files were written, so every feature has the page a
newcomer reads first: what it is, the mental model, the domain rules, why it was
built that way, and what it does *not* do. The site went from **12 guides / 106
pages to 30 guides / 164 pages**.

### An orphaned guide folder was publishing a phantom feature

`src/features/cart/guide/` held a stale copy of `coupon`'s generated pages — written
there before flat features were routed to `features/cart/coupon/guide/`, and left
behind when the path was fixed. Because the site generator names a feature after its
guide folder's parent, that orphan published as a feature called **“features ›
cart”** with no overview. It was committed, so it would have shipped.

Removed, and a test now asserts every `guide/` folder matches a known manifest id —
verified by planting an orphan and watching it fail. The generator has no cleanup
step of its own, so without this check the next path change would leave the same kind
of debris.

### 13 attributes remain undocumented, and they cluster

`data-next-await`, `data-next-cart-item-id`, `data-next-hide-if-profile`,
`data-next-page-type`, `data-next-payment-form`, `data-next-payment-state`,
`data-next-profile-selector`, `data-next-sdk-loading`, `data-next-show-if-profile`,
`data-next-tracking-tag`, `data-next-upsell-section`, `data-next-validate`,
`data-next-variant-code`.

These are not feature attributes that were missed — they fall into two groups:

1. **Dead profile attributes** (`show-if-profile`, `hide-if-profile`,
   `profile-selector`) — the same removed feature Phase 1 found. They belong to no
   feature because the feature no longer exists.
2. **SDK-global attributes** (`page-type`, `tracking-tag`, `sdk-loading`, `await`,
   `validate`) — read by the initializer or analytics, not by any one feature, so
   no feature manifest is their rightful home.

Group 2 needs a home the current model does not provide: an SDK-level attribute
reference, alongside the feature manifests. That is the natural next piece of
Phase 4's `reference/` section rather than something to force into a feature.

### Two features are turned on from JavaScript, not from markup

`fomo-popup` and `simple-exit-intent` have no activating attribute at all — they
are started by `next.fomo({…})` and `next.exitIntent({…})`. The schema assumed
every feature had a scanner selector, so `FeatureManifest` now takes either
`activates` (an attribute) or `activatedByApi` (the `next.*` call), and a test
requires **exactly one**, so a feature can never claim no way of being switched
on. Their pages now open with the call rather than an attribute a reader would
hunt for and never find.

`simple-exit-intent` also got the thing its five events most needed spelling out:
`exit-intent:closed` fires alongside `dismissed` **and** after `action`, so
counting it as a rejection overstates dismissals.

Tracked by `npm run docs:coverage`, which now reports manifest coverage as a
fourth ratcheted metric.

### Two modes, because one size did not fit

`bundle-selector`'s reference is 850 lines of worked examples, slot grammar, and a
variant model; `cart-summary`'s carries a per-line condition grammar with `item.*`
and `discount.*` namespaces. Moving either into a TypeScript literal would make it
harder to edit and risk losing nuance, all to drift-check ~40 attribute names. So
`FeatureManifest.reference` now takes `'generated'` (default — the manifest owns
the prose) or `'hand-written'` (the manifest is the **inventory**; the page keeps
its prose). Under `hand-written` the drift test checks the inventory **both ways**
— against the source *and* against the page — so an attribute added to the code
cannot be missed by the docs. Under `generated` a separate test requires every
attribute to carry a description.

### What the inventory checks caught

- **`bundle-selector` was missing four attributes it reads**, now documented:
  `data-next-upsell-context` (without it a post-checkout bundle selector writes to
  the cart in swap mode — the wrong basket entirely), `data-next-property`,
  `data-next-default-property`, and `data-next-slot-index`.
- **The inverse, too:** `data-next-show` / `data-next-hide` appear only in
  `bundle-selector`'s *tests* — the behaviour belongs to `conditional-display`. The
  check rejected the claim, so they went to the right feature's inventory.
- **`cart-summary` was missing `data-next-item-properties`** — the per-line custom
  property list, including the trap that its `<template>` must be a *direct* child
  or nothing renders.
- **`cart-item-list` documented 7 attributes while the code reads 13.** The six it
  omitted are the ones inside the rendered row — exactly the surface an integrator
  customising a cart row touches.

### Display paths are generated from the routing table (160 of them)

`PROPERTY_MAPPINGS` in `display/display-types.ts` is the SDK's own routing table
for `data-next-display`, so it is the only honest answer to "what can I put in
this attribute?". `extract-display-paths.ts` reads it through the TypeScript AST
and the generator emits a **`reference/display-paths.md`** per namespace — 160
paths, each with the format it renders as by default.

Kept as its own page rather than a section inside `attributes.md`, so it works in
both modes: a hand-written page keeps its prose and still gets a complete,
always-current path inventory beside it.

**This closed the worst gap found so far.** The `cart.*` namespace — the most-used
in the SDK — had **3 of its 22 paths documented**. `subtotal`, `itemCount`,
`totalDiscount`, `hasCoupons`, `discountCode` and 14 more existed only in the
source. All 22 are now listed.

`display-paths` was added to the site generator's reference ordering so the page
appears in the nav.

### The display system is one attribute with eight namespaces

`data-next-display` dispatches to eight different display enhancers by the
namespace at the front of its value (`cart.`, `package.`, `selection.`, `order.`,
`shipping.`, `selector.`, `bundle.`, `toggle.`), and all of them accept the same
seven formatting modifiers (`data-next-format`, `data-hide-if-zero`,
`data-hide-if-false`, `data-hide-zero-cents`, `data-multiply-by`,
`data-divide-by`, plus the `data-format-debug` output). The docs had never said
this in one place.

`display/display-core.manifest.ts` now owns that shared contract — the modifiers
and a namespace routing table — and the per-namespace pages link to it instead of
repeating it eight times.

### The feature count was wrong: 30 → 28

`docs-coverage` counted every `*.enhancer.ts`, including two files that are not
features a reader can turn on:

- `display/cart-display.enhancer.ts` — a 6-line deprecated re-export shim; the
  real class lives in `cart/cart-summary/`
- `checkout/address-autocomplete/address-autocomplete.enhancer.ts` — a helper the
  checkout form constructs directly; `AttributeScanner` never activates it

Both would have been permanently-unreachable rows in the denominator. The script
now requires a class extending a `Base*Enhancer` and prints what it excluded, so
the exclusion is visible rather than silent.

**No content lost, more gained** (verified by comparing attribute-name sets
against `git HEAD`):

| Feature | Before | After | Gained |
|---|---|---|---|
| `remove-item` | 83 | 95 | the `{quantity}` token and the 6 state classes |
| `accept-upsell` | 67 | 102 | `data-next-upsell-action-for`, the meta-tag URL fallback |
| `package-toggle` | 362 | 394 | 8 undocumented attributes (`data-next-active`, `data-next-bump`, `data-next-exclude-property`, `data-next-in-cart`, `data-next-loading`, `data-next-toggle-container`, `data-next-upsell-item`, `data-next-bump-section`) — **and** its two near-identical 22-row field tables collapsed into one |
| `coupon` | 0 (no guide at all) | 105 + overview | its entire markup contract, which was undocumented |

**One generator change:** flat features — an enhancer sitting directly in its
category folder, like `cart/coupon.enhancer.ts` — now write their guide to
`<category>/<id>/guide/`, matching what `display/product-display/guide/` already
does. The attribute drift check narrows to files named after the feature for these,
so a sibling's attribute cannot satisfy it.

## 5e. Phase 4 stage 1 (2026-07-30) — the replacement, before any deletion

> **SUPERSEDED by §8 (2026-07-31)** for everything site-side: the redirect map, the
> `data-attributes/` deletion, and the all-attributes door all live in the retired
> `developer-docs` repo. The *content* this stage produced (the generated attribute
> index) ships in the TypeDoc site instead. Kept as history.

The plan gates deleting `data-attributes/` on the replacement being verifiably
richer. This stage built the replacement and ran the comparison. **Nothing has been
deleted.**

### The deletion gate: what the old door has that the new one does not

Ten attributes appear in `data-attributes/` but in no feature guide. Checking each
against the source with exact name boundaries:

| Attribute | Verdict |
|---|---|
| `data-loading-text` | **real** — set by `BaseActionEnhancer` |
| `data-next-toggle` | **real** — read in `core/base/dom-observer.ts` |
| `data-add`, `data-subtract`, `data-decimal-places`, `data-line-id`, `data-next-property-key`, `data-next-default-property-key`, `data-next-state`, `data-next-state-container` | **absent from the codebase entirely** |

So the old door's unique content is **eight documented attributes that do not
exist** plus two real ones. That is the strongest argument yet for the
consolidation — and the two real ones are cross-feature base-class attributes, the
same category as the five SDK-global orphans, confirming that an SDK-level attribute
reference is needed before deletion.

### All Attributes — the generated single door

`docs/attribute-index.md` is generated from every manifest: **252 attributes across
29 features**, grouped by category, each with whether it is required, its default,
and whether the SDK *sets* it rather than reads it. The site publishes it as
**Feature Guides › All Attributes** and links it from the section landing.

That preserves what `data-attributes/` was actually for — one place to see every
attribute — while making drift impossible.

### Two link bugs found and fixed

- **The generator resolved cross-links against the published layout**, which drops
  the `guide/` segment, so every link that walked up past it was off by one level.
  Links are authored against the repo (where they are read), so `rewriteLinks` now
  resolves against the **source** layout and then strips `guide/` from the result —
  one link, correct in the editor and on the site.
- **19 of my own cross-links were wrong in the repo too**: reference pages sit at
  `…/guide/reference/`, one level deeper than the overviews I had counted from. All
  fixed, and a test now resolves every guide-to-guide link on disk so the
  off-by-one cannot come back.

`display-core` also gained the overview it was missing — it was the one pseudo-feature
without one, which broke its links from the landing and the index.

**Site link validation is now 0 errors across all sections**, with 30 guides / 165
pages published.

### Stage 2 — the orphans found homes, and attribute coverage hit 99%

The 13 undocumented attributes were not one problem but three, which only became
clear by checking each against the source:

**Five were feature-owned all along** and are now on their features:
`data-next-upsell-section` → `package-toggle`, `data-next-variant-code` →
`bundle-selector`, `data-next-payment-form` and `data-next-payment-state` →
`checkout-form`, `data-next-cart-item-id` → `display-core`.

**Seven are genuinely SDK-level** — owned by the boot sequence, the shared action
base, attribution, or the DOM observer. They now live in
[`src/docs/content/sdk-attributes.ts`](../src/docs/content/sdk-attributes.ts), rendered to
`docs/sdk-attributes.md` and published as **Feature Guides › SDK-level Attributes**,
with a summary row in the index. A test asserts each is still read somewhere in
`src/core`, so one that leaves the codebase cannot keep its page.

Two of them are worth knowing about: `data-next-sdk-loading` is set on `<body>` and
is the intended hook for hiding un-enhanced markup during boot — previously
undocumented anywhere. And `data-next-toggle` is *not* the package-toggle activating
attribute (`data-next-package-toggle` is), which is an easy and silent mistake.

**One is a dead profile remnant**: `data-next-profile-selector`, the last
undocumented attribute in the SDK.

**Attribute coverage: 128 → 140 of 141 (99%).**

### A drift-check limitation this exposed

`checkout-form` delegates to `services/`, `managers/`, `processors/`, and
`validation/`; the display core resolves context in `display-context.ts`. Both are
flat features, so the source scope — files named after the feature — excluded that
code, and the check rejected attributes they genuinely read. `FeatureManifest` now
takes `extraSource`, an explicit list of folders or files a feature also owns.
Explicit rather than widened automatically, so a feature cannot quietly satisfy its
check with a sibling's code.

### Stage 3 — the redirect map, and the last two gaps it exposed

[`docs/redirect-map.md`](./redirect-map.md) maps all **40 retiring routes** to where
their content actually went, as `netlify.toml` 301 blocks matching the existing
`/api/admin` and `/apps` entries. **Proposed, not applied.** Every destination and
every anchor it relies on is verified to resolve.

Writing the map is what found the last two gaps — mapping a URL forces the question
"where did this content go?", and twice the answer was "nowhere":

- **URL parameters had no home.** `param.<name>` is a **conditional-display
  namespace** — `data-next-show="param.mode == 'advanced'"` — and it appeared nowhere
  in the new structure. It is how a link drives page content, so losing it would have
  been a real regression, not a tidy-up. Now documented on conditional-display,
  including that parameters are only readable after `sdk:url-parameters-processed`
  fires.
- **CSS classes had no home.** The manifests carried the data; the index was not
  rendering it. Now generated — **41 classes against the old door's 20** — plus three
  that belonged to no feature: `next-display-ready` (SDK boot, on `<html>`),
  `next-loaded` (order-display), and `next-error` / `next-error-field`
  (checkout-form).

### Still required before deleting `data-attributes/`

1. ~~A home for the cross-feature attributes~~ — **done.**
2. ~~A redirect map~~ — **applied 2026-07-31 to both redirect files (§5p).**
3. ~~A decision on the profiles remnants~~ — **answered: the feature was removed in
   v0.4.6 (2026-04-01), commit `f77c78e`, and the `CHANGELOG` says so.** The question
   was open only because nobody had checked the changelog. `src/` has no
   `ProfileManager`, no `registerProfile`, no `profileStore`, no `profile:*` event, and
   no profile attribute in the scanner. The remaining live-sounding profile
   documentation is entirely inside `data-attributes/`, so it goes with the deletion.

## 5f. Phase 5 (2026-07-30) — the manifests become a tool

[`render-html-custom-data.ts`](../src/docs/render/render-html-custom-data.ts) generates
VS Code HTML custom data from the same manifests that generate the docs, so an
integrator writing a campaign page gets completion and hover documentation for
**165 attributes** — with defaults, valid values, and a link to the feature's page.
IntelliSense and the reference cannot disagree, because they have one source.

Wiring: `docs/html-custom-data.json` is generated and drift-checked;
`.vscode/settings.json` points at it so this repo has it immediately; the build
copies it into `dist/` and `package.json#files` ships it, so a campaign repo can use
`./node_modules/@NextCommerce/campaign-cart/dist/html-custom-data.json`. The setup
snippet is at the top of **All Attributes**, where someone looking up an attribute
will see it.

### Shared attributes needed real handling

**55 of the 165 attributes are used by more than one feature**, and the first
implementation showed whichever feature sorted first alphabetically — so hovering
`data-next-package-id` gave you *accept-upsell's* upsell-specific prose across nine
features. Worse than unhelpful.

They now list every reading, which surfaced something the docs had never stated
plainly: **`data-next-quantity` means nine different things, and one of them changes
its type.** It is a `number` for add-to-cart, package-selector, package-toggle, and
upsell — but a **mode** (`increase` / `decrease` / `set`) for quantity-control and
cart-item-list. That overload is worth a look on its own terms; a reader who assumes
it is always a quantity will write `data-next-quantity="3"` on a control and get
nothing.

### Operational note

`generate-feature-guides` deletes and rewrites 165 files, which triggers a rebuild
storm that can kill a running `next dev`. Regenerate **before** starting the dev
server, not while it is watching.

## 5g. Phase 5 (2026-07-30) — examples a browser runs

A markup snippet is prose as far as the toolchain is concerned. Nothing runs it, so
an attribute can be renamed in the code and the example keeps showing the old
spelling forever — which is exactly how the retired `data-attributes/` door came to
document eight attributes that never existed.

The e2e fixtures do not have that problem: Playwright boots the real SDK against them
on every `npm run test:e2e`, so markup that stops working fails a test. Each fixture
now marks the part worth publishing:

```html
<!-- docs:example A button that adds one fixed package -->
<button data-next-action="add-to-cart" data-next-package-id="1">Add to cart</button>
<!-- /docs:example -->
```

and `reference/tested-example.md` is generated from it — **25 of 26** markup features.
The two `activatedByApi` features (`fomo-popup`, `simple-exit-intent`) have no markup
to show and are excluded from the metric rather than counted as gaps.

Design notes worth keeping:

- **Markers, not whole fixtures.** Three fixtures end with an inline
  `<script type="module">` that buffers `*:initialized` events before boot. Publishing
  a whole fixture would present that test scaffolding as recommended markup.
- **Published byte-for-byte.** Nothing is trimmed, because a trimmed snippet is no
  longer the markup the test runs. The `id`s the specs select on come along with it,
  so the generated page states plainly that they carry no meaning for the SDK.
- **Fixture comments are now docs.** Three read as test jargon ("`order.number` display
  gates readiness (order in store → `canAddUpsells`)") and were rewritten to say the
  product-level thing instead. The fixtures got clearer too.
- **`data-testid` → `id`.** The cart-summary fixture was the only one using
  `data-testid`; publishing it would teach a reader that the attribute matters. Changed
  in the fixture and its spec rather than adding a lint exception.

### What the new checks found

A **snippet lint** now asserts every `data-*` attribute in every guide snippet is one
some manifest declares. It found four that were real but missing from a manifest
inventory — documented on the site, yet absent from IntelliSense, since the editor data
is generated from the manifests:

- `data-next-bundle-qty-for`, `data-next-bundle-slots-for` — bundle-selector's external
  containers
- `data-next-discounts` — shared by bundle-selector, package-toggle, and cart-summary
- `data-next-enhancer` — checkout-review's own activation attribute

`data-next-discounts` also exposed a limit in the drift checks: it is rendered by
`src/core/rendering/discount-renderer.ts`, not by any of the three features' own files,
so "documented but never read" fired for all three. `extraSource` now accepts a
`src/`-prefixed path, which is how a feature claims shared code — narrow enough that a
shared attribute still cannot pass the check for a feature that does not render it.

### An e2e gap, not a docs gap — closed 2026-07-31

`accept-upsell` had **no e2e coverage at all** — no fixture, and no spec referenced
`[data-next-action="accept-upsell"]`. It was frozen in the baseline as the single
`featuresWithoutTestedExample` entry. Closed in §5o: the gap was test work, not
documentation work, which is why it outlived every other gap.

## 5h. Phase 5 (2026-07-30) — logs, read from the code

18 of 29 features had no `reference/logs.md` at all, and the 11 that did covered
**85 of 384** messages — 22%. Transcribing log strings by hand does not scale, and a
paraphrased message is useless: someone pasting a console line into a search box needs
the exact wording.

`reference/logs.md` is now generated from each feature's own `logger.*` calls
(`src/tests/docs/extract-logs.ts`, TypeScript AST), giving the exact string, the level,
`file:line`, and whether the call passes a context object. Template literals keep their
interpolations as `{name}`, so a message with an id baked into it is still greppable up
to the placeholder. **All 29 features** have a logs page; the coverage gate now guards
that.

### The 11 hand-written pages were kept

Their When / Meaning / Action prose says what to *do* about a message, which no
generator can derive — that is the most valuable part of a logs page. So `logs` joins
`reference` as a per-feature ownership flag: those 11 set `logs: 'hand-written'` and
are instead checked for **coverage of every `error` and `warn`**. Those are the lines a
reader looks up after something broke; a `debug` line is read in the context of the
ones around it.

That check found **20 undocumented error/warn messages** across 7 features, now
written up. Several were worth the words — `Failed to set shipping method` leaves the
visitor with the right items at the wrong shipping price, and `handleUpsellCardClick
failed` needs the order checked before a retry, because a blind second click can add
the line twice.

### A leftover debug statement shipping at warn level

`product-display.enhancer.ts:385` logged
`[PERCENTAGE DEBUG] ProductDisplayEnhancer returning unitSavingsPercentage:` at **warn**,
on every read of `unitSavingsPercentage` — a common display path. Every campaign page
showing a savings percentage was printing a warning per element per update to
production consoles. Dropped to `debug` (kept, not deleted: it is still useful under
`?debug=true`).

Nothing else was going to catch that. It took *counting* the log messages to make it
visible, which is the argument for generating this page rather than writing it.

## 5i. Phase 5 (2026-07-30) — errors, with the judgement written down

`reference/errors.md` existed for 11 of 29 features. The gap that mattered:
**`checkout-form` throws 27 errors and had no errors page at all** — the checkout,
where a failure costs an order.

Errors could not be generated the way logs were. `.claude/rules/guide.md` forbids
documenting an error without saying whether it is recoverable or fatal, and no
generator can decide that. So the split is:

- the **manifest** carries the judgement — `kind`, `cause`, `fix` (`ErrorDoc`)
- the **source** decides what exists — two drift checks, in both directions: every
  literal `throw` must be declared, and every declared error must still be thrown
  (`fromApi: true` exempts a message the API raises and the feature passes through)

`pages: { logs, errors }` replaces the flat `logs` flag as the per-page ownership
switch, so the 11 hand-written pages keep their prose and are checked for coverage
instead of being overwritten.

That found **19 undocumented throws**, all now written up. All 29 features have an
errors page; a feature that throws nothing says so, which is the answer someone
checking "can this fail?" came for — better than finding no page and not knowing
whether that means safe or undocumented.

### The checkout errors were worth the words

Several are dangerous in a way the message does not convey, and the fixes say so:

- **`Invalid order response: missing ref_id`** — the order may well have been
  created. Check the API before telling the visitor it failed, or they are charged
  for an order the page abandoned. Same caution on the 5xx path.
- **`Failed to add upsell - no updated order returned`** — the visitor is still
  forwarded if a next URL is set, so this passes unnoticed in production. Watch
  `upsell:error` in analytics rather than waiting for a report.
- **`Failed to add bundle upsell — no order returned`** — a bundle sends several
  lines, so the order can hold *part* of one. Retrying duplicates whatever landed.
- **`Too many requests`** — repeated bursts usually mean the pay button is not
  disabled while a submit is in flight, letting one visitor send several orders.

## 5k. Phase 5 (2026-07-30) — relations, derived both ways

`relations.md` answers "why does this behave differently when X is also on the page",
and 18 of 29 features had no answer. It is generated from the manifests now — all 29.

The structural change is that **links are derived in both directions**. Only one side
declares a conflict or a pairing; the generator finds the reverse by scanning every
other manifest. Before this, a conflict declared by one feature appeared only on that
feature's page.

Two new fields carry the content — `dependsOn` (features that must be present) and
`pairsWith` (combinations, with the trap in `caution`) — plus `requires` for stores and
packages. A check asserts every id in `dependsOn` / `pairsWith` / `conflicts` is a real
manifest id: a typo there does not just break a link, it silently drops the reverse
link from the other feature's page.

### The generated pages exposed wrong data in the manifests

**Two "conflicts" were the recommended pairing.** `quantity-control` and `remove-item`
each declared a conflict with `cart-item-list` — while their own hand-written pages
correctly call it the standard cart-row pairing. The manifests were describing the
`innerHTML` re-render caveat, which is a caution about wiring your own listeners, not a
reason to avoid the combination. Publishing that as a conflict would have given readers
the opposite of the advice they need. Both moved to `pairsWith` with the caveat as
`caution`.

**Five real conflicts existed only in prose.** `bundle-selector`'s page documented
conflicts with `package-selector`, `package-toggle`, and `coupon`; `package-selector`
with `package-toggle`; `upsell` with `accept-upsell`. None were in a manifest, so
`coupon`'s page said "no conflicts" while `bundle-selector`'s page explained how the two
break each other. Declared now, so both sides show it.

### The 11 hand-written pages were kept

An earlier read of this was wrong: those pages are good, and `cart-item-list`'s does
cover the re-render trap in its Conflicts section. They stay hand-written
(`pages: { relations: 'hand-written' }`), with a check that every feature the manifest
links to is named on the page — matched against both the id and the `PascalCase` class
name, since the older pages use the class names. Migrating them into manifest fields
would lose prose for no reader gain.

## 5l. Phase 5 (2026-07-30) — get-started, assembled from what is already known

`get-started.md` existed for 11 of 29 features. It looks like the most hand-written
page of the set, and it is very nearly the least: every part of it is already recorded
somewhere.

| Section | Comes from |
|---|---|
| Prerequisites | `dependsOn` and `requires`, plus the API-key meta tag |
| Turn it on | the activating selector and the `required` attributes |
| The markup | the fixture snippet Playwright runs (§5g) |
| Check it worked | the feature's own init log (§5h), its first event, its first CSS class |
| Next steps | links to the pages generated in §5h, §5i, §5k |

All 29 features have one now. Nothing new had to be written for the 18 that were
missing — this page is the payoff for the four generators before it.

On the site these do not appear as separate pages: `generate-feature-guides` splices
get-started into the feature's overview and drops its "Next steps", which is the
simple-usage-first ordering `.claude/rules/documentation.md` §3 asks for. Page count
stays at 244 while every overview gets a working setup walkthrough.

### Two fixes the generated output made obvious

- **The activation line read as something to copy.** It said "activates on
  `[data-next-coupon=""]`" — a scanner selector, not markup. It now leads with the
  attribute name and keeps the selector as the technical detail behind it.
- **Spliced descriptions read as typos.** "It sets `next-disabled` on the element — On
  the apply button while…" — descriptions are written to stand alone, so the capital
  has to go when one is spliced mid-sentence.

### `activatedByApi` needed a real call

`fomo-popup` and `simple-exit-intent` have no markup, so their get-started could only
say "call `next.fomo({ … })`" — the `…` placeholder the guide rules forbid. Both
manifests now carry an `apiExample` with a real, commented call, and a check enforces
that any `activatedByApi` feature has one and that it contains no ellipsis.

## 5m. Phase 5 (2026-07-30) — use-cases and glossary, and what four readers found

`use-cases.md` and `glossary.md` were the last two pages, and the only ones with
nothing in the code to generate them from: recognising which feature fits a product
situation is judgement. 18 features were missing both. Four agents wrote them in
parallel, each told to ground every attribute, event, and error in the manifest or
source and to leave out anything it could not verify. **All 29 features now have
both.**

The instruction to leave unverifiable claims out is what made this worth doing in
parallel — each agent read one category closely and came back with defects, not just
prose.

### Manifest defects the writing exposed

Each was verified against the source before changing anything:

- **`quantity-text` documented a token that does not work.** The manifest and its
  generated example used `{quantity}`; the code matches `/\{qty([*+\-]?\d*)\}/`
  (`quantity-text.enhancer.ts:124`), so `{quantity}` reached the visitor as literal
  text. Fixed, and the three real token forms — `{qty}`, arithmetic `{qty*3}`, and
  `{singular|plural}` — are now documented in a **Tokens** section.
- **`accordion`'s labels were inverted.** `data-open-text` defaults to `Hide` and is
  written when the panel **opens**; the manifest called it "the label shown while the
  section is collapsed", and its example had the two values the wrong way round.
- **`data-next-checkout-step`'s value is a URL, not a step name.**
  `this.nextStepUrl = stepAttr` — so `data-next-checkout-step="shipping"` navigates to
  `/shipping`, usually a 404. Now documented as a URL, with that trap in `notes`.
- **`data-next-payment-method` was undeclared.** The card and PayPal reveal only works
  when `[data-next-payment-form]` is nested inside it, and it was in no manifest.

### Two coupon bugs, verified and reported

- **The first `<button>` in the container wins.** `coupon.enhancer.ts:32` runs
  `querySelector('button')` **before** the `[data-next-coupon="apply"]` fallback, so an
  earlier unrelated button — a "Continue" — becomes the apply trigger and gets
  `preventDefault()`.
- **`removeCoupon` is case-sensitive while `applyCoupon` is not.** Apply stores
  `code.toUpperCase().trim()` (`apply-coupon.ts:9`); remove filters `v !== code` with no
  normalisation (`checkout.state.ts:154`). So `next.applyCoupon('save10')` then
  `next.removeCoupon('save10')` removes nothing, silently.

Both are code fixes on a live payment path, so they are reported, not changed.

### A false 100% in the coverage gate

The attribute metric counted an attribute as documented if it appeared in **any**
markdown under `features/` — which a folder `README.md` satisfies. `data-next-payment-method`
was mentioned in `checkout/README.md` and in no manifest, so it was missing from the
attribute index *and* from the editor data while coverage read 100%.

A second, stricter metric now measures **declared in a manifest**, which is what the
index and the VS Code data are actually generated from. It immediately found four more:
`data-next-class-` (a rename prefix in bundle-selector), `data-next-next-url` (a legacy
upsell spelling), `data-next-variant-option`, and `data-next-package` — an undocumented
alias for `data-next-package-id` accepted by both the scanner and the display context
resolver. All four are declared now.

Fixing that also exposed a **circular denominator**: `scanAttributes()` walked every
`.ts` under `src`, including the manifests — so declaring an attribute added it to the
set of attributes needing declaration. Manifests are documentation, not code; they are
excluded from the scan now.

### A test that was dictating content

The first version of the effort-signal check demanded a `> Effort:` line on every `##`
heading in a use-cases file. That is not a format rule, it is a bug: it made one agent
delete its `## Related` footers to get the file to pass. Non-scenario headings — `When
NOT to use this`, `Next steps`, `Related`, `See also` — are exempt now.

### Contradictions left for the source to settle

- **`express-checkout:started` / `completed` / `failed` / `error`** are emitted by
  `processors/express-checkout-processor.ts`, yet `types/global.ts` marks all four
  `@deprecated — never emitted by this build`. The docs point readers at
  `order:completed` / `payment:error` and take no side. **This needs resolving in code.**
- **`accordion`'s `aria-controls` never resolves** — the trigger gets
  `aria-controls="<id>"` while the panel is given `id="<id>-content"`. Real, but there is
  no fix a page author can apply, so no caution was written that a reader cannot act on.
- **`abandonCart()`, `createCartManually()`, `reset()`** are public but have no callers
  and no route through `next.*`, so they are not documented as usable.

## 5n. Phase 5 (2026-07-31) — state, the last undocumented layer

Features reached 100% while **state sat at one of seven stores**. All seven now have a
generated `reference/state-reference.md` and a hand-written `guide/overview.md`, and the
coverage gate tracks both.

The split follows what the earlier phases established: the machine-readable half is
generated from a `*.state-manifest.ts`, and the judgement half is written. Field **types
come from the interface**, never the manifest, so the published table cannot disagree
with the code about a type. Drift is checked in both directions — a field added to a
store must be documented, a field removed must leave the docs.

The schema table carries a **Survives** column (`persisted` / `computed` / `transient`),
which is the distinction the type hides: `items` and `isCalculating` look identical on
`CartState`, and only one comes back after a refresh.

### The persistence claim in CLAUDE.md was wrong

It said cart *and campaign* use `persist`. Campaign does not — it writes sessionStorage
by hand under `next-campaign-cache_{currency}` with a **10-minute** expiry, while cart,
checkout, order, attribution, and parameter use Zustand `persist`, and config has none.
Corrected, and now enforced by a test that compares the claimed mechanism against the
store's own source. That check exists because I nearly generated the wrong fact onto
seven pages.

### Three defects in my own machinery, found by using it

- **The extractor did not follow `extends`.** `AttributionState extends Attribution`, so
  the whole inherited half — every `utm_*` tag, `affiliate`, `gclid`, five sub-affiliate
  slots — was invisible. That is most of what the store is *for*. Attribution went from
  3 documented fields to 17.
- **The persistence check conflated two files.** It looked for `persist(` in the file
  declaring the interface, but `CartState` lives in `types/global.ts` while `persist()`
  is in `cart.state.ts`. Added `storeFile`; keys are also looked up in `core/storage.ts`,
  where they are constants.
- **A `none` mechanism printed an absolute claim that was false.** "Nothing here survives
  a reload" is wrong for config: `selectedCurrency` comes back, mirrored to sessionStorage
  by other code. Reworded so the per-field column is the authority.

Two rendering bugs came from reading the output rather than the code: a union type
(`Order | null`) ended the markdown table cell early, and a `//` comment inside an inline
object type swallowed the rest of the type once newlines collapsed.

### Two site-generator assumptions that no longer held

Adding a second kind of guide broke two things that were true when features were the only
kind:

- The landing page linked every guide to `overview`. Store guides had none at first, so
  it now links to the first page a guide actually has.
- `rewriteLinks` stripped only `guide/` from a source path. A feature publishes at
  `{category}/{feature}` — without its `features/` segment — while a store keeps `state/`,
  so a link written from a store guide to a feature resolved one segment too deep. It now
  drops a leading `features/` as well.

### Four factual errors corrected in the existing campaign overview

The one store that already had a guide had drifted: the cache key was given as
`next_campaign_USD` (real: `next-campaign-cache_USD`), a cart field was called
`lastCurrency` (it is `currency`), `getCacheInfo` was said to read `get().data?.currency`
(it reads `get().currency ?? 'USD'`), and a slice was named `campaignSlice.variants.ts`
(now `variants.slice.ts`).

## 5o. Phase 5 (2026-07-31) — the last gap was a missing test, and it hid a bug

`accept-upsell` was the only feature whose published example nothing ran, because it
had **no e2e coverage at all**: no fixture, and no spec anywhere referenced
`[data-next-action="accept-upsell"]` — the button that takes money on a
post-purchase page.

`e2e/fixtures/accept-upsell.html` + `e2e/accept-upsell.spec.ts` close it. **5 tests,
green on chromium and Pixel 5** (`npx playwright test e2e/accept-upsell.spec.ts
--project=chromium`). Firefox and WebKit were not run — their binaries are not
downloaded in this environment (`npx playwright install` fetches them). What the tests
pin down:

| Test | What it protects |
|---|---|
| enable state | the button enables once the order is loaded, and a button with nothing to accept carries `disabled` + `next-disabled` |
| accept | `data-next-quantity="2"` reaches the API as the line quantity, and `upsell:accepted` carries the value **and discount read off the new `is_upsell` line** |
| duplicate | the "Already Added!" confirmation, including that **"Skip to Next" is the decline** and "Yes, Add Again" really does add a second copy |
| selector-driven | the Option B markup `get-started.md` recommends submits whichever card the visitor picked |
| `data-next-url` | the visitor is forwarded with `ref_id` preserved |

`TEST_ORDER_WITH_UPSELL` was added to `e2e/fixtures/order.ts` because the shared
`stubOrder` echoes the *unchanged* order: the SDK works out what an upsell was worth
from the **new** `is_upsell` line, so a naive stub reports a value of 0 and an
assertion on it proves nothing. Its added line is priced identically incl and excl tax
so the assertion does not depend on which tax basis the store resolves.

Only the direct-package button is published as the tested example. The
selector-driven form and the redirect button stay fixture-only — §5g's rule: mark the
part worth showing, do not dump a fixture.

### A flaky assertion was the bug reporting itself

The first version of the enable-state test asserted the *selector-linked* button starts
disabled. It passed, then failed on a later run with the button `enabled` and
`class=""` — same markup, same stubs. Chasing that is what produced
[code-findings.md](./code-findings.md) finding **24**:

- a `PackageSelectorEnhancer` in upsell context **always pre-selects** a card as it
  boots and announces it with `selector:item-selected`;
- `findSelectorElement()` queries `[data-next-upsell-selector]`,
  `[data-next-upsell-select]`, and `[data-next-upsell]` — never
  `[data-next-package-selector]`, the container the feature's own get-started
  recommends — so the 100 ms read whose job is to catch that pre-selection always
  misses, and logs `Selector "<id>" not found` **as a warn on a correct page**;
- the button therefore only knows the selection if it subscribed before the selector
  emitted, which is an init-order race. Failing side: a card that looks chosen next to
  an accept button that does nothing.

Three guide pages said the opposite (the mechanism in `overview.md`, the log's
Meaning/Action, and get-started's Option B, which leaned on pre-selection). All
corrected, and the manifest note on `data-next-selector-id` now carries the trap so the
generated `attributes.md` does too. The code fix is one selector added to that query;
it is in the findings list, not done here.

The spec now asserts the disabled state on a button with **no** package and no selector
— deterministic — and says in its header why the selector-linked button's boot state is
not asserted. A flaky test would have hidden this; deleting the assertion without
reading why it flaked would have too.

Nothing else in the documentation set moved: every metric is now 100% with an **empty
baseline** — `featuresWithoutTestedExample` was its last entry.

## 5p. Phase 4 (2026-07-31) — the redirects are live; the delete is one command

> **SUPERSEDED by §8 (2026-07-31), one day later.** Every artifact below —
> `netlify.toml`, `public/_redirects`, the nav entry, `validate-links` — belongs to the
> `developer-docs` repo, which is no longer a target. The redirects stay live there and
> harm nothing; no further work is planned on them. Kept as history, and as the record of
> what the retired door contained.

The plan gated deleting `data-attributes/` on the map being reviewed. It was reviewed
by re-deriving it from disk rather than reading it, and it held up: **40 of 40 rows
back a real file, 40 of 40 URL-serving files are mapped** (the other 22 of the 62 files
are `meta.json`, which serve no URL), **26 of 26 destinations resolve, 4 of 4 anchors
resolve.** No live URL will 404. Nothing in the map needed changing.

Three things the review found that the map itself had wrong or missing:

- **There are two redirect files, and the map named one.** The site deploys to Netlify
  *and* to Cloudflare Workers static assets, which reads `public/_redirects`;
  `next.config.mjs` is `output: 'export'`, so a Next `redirects()` would do nothing.
  Applying only `netlify.toml` would have left all 40 URLs 404-ing on the Cloudflare
  deploy. Both files now carry the 42 rules, verified equivalent by comparing parsed
  `from → to → status` sets (69 rules each).
- **A wildcard would have been wrong.** The existing `:path` placeholder matches one
  segment, so `…/data-attributes/:path` misses `…/actions/reference/attributes`. The
  40 explicit rules are the point, not verbosity.
- **The deletion would have broken the build, not just some links.** `npm run build`
  runs `validate-links` *before* `next build`, and it fails on broken markdown links
  and broken JSX `href=` props. 7 hand-written pages linked into the section, and **3
  of the links lived in generator sources in this repo** — fixing the published copies
  would have been overwritten on the next build. All 11 are rewired (the details are
  in [redirect-map.md](./redirect-map.md)), the nav entry is gone from
  `campaigns/meta.json`, and `validate-links` reports **0 errors** with the guides and
  the SDK reference regenerated.

**Not done: the 62 files are still on disk.** A recursive delete was refused by the
permission layer, so it is one human command:

```bash
cd developer-docs && git rm -r content/docs/campaigns/data-attributes
```

All 62 are tracked, so it is recoverable.

### The site could not build at all, for an unrelated reason

Verifying the rewiring with a real `npm run build` (not just `validate-links`) found the
docs site **failing to build before any of this work**: `components/api-page.tsx` reads
`slots.parameters`, and `fumadocs-openapi@10.3.17` misspells that slot as `paremeters`
in its own type (`dist/ui/base.d.ts:102`), so `next build` died on a type error while
`validate-links` — which runs first — reported success. Fixed by matching the upstream
spelling at both call sites, with a comment to flip it back if fumadocs corrects it.
**Build now completes: 1,189 static pages.**

Worth noting as a process lesson: this plan repeatedly leaned on "link validation gates
the build" (§5a). It does — but the gate passing says nothing about the build behind it,
and nobody had run the build.

### The section's last inhabitant is a feature that no longer exists

Worth doing that delete sooner rather than later. `data-attributes/` is the only place
left that documents the removed profile system **as if it worked**:
`state/properties.mdx` has a "Profile Properties" table with `profile.active`,
`profile.exists`, and `profile.is(name)` plus runnable
`data-next-show="profile.active === 'premium'"` examples;
`state/reference/attributes.mdx` presents `data-next-show-if-profile` /
`data-next-hide-if-profile` as supported and names the deleted `profileStore`;
`display/paths.mdx` lists a `profile.*` namespace; `state/operators.mdx` uses
`profile.active` as its canonical example for `===` and `!==`. Those attributes have
been inert since v0.4.6 — a reader following that page hides nothing and gets no error.
Removing the nav entry made them unreachable from the sidebar, which is a mitigation,
not a fix: the URLs still resolve.

### The nav gap hid two more rotten pages

Two pages under `campaigns/guides/` were missing from `guides/meta.json` — rendering at
their URL, unreachable from the sidebar, exactly how the profiles page rotted unnoticed.
Both were checked attribute-by-attribute against the source and **both are retiring**
(redirects applied; see [redirect-map.md](./redirect-map.md) for the itemised evidence):

- **`advanced-customization.md`** (626 lines) is broken at the *activation* level — its
  selectors use `data-next-cart-selector`, which the scanner never activates, so
  everything downstream is dead; plus `cart.hasSavings` and two sibling paths that live
  on `package.*` not `cart.*`, an `EventMap` event that does not exist
  (`selection:changed`), two payload/return shapes read wrongly, and a flagship
  bundle-builder button whose handler is a `console.log` with the comment *"This would
  normally use SDK methods"*.
- **`quantity-package-swapper.md`** (350 lines) documents a `.js` file this repo does not
  ship, and describes that script's config and its four global methods wrongly even in
  the repo that does have it — none of the four exist. Its stated reason to exist ("no
  SDK selector enhancer needed") was solved natively by `package-selector`'s inline
  quantity controls.

Neither had a single inbound link. **The pattern is the finding:** an unlisted page is
not just hidden, it is unmaintained — nothing links to it, nobody reads it, and no check
covers hand-written prose. That is the argument for the generated-and-drift-checked
approach in the rest of this plan, restated by three separate pages now.

**Still open, same class of problem:** the guides landing grid is a hard-coded list of
five in `components/guide-cards/index.tsx`, and `checkout-multi-step` is missing from it
even though `meta.json` lists it. Two nav sources that can disagree.

## 5q. Phase 6 + 7 (planned, not started) — `src/core`, and analytics inside it

Features reached 29/29 and state 7/7, and both are drift-checked. **`src/core` was never
in the programme at all** — and because it has no metric in `docs:coverage`, that is
invisible: the gate reports 13 metrics at 100% while a third layer of the SDK has three
READMEs and nothing else.

| Layer | Files | Lines | Documentation today | In the coverage gate? |
|---|---|---|---|---|
| `features/` | — | — | manifest + 9-page guide each, generated + drift-checked | yes (9 metrics) |
| `state/` | — | — | state-manifest + overview each | yes (2 metrics) |
| **`core/`** | **75** | **~29,900** | 3 `README.md` (`core/`, `core/analytics/`, `core/base/`) | **no** |

### The awkward fact to design around

`src/core/README.md` opens with "**Internal engine** — everything here is `@internal`:
it is *not* part of the public API and is free to move." That is true of the *classes*
and false of the *behaviour*. Core is where the boot sequence, the API-key meta tag, the
sessionStorage keys and their TTLs, `?debug=true`, the `window.next` surface, error
capture, attribution capture, and all analytics live. An author never imports
`SdkInitializer`, but they absolutely depend on what it does.

So the unit of documentation for core is **not** a class reference — TypeDoc already
covers what is exported. It is the **contracts core exposes to a page**: what boots in
what order, what it reads off the document, what it writes to storage, what it prints to
the console, what it sends to analytics, and which switches an author can flip. Same
split as everywhere else in this plan: extract what the source can answer, hand-write
only the judgement.

Top-level sizes, for scoping: `sdk-initializer.ts` 1,133 · `next-commerce.ts` 1,038 ·
`country-service.ts` 689 · `attribute-scanner.ts` 608 · `test-mode.ts` 367 ·
`storage.ts` 232 · `logger.ts` 128 · `events.ts` 57, plus `analytics/` 10,638,
`base/`, `debug/`, `attribution/`, `monitoring/`, and `docs/` (this plan's own
machinery).

### Phase 7 — analytics is the sharpest gap, and it is its own phase

**27 files, 10,638 lines — over a third of core, and the largest single subsystem in the
SDK.** What exists today:

- **17 hand-written pages** on the site under `campaigns/analytics/**` (index,
  configuration, events, tracking-api, custom-events, debugging, best-practices,
  meta-tags, plus 8 provider examples). None generated, none drift-checked — the same
  condition that let the retired `data-attributes/` door document eight attributes that
  never existed (§5g).
- **A README that is already wrong.** `core/analytics/README.md` advertises
  "Multi-provider support (GTM, Facebook Pixel, custom endpoints)" while
  `providers/` holds **six** adapters: `GTMAdapter`, `FacebookAdapter`,
  `CustomAdapter`, `RudderStackAdapter`, `NextCampaignAdapter`, and the
  `ProviderAdapter` base. A reader deciding whether RudderStack is supported gets the
  wrong answer from the file closest to the code.
- **One thing already machine-readable, and unused for docs.**
  `analytics/schemas/events.manifest.json` is generated by
  [`src/tests/utils/analyticsVocabulary.test.ts`](../src/tests/utils/analyticsVocabulary.test.ts)
  and **fails CI on drift** — the precedent this whole plan was modelled on (§2). The
  event catalogue is therefore the one analytics page that can be generated today,
  from a source that is already trustworthy.

Questions an author has and cannot answer from the docs as they stand — each is an
acceptance criterion for Phase 7:

1. Which events fire with **no** configuration at all, and which need a provider?
2. What is the exact payload of each event, per field, and which provider reshapes it?
3. The `dl_` prefix: which channel sees it and which strips it?
4. What leaves the page that could be PII, and what is hashed before it does?
5. Which tax basis a value is on (`incl` vs `excl`) and why the number can differ from
   the order total.
6. What `?debug=true` turns on, and how to see an event that did not fire.
7. What to do when a provider is configured and nothing arrives — the failure ladder.

### Proposed shape of the work

1. **Add core to the gate first**, as Phase 0 did for features. A metric that counts
   author-facing contracts documented, plus one for analytics events documented against
   `events.manifest.json`. Without it, everything below is unenforced.
2. **Generate what is extractable**, following `extract-logs.ts` / `extract-state-fields.ts`:
   the storage-key registry with TTLs (`core/storage.ts`), the log-prefix list, the meta
   tags and `data-next-*` attributes the boot sequence reads (already partly covered by
   [`sdk-attributes.ts`](../src/docs/content/sdk-attributes.ts)), and the analytics event
   catalogue.
3. **Hand-write one overview per author-facing subsystem**, the way §5n did for stores:
   boot sequence, event bus, logging/debug, storage, attribution, error handling,
   analytics.
4. **Correct the three existing READMEs** — starting with analytics' provider list.
5. **Leave contributor-only plumbing alone.** `src/docs/` (the build-time manifest
   schema, content, and generators — relocated out of `core/docs/` by E1, see §0), `core/base/`,
   and the generators do not need author-facing pages; they need accurate TSDoc, which
   they largely have.

### The constraint that changes the approach: core TSDoc is never published

This was the surprise, and it invalidates the obvious plan ("write TSDoc on the core
classes"):

1. `src/index.ts` re-exports exactly **four** core symbols — `NextCommerce` (`:41`),
   `SDKInitializer` (`:42`), `Logger` (`:52`), `EventBus` (`:53`). The other 71 files are
   unreachable from TypeDoc's single entry point.
2. All four are classes, and this repo's own TypeDoc plugin **deletes the class pages**:
   `scripts/typedoc-fumadocs.mjs:23` has `DROP_DIRS = ['classes']` and removes the
   directory on render end, on the stated grounds that the scriptable API is documented
   better by hand in the JavaScript API guide.
3. Confirmed empirically: `docs/api/` contains only `index.mdx`, `interfaces/`,
   `variables/`, `type-aliases/`, and every `Defined in:` path across those 32 pages
   resolves to `index.ts`, `types/global.ts`, or a `state/*` file. **Zero `src/core/`
   paths.**

So TSDoc inside `src/core/**` is a **contributor** artifact — valuable for the next
maintainer, invisible to readers. Reader-facing core documentation has to be markdown
the generators write, exactly as features and stores already do. Adding core to
`entryPoints` would not fix it without also changing the plugin.

**A related correction:** `src/core/README.md` claims core is kept out of the public
reference because it is "marked `@internal`… (`excludeInternal: true`)". An AST scan
finds **zero `@internal` tags on any exported declaration** in core — the only seven are
file-header blocks in what was then `core/docs/` (now `src/docs/`, see §0) attached to
nothing. Core is excluded by
unreachability plus `DROP_DIRS`, not by tags. Worth fixing in the README because it
tells the next person the wrong thing to maintain.

### Where core stands on TSDoc anyway (for the contributor half)

**97 of 228 top-level exports (43%)** carry a real summary, and **187 of 404 public
members (46%)** — counting a content-free `/** @category Cart */` as undocumented,
because it publishes no sentence.

The distribution is the useful part: `analytics/providers` is at **100%**, while **every
one of the 8 root-level core files has an undocumented top-level export** — including
`SDKInitializer` (1,113 lines), `AttributeScanner` (589), `CountryService` (642),
`EventBus`, and `errorHandler`. `analytics/events` and `analytics/tracking` are inverted:
0% on the export, 86–94% on the members, because their prose sits in file banners that
TypeScript does not attach to a declaration. `debug/` is at 9% / 7%. `NextCommerce` has a
block on all 65 members but **34 are a bare `@category` line** — so a third of the public
API has a category and no sentence.

### The questions core cannot answer today

Each was checked against the whole published site, not just the repo. The sharp ones:

1. **`next:ready` is not the "SDK is ready" signal.** `public/loader.js:153` fires it
   immediately after the module import; boot finishes much later and fires
   `next:initialized` (`sdk-initializer.ts:1070`). A page that listens for `next:ready`
   and calls `next.getCartData()` races the entire 19-step boot. Nothing says this.
2. **A missing API key aborts the boot rather than degrading it** —
   `sdk-initializer.ts:434` throws at step 7, so there is no DOM scan, no `window.next`,
   no `next:display-ready`, and queued `window.nextReady` callbacks never drain. But
   `body[data-next-sdk-loading]` is still flipped to `false` (`:103`), so the page
   un-hides and shows raw `{price}` placeholders. Then three silent retries at 1s/2s/3s,
   then an uncaught rejection.
3. **~40 storage keys exist; the site documents 5.** And there is no shared expiry
   mechanism — TTLs live in six separate constants (order 15 min, campaign 10 min, bundle
   price 10 min, country 1 h, list attribution 30 min, event timeline 2 h).
4. **`?debug=true` and `?debugger=true` are different switches**, and no page says so.
   `?debug` only un-suppresses logging; the overlay needs `?debugger`, the `next-debug`
   meta tag, or `nextConfig.debug`. 48 site pages mention `?debug`, 12 mention
   `debugger`, none distinguishes them.
5. **Analytics fires nothing by default.** `configStore` has no `analytics` default and
   **no meta tag turns it on**, so `config.analytics?.enabled` is `undefined` and
   `initialize()` returns early. Conversely, with `enabled: true` and *zero* providers,
   every event still pushes to `window.NextDataLayer`. Both halves are counter-intuitive
   and undocumented.
6. **`?ignore=true` is an analytics kill switch documented nowhere.** Same for `?reset`,
   `?country`, `?test`, and `forceShippingId` — zero pages each.
7. **Test mode reaches the real order API.** `?test=true` (or the Konami code, or
   `?debugger=true`, which silently implies it) fills a hard-coded address and posts
   `card_token: 'test_card'` to the real `createOrder`. Its keydown listener is attached
   at import, so it is live in production.
8. **The `window.*` surface is bigger than the docs admit:** `nextDebug` alone exposes
   ~30 keys including all six raw stores, plus `NextDataLayer`,
   `NextDataLayerTransformFn`, `NextAnalytics`, `NextMetaTagController`,
   `_nextForcePackageId` / `ShippingId` / `BundleId`.
9. **Seven `next.*` methods are missing from the site** (58 of 65 documented):
   `swapCart`, `getVariantsByProductId`, `getAvailableVariantAttributes`,
   `getPackageByVariantSelection`, `createVariantKey`, `triggerCallback`, `getVersion`.
10. **"My provider is configured and nothing arrives" has three silent drop points** —
    schema validation returning before the push, `ProviderAdapter.trackEvent` swallowing
    both throws and rejections, and adapters answering `notSupported` for unmapped names.
    `AnalyticsDebugTracker` already records exactly this per provider
    (`pending|sent|blocked|skipped|failed`, with payload, error, and duration) **in every
    build** — the data exists, the page does not.

### What is extractable, and what needs judgement

| Candidate | Verdict |
|---|---|
| **Boot-order table** | **Generable.** `initialize()` is a flat 19-statement sequence of `await this.x()` (`sdk-initializer.ts:33-99`) — an AST walk yields the ordered steps, which are awaited, and which are wrapped in `try/catch`. Highest-value core page and the cheapest. |
| **Log prefixes + messages** | **Generable with no new tooling.** `extract-logs.ts` already matches on a `logger` receiver, so it works unchanged on core's **483 call sites** under **37 prefixes**. Judgement: expected-vs-problem, as the feature `logs.md` standard already requires. |
| **Analytics event catalogue** | **Generable, and the drift gate already exists.** `DL_EVENTS` (`analytics/schemas/events.ts:55`) is `as const satisfies` with **35 events**, 19 carrying field schemas, and `analyticsVocabulary.test.ts` already asserts six invariants including a bidirectional emit-site scan. |
| **Error catalogue** | **Generable** — `extractThrows()` already does this; **14 literal throws** in core plus 5 `DispatchError` sites. Recoverable-vs-fatal stays hand-declared, as `ErrorDoc` already is. |
| **Meta tags + boot-read attributes** | **Mostly generable** — 24 distinct `meta[name=…]` literals; [`sdk-attributes.ts`](../src/docs/content/sdk-attributes.ts) is the existing home and already renders. Descriptions are judgement. |
| **Storage keys + TTLs** | **Split.** Keys are extractable (constants + `persist({name})` + every literal `setItem`). **TTLs are not** — six unrelated constants, plus dynamic keys (`next-campaign-cache_{CURRENCY}`, `next-price-{hash}`, `upsells_{orderId}`, `next_country_states_{CC}`) whose shape no scanner can name. |
| **`next.*` method list** | **Names generable, prose not** — 65 members, 34 with only a bare `@category`. A drift test "every public member appears in `javascript-api/methods.md`" would have caught the 7 missing ones. |
| **Provider matrix** | **Half.** The registry and required-settings checks are literals; which behaviour is contract vs accident is judgement — e.g. `NextCampaignAdapter` supports only `page_view`, RudderStack skips `identify` without an email, GTM pushes `dl_*` verbatim to two data layers while stripping the prefix only to pick GA4 field rules. |

### How the gate would measure core — and why not by file

Four metrics, shaped like rows the gate already has, so `docs-coverage.mjs` needs a
scanner and a `KINDS` entry rather than new machinery:

| Metric | Denominator |
|---|---|
| `coreSubsystemsWithoutOverview` | **11 author-facing subsystems** — boot, public facade, DOM activation, geo, test mode, storage, logging, event bus, attribution, error handling, analytics |
| `analyticsEventsWithoutDocs` | **35** — `DL_EVENT_NAMES`, already machine-readable |
| `coreContractsWithoutDocs` | **~95 named contracts** — 24 meta tags + 11 URL params + ~40 storage keys + 37 log prefixes + 14 error messages, each an extractable string id |
| `nextMethodsWithoutDocs` | **65** — public members of `NextCommerce` |

**Not by file** (75 is 37% `debug/` by line, and includes two dead files — the script
already refuses permanently-unreachable rows for exactly this reason), **not by exported
symbol** (228 at 43% would improve by writing TSDoc that is never published — a metric
pointed at the wrong artifact), **not by subsystem alone** (21 rows is too coarse:
`analytics/` would be one row over 10,638 lines).

### The one thing to settle before writing any log documentation

`vite.config.ts:31` sets `drop_console: true` with
`pure_funcs: ['console.log', 'console.info', 'console.warn', 'console.debug']`.
If that is doing what it says, the **28 feature `reference/logs.md` pages already
published** describe console output that production builds do not emit — and a core log
reference would inherit the same problem. Verify against a fresh build before writing
more log docs, and if it holds, the pages need a plain sentence about which builds print
what. This is the one item here that touches already-shipped documentation.

### Extra findings from the inventory

Thirteen core defects came out of it, now in [code-findings.md](./code-findings.md) —
including the `next:ready` race, the boot-abort-but-un-hide sequence, `next:initialized`
reporting a hard-coded version `'0.2.0'`, `MetaTagController.shouldBlockEvent()` having
no caller (so `next-analytics-disable` is parsed and never enforced), and ~280 lines of
dead debug code.

## 5r. Phase 6 + 7 as shipped (2026-07-31) — core and analytics

Core went from **three READMEs and no metric** to a documented layer in the gate. The
shape follows what §5q proposed, with one structural change and eight factual corrections.

### What was built

| Piece | Files |
|---|---|
| **The inventory** — 11 author-facing subsystems, the denominator | [`src/docs/content/core-manifest.ts`](../src/docs/content/core-manifest.ts), [`core-subsystems.ts`](../src/docs/content/core-subsystems.ts) |
| **10 generated reference pages** | `src/core/guide/reference/` — boot-sequence, meta-tags, url-parameters, storage-keys, javascript-api, window-surface, logs, errors, analytics-events, analytics-providers |
| **11 hand-written overviews + a section landing** | `src/core/guide/subsystems/*.md`, [`guide/overview.md`](../src/core/guide/overview.md) |
| **5 extractors** | `src/tests/docs/extract-{boot-sequence,storage-keys,core-contracts,next-methods,analytics-events}.ts` |
| **6 declaration files** (the judgement half, drift-checked both ways) | `src/docs/content/{meta-tags,url-parameters,storage-keys,next-methods,analytics-events,core-logs,core-errors}.ts` |
| **6 new coverage metrics** | [`scripts/docs-coverage.mjs`](../scripts/docs-coverage.mjs) |
| **6 new drift test files** | `src/tests/docs/{bootSequence,coreContracts,coreLogs,coreSubsystems,nextMethods,storageReference}.test.ts` |

Numbers: **19 metrics at 100%** with an empty baseline (was 13). **1,532 unit tests** pass
across 59 files (was 1,425). The site publishes **37 guides / 316 pages** (was 30 / 244),
with core as its own section, and link validation is at **0 errors**.

### The one structural change to §5q: the unit is a *contract*, not a class or a file

§5q already argued this; building it confirmed why it matters. The denominators that look
obvious both fail:

- **By file** — 75 files, but 37% of the lines are the debug overlay and three files turned
  out to be dead (finding 65), so the number moves for reasons no reader cares about.
- **By exported symbol** — 228 exports at 43% TSDoc. Improving that means writing TSDoc
  **that is never published**: `src/index.ts` re-exports four core symbols and
  `typedoc-fumadocs.mjs` deletes the class pages. A metric pointed at an invisible artifact.

So the gate counts six things a page actually depends on: subsystem overviews (11),
reference pages the inventory promises (10), `dl_*` events (35), public `NextCommerce`
members (64), meta tags (21), and literal storage keys (26).

**One metric was deliberately not built.** A URL-parameter denominator cannot be measured
honestly by regex — `params.get('x')` is indistinguishable from a `FormData` or `Map` read,
and the naive scan picks up checkout fields (`address1`, `province`, `postal`) that are not
URL parameters at all. That contract is left to the bidirectional AST drift test in
`coreContracts.test.ts`. A metric that cannot be measured honestly is worse than no
metric, because it reads as coverage.

### Eight places §5q was wrong, found by writing the pages

Each was checked against the source before the page was written. The pattern is worth
noting: **every one of these was a number or a mechanism taken from reading the code once,
and every one was off.**

| §5q said | Actually |
|---|---|
| boot is a "flat 19-statement sequence", throwing "at step 7" | **14 steps**; the try block has 22 statements of which 14 are calls. `loadCampaignData` is the **5th** call, and the throw is `:435` not `:434` |
| "three silent retries" | Not silent — each logs `SDK initialization failed:` and `Retrying initialization (attempt N/3)...` |
| 24 meta tags | **27** (21 literal, 6 reached through helpers) |
| 11 URL parameters | **40** — the count missed 24 attribution names read through `getStoredValue(key)`, five list-attribution names, and `payment_failed` |
| ~40 storage keys, six TTL constants | **49 rows**, and **ten** independent expiry windows |
| 483 log call sites under 37 prefixes | **480** sites, **36** prefixes (five decided at runtime) |
| GA4/FB/Rudder "strip `dl_`" | They **rename via fixed tables**. The only literal strip is `gtm-adapter.ts:349`, and it is unreachable for canonical events — `sendEvent` returns early for anything `dl_`-prefixed. There is **no GA4 adapter** in this build |
| the overlay needs `?debugger`, the `next-debug` meta tag, **or** `nextConfig.debug` | **Only `debugger`.** The meta tag and `nextConfig.debug` install `window.nextDebug` and then call `initialize()`, which returns at the `debugger`-only gate (`DebugOverlay.ts:154`) |

That last one produced the most useful table in the whole phase, because there are **four**
outcomes, not two — and the middle two are the ones that waste an afternoon:

| What you set | `error`/`warn`/`info` | `debug` lines | `window.nextDebug` | Overlay |
|---|---|---|---|---|
| `?debug=true` | yes | **no** — level stays at `INFO` | no | no |
| `nextConfig.debug = true` | yes | yes | yes | **no** |
| `<meta name="next-debug">` | **no** — `Logger` reads neither meta tags nor the config store | **no** | yes | **no** |
| `?debugger=true` | yes | yes | yes | yes |

### The `drop_console` question is answered, and the answer was a different bug

§5q flagged this as "the one thing to settle before writing any log documentation", because
if `drop_console` applied to the shipped bundle then the 28 already-published feature
`logs.md` pages described output production never prints.

Measured against a fresh `npm run build`: **the published pages are fine, and only because
a second defect cancels the first.** The ESM output — which is what every customer page
loads (`public/loader.js:50`) — **is not minified at all**, so `drop_console` never runs on
it. Chunks ship original identifiers, indentation and template literals. The UMD fallback
*is* terser-minified and contains **zero `console.*` call sites**, `console.error`
included, so a visitor on that path gets no diagnostics whatever and debug mode cannot
bring them back.

That is [finding 36](./code-findings.md), and it is the largest performance item the
programme has turned up: over 2 MB of unminified JavaScript, `vendor` alone at 656 kB.

**Process note.** Three separate agents reasoned from `vite.config.ts` and concluded the
ESM bundle *was* minified, because the config plainly says `minify: 'terser'` for that
build. Only measuring the output settled it. Config is not evidence of behaviour — the same
lesson §5p recorded about link validation not being evidence of a build.

### What the new drift checks caught in their first run

- **A phantom API in a generated page.** `next.analytics.track()`, `.trackSignUp()`,
  `.trackLogin()` do not exist — `NextCommerce` has no `analytics` property and the methods
  are flat. It appeared six times in the analytics prose and rendered into five published
  places, as runnable examples that would throw. Corrected to `next.trackCustomEvent()` /
  `next.trackSignUp()` / `next.trackViewItemList()`.
- **A validation claim that was backwards.** The catalogue said 19 events "carry a field
  schema that is validated before the event is pushed". `EventValidator` runs **only in
  debug mode and only logs** (`analytics/index.ts:293-301`); the always-on blocking check is
  the separate `EVENT_VALIDATION_RULES` set, which checks a few required fields. A payload
  missing a schema field ships.
- **Advice that did nothing.** The meta-tag page told readers to set
  `window.nextConfig.tracking` to suppress events. That field is stored and read by
  nothing. Replaced with `?ignore=true`, which is real and was documented nowhere.
- **A storage claim in the wrong direction.** The `next-attribution` row said a localStorage
  copy "survives the tab, which the store never intends". Nothing ever writes that key to
  localStorage — the collector's three reads of it are dead branches. The consequence that
  *does* bite is narrower and now stated: `first_visit_timestamp` cannot be recovered in a
  new tab.
- **`triggerCallback` has no caller**, so `registerCallback` handlers never fire from SDK
  code. The prose had described it as a lifecycle hook.

### One correction to already-published documentation: attribution is last-touch

Three docs — including the store's own overview, written in Phase 5n — said attribution is
**first-touch**: "collected once, early, and then left alone", "the first page wins".

It is **last-touch per parameter, with carry-over**. `getStoredValue()`
(`attribution-collector.ts:105-155`) reads the URL *first* and mirrors a hit back into
storage, so a second tagged link in the same session re-credits that parameter;
`getFunnelName()` (`:183`) is explicit about it and logs `🔄 Funnel override`. All three
docs corrected. This is the only Phase 5 output Phase 6 found to be factually wrong, and it
was wrong in the direction that costs money — someone reconciling affiliate payouts would
have trusted it.

### A false-positive in a check I added, worth recording

The forbidden-words check (`.claude/rules/documentation.md` §2) used `\b` boundaries, and a
hyphen is a word boundary — so the real feature name **`simple-exit-intent`**, which appears
in generated cross-links, failed pages that had done nothing wrong. It now excludes
hyphen-adjacent matches and strips inline code spans. Same class of bug as §5m's
effort-signal check that made an agent delete correct content to pass: **a check that
dictates content instead of measuring it.**

### Division of labour

Ten agents in two waves — six on the extractable half (each owning its own extractor,
renderer, declaration file, test file and output path, so nothing collided), then four on
the eleven hand-written overviews. The lead owned the shared spine: the inventory schema,
the coverage metrics, the READMEs, and this file.

Two things made that work: **output paths were assigned up front**, and every agent was
told to run only its own test file, since `docs:reference` regenerates the whole directory
and would have tripped over other agents' in-flight work. What each returned that mattered
most was not the prose — it was the list of claims that turned out false, which is where
the eight corrections above came from.

## 5j. Code findings — moved to their own list

Documenting the SDK turned up **24 open code defects** plus 5 that were fixed along the
way. They were accumulating in this plan file, which is the wrong home: a plan is read
once, a bug list is worked through.

They now live in **[code-findings.md](./code-findings.md)**, triaged P1–P3, each with
`file:line`, the symptom, and a suggested fix, and each marked *verified* (I read the
code) or *reported* (precise but unconfirmed).

The four worth knowing without opening it:

- **Klarna reaches the API as `card_token`** on the `OrderBuilder` path — there are two
  copies of `API_PAYMENT_METHOD_MAP` and only one has `klarna`.
- **Order creation is implemented twice**, which is *why* the map diverged. The standard
  checkout builds an `OrderManager` and then does not use it.
- **`sdk.getCartData().cartLines` is always empty** — `enrichedItems` is never written,
  yet it is public API and its TSDoc claims a full pricing breakdown.
- **`removeCoupon` is case-sensitive and `applyCoupon` is not**, so removal can silently
  no-op and leave the shopper a discount the page thinks it took away.

## 5j-old. Two code findings, reported not fixed

Both surfaced from reading the checkout for §5i and are out of scope for a docs
change:

**1. Order creation is implemented twice.** `CheckoutFormEnhancer.createOrder()`
(`checkout-form.enhancer.ts:1875`) and `OrderManager.createOrder()`
(`managers/order-manager.ts:38`) are separate copies of the same logic — the same
three validations, the same messages, the same 429/401/422/5xx mapping. The enhancer
*constructs* an `OrderManager` at line 165 and never calls it for the standard path;
`OrderManager` serves express checkout only. So the standard and express checkouts
each have their own copy of order creation, and a fix to one silently misses the
other. This is why the same nine error messages appear at two sets of line numbers
in the errors reference.

**2. A leftover debug statement was logging at `warn`** — see §5h. Fixed there,
since it was a one-line level change rather than a behaviour change.

## 6. Risks

- **Phase 4 deletes 62 hand-written pages** whose prose is better than a
  generated table in places. Mitigation: the `notes` markdown field per
  attribute, and Phase 4 does not start until Phase 3's output is confirmed
  richer than what it replaces.
- **Broken customer links.** Mitigation: redirect map reviewed as its own step,
  `next-validate-link` gating the build.
- **Manifest ceremony discourages authoring.** Mitigation: the scanner registry
  is generated from manifests, so writing one is not optional busywork — it is
  how a feature gets registered.

## 7. Related — see also §8 for the current target

- Method: [`.claude/skills/sdk-docs/SKILL.md`](../.claude/skills/sdk-docs/SKILL.md)
- Guide format: [`.claude/rules/guide.md`](../.claude/rules/guide.md)
- Policy: [`.claude/rules/documentation.md`](../.claude/rules/documentation.md)
- Structure: [`.claude/skills/sdk-structure/SKILL.md`](../.claude/skills/sdk-structure/SKILL.md)
- Code defects found while documenting: [`code-findings.md`](./code-findings.md)
- **No pushes, no deploys:** nothing in this plan authorises a push or a deploy,
  including the redirect step in Phase 4. Local commits are fine. Enforced by the
  `permissions.deny` list in [`.claude/settings.json`](../.claude/settings.json).

---

## 8. Direction change (2026-07-31) — the TypeDoc site becomes the product

Everything above assumed the reader arrives at the **developer-docs** (Fumadocs) site and
that TypeDoc's job is to feed it MDX. That assumption is dropped.

**The published artifact is now a versioned TypeDoc HTML site built and served from this
repo.** developer-docs is not a target: no more MDX generation, no more redirect
bookkeeping, no more site-IA work in another checkout.

### The four decisions (Bond, 2026-07-31)

1. **One door, everything in it.** The TypeDoc site carries the API/type reference *and*
   all 354 in-repo markdown pages — 29 feature guides, `src/core/guide/`, and the state
   references — as first-class searchable pages.
2. **Remove the Fumadocs pipeline** from this repo: `scripts/typedoc-fumadocs.mjs`,
   the `docs/api/**` MDX output, and the two markdown plugins.
3. **Local server only.** `npm run docs:serve` (watch + static server). The build stays a
   plain static folder; hosting stays a human decision, and nothing here deploys.
   **Superseded 2026-07-31 in the second half only** — the host is now decided
   (Cloudflare Workers static assets, [Phase 13](#phase-13--hosting-decided-2026-07-31)).
   The build is still a plain static folder and nothing in this repo deploys: the
   deploy command stays a human's to run.
4. **Publish core and state too.** `src/core` and `src/state` become entry points, so
   `SdkInitializer`, `AttributeScanner`, `EventBus` and friends get real pages for
   contributors. The rule "TSDoc inside `src/core/**` reaches no reader" ends with this.

### Feasibility — measured today, not assumed

A full trial build was run against the real tree (typedoc 0.28.20, no new dependencies):

| Question | Answer |
|---|---|
| Does TypeDoc HTML render the guide markdown? | Yes, via `projectDocuments`. **347 document pages + 535 API pages = 882 pages, 15 MB** |
| How slow? | **8.1 s** cold, full build |
| Clean? | **0 errors, 11 warnings** (all four causes listed below) |
| Do the relative `*.md` links survive? | Yes — `](./reference/events.md)` and cross-feature `](../../../cart/cart-summary/guide/overview.md)` both rewrite to the rendered page |
| Are guides searchable? | Yes with `searchInDocuments: true` — search index 769 KB |
| Can the sidebar be a real tree? | Yes — TypeDoc honours `title`, `group`, `category`, `children`, `summary` frontmatter on documents. **0 of 354 files have frontmatter today** |
| Can a plugin do the versioning? | **Partly — corrected 2026-07-31, see [§8.1](#81-plugins--evaluated-2026-07-31).** The unscoped `typedoc-plugin-versions` is dead (0.2.4, peer `^0.23`), but the maintained fork `@shipgirl/typedoc-plugin-versions` 0.3.2 peers `>=0.26.0 <0.29.0`. It covers the switcher/aliases/folder layout; building from a git tag stays home-grown (Phase 10 item 1) |

The 11 warnings are the entire known defect list, and all are cheap:

- **8 extensionless relative links** (`](./url-parameters)`, `](./meta-tags)`, `](./guide/)`)
  — TypeDoc needs the `.md`. 4 of them are in `src/core/guide/reference/`.
- **2 absolute Fumadocs links** — `](/docs/campaigns/sdk-reference/interfaces/Package)`
  in `product-display`, `](/docs/campaigns/sdk-reference/interfaces/OrderData)` in
  `upsell`. Both die with the old site; both become document/`{@link}` links.
- **3 unresolved `{@link}`s** — `OrderData`, `Campaign`, `FixtureExample`.
- **4 mermaid blocks** (3 guides + core) — TypeDoc does not render mermaid. Fumadocs did.

### 8.1 Plugins — evaluated 2026-07-31

The whole [TypeDoc plugin list](https://typedoc.org/documents/Plugins.html) was checked
against this tree at typedoc **0.28.20**: npm peer ranges and last-publish dates for every
candidate, plus a trial build with `--validation.notExported true`. Four are worth adding;
the rest are either redundant with a 0.28 built-in or do not apply.

Cost of adopting all four: **5 devDependencies** (the four plugins plus `mermaid`), against
the two markdown plugins Phase 8 removes. That breaks the "no new dependencies" line in the
feasibility table above, which described the trial build, not the final config.

**Adopted 2026-07-31 — three of the four.** `typedoc.json` now carries
`"plugin": ["typedoc-plugin-mdn-links", "@boneskull/typedoc-plugin-mermaid",
"typedoc-plugin-llms-txt"]` plus `"mermaidSource": "local"`, and `mermaid` is a
devDependency. The fourth (`@shipgirl/typedoc-plugin-versions`) is **rejected** — see the
versioning note below. Measured on the working tree, plugins on vs off: **771 → 979 files,
14 → 30 MiB**; every added file is mermaid's ESM bundle plus one `llms.txt`. Build stays
0 errors / 0 warnings.

| Plugin | Version / peer | Buys us | Land in |
|---|---|---|---|
| `typedoc-plugin-mdn-links` | 5.1.1, `0.27.x \|\| 0.28.x` | Links global types to MDN. Measured in `src/core` + `src/state` + `src/index.ts`: `HTMLElement` ×57, `CustomEvent` ×44, `URLSearchParams` ×29, `Storage` ×20, `MutationObserver` ×9, `IntersectionObserver` ×2 — all plain text today. Zero config, no maintenance | 9 |
| `@boneskull/typedoc-plugin-mermaid` | 0.2.1, `>=0.27.0 \|\| ^0.28.0` | Renders the 4 mermaid blocks, and with `"mermaidSource": "local"` copies mermaid's ESM entry + chunks to `assets/mermaid/` — **this replaces hand-vendoring `mermaid.min.js` in Phase 11**, and adds the light/dark theme variants a hand-rolled `customJs` would have to write. Needs `mermaid` as a devDependency | 11 |
| `@shipgirl/typedoc-plugin-versions` | 0.3.2, `>=0.26.0 <0.29.0` | Version subfolders from `package.json` version, minor-version symlinks, header `<select>` switcher, stable/dev aliases — Phase 10 items 3–6. See the caveats below | 10 |
| `typedoc-plugin-llms-txt` | 0.1.2, `^0.28.0` | `llms.txt` covering both API reflections and `projectDocuments`, with sections auto-discovered from document **frontmatter**. Near-free once Phase 9 has written that frontmatter — so it must land *after* Phase 9, not before | 9 (after frontmatter) |

**Versioning plugin — rejected once the host was known (2026-07-31).** The caveat flagged
here decided it: the plugin's version aliases are **symlinks**, and §13's host is
Cloudflare Workers static assets, where Wrangler walks the tree with `lstat` and **does not
upload a symlinked folder** — `latest/` would publish as nothing. It also cannot build from
a git tag, which is the whole of Phase 10 item 1. So the switcher, the aliases and the
folder layout stay in [`docs-build-version.mjs`](../scripts/docs-build-version.mjs) /
[`docs-versions.mjs`](../scripts/docs-versions.mjs) /
[`docs-publish.mjs`](../scripts/docs-publish.mjs), which materialise `latest/` as a real
directory copy for exactly that reason. This is the one piece of docs tooling that is
hand-written *because* no plugin fits, not for lack of looking.

**Rejected, with the reason:**

- `typedoc-plugin-extras` — `favicon`, `customFooterHtml`, `customJs`, `customCss` are all
  built-in options in 0.28. Verified against `typedoc --help`.
- `typedoc-plugin-merge-modules`, `typedoc-plugin-include-example` — 0.28 ships
  `@mergeModuleWith` (`MergeModuleWithPlugin`) and `{@includeCode}` (`IncludePlugin`)
  natively.
- `typedoc-plugin-custom-validation` — peer stuck at `~0.26.11`, and
  [`docs-coverage.mjs`](../scripts/docs-coverage.mjs)'s 19 ratcheted metrics already own
  this job.
- `typedoc-plugin-ga`, `@8hobbies/typedoc-plugin-plausible`,
  `typedoc-plugin-umami-analytics` — nothing is hosted; decision 3 of §8 is local-server
  only.
- `typedoc-plugin-zod`, `typedoc-plugin-valibot`, `typedoc-plugin-vue`,
  `typedoc-umlclass`, `typedoc-plugin-inline-sources`, `typedoc-plugin-dt-links` — no
  schema library, no Vue, and nothing in §8 asks for class diagrams or inlined sources.
- `typedoc-plugin-missing-exports` (4.1.4, `^0.28.1`) — **works, but is the worse fix** for
  the gap below; it parks types in an `<internal>` module, which reads badly for the most
  looked-up types in the SDK.

**Not a plugin — the gap the plugin sweep exposed.** With `--validation.notExported true`
the trial build reports **26 types referenced from the public API with no page**, and they
include the SDK's core domain vocabulary: `Package`, `Campaign`, `Order`, `Cart`,
`CartSummary`, `Offer`, `Discount`, `LineWithUpsell`. Cause: they live in
`src/types/campaign.ts` and `src/types/api.ts`, and `src/index.ts` re-exports only
`./types/global` — so `src/types` is not reachable from any entry point. Fix by adding
`"src/types"` to `entryPoints` (Phase 8), which also resolves two of the three unresolved
`{@link}`s above (`Campaign`, `OrderData`). A reader who cannot open the `Package` page is
the single worst outcome this site could ship with.

### Phases

| # | Work | Acceptance | Est. |
|---|---|---|---|
| **8** | The site builds and serves | `npm run docs` → `docs/site`, 0 warnings; `npm run docs:serve` on :3500; Fumadocs pipeline gone | 0.5 d |
| **9** | Nav, URLs, landing page | sidebar is a Features/Core/State tree; every page ≤3 clicks; no `/docs/` absolute links; URL shape frozen | 1 d |
| **10** | **Versioning** | two versions built side by side, switcher moves between the same page, `versions.json` drift-checked | 1–1.5 d |
| **11** | What publishing core changes | `@internal` policy settled; CLAUDE.md + `core/README.md` corrected; mermaid renders; core TSDoc metric ratcheted | 0.5–1 d |
| **12** | Unhook developer-docs | no reference to `../../developer-docs` left in scripts, rules, or skills | 0.5 d |

Total ≈ 3.5–4.5 d. Phases 8→9→10 are ordered; 11 and 12 can go in parallel with 10.

### Phase 8 — the site builds and serves

`typedoc.json` becomes an HTML config:

```jsonc
{
  "entryPoints": ["src/index.ts", "src/core", "src/state"],
  "entryPointStrategy": "expand",
  "exclude": ["**/*.test.ts", "**/tests/**"],
  "out": "docs/site",
  "projectDocuments": [
    "src/features/**/guide/*.md", "src/features/**/guide/reference/*.md",
    "src/state/**/guide/*.md",    "src/state/**/guide/reference/*.md",
    "src/core/guide/**/*.md"
  ],
  "searchInDocuments": true,
  "validation": { "invalidLink": true, "notExported": false, "notDocumented": false }
}
```

Deletions in the same change: `scripts/typedoc-fumadocs.mjs` (108 lines), `docs/api/**`,
the `typedoc-plugin-markdown` + `typedoc-plugin-frontmatter` devDependencies, and the
markdown-only options HTML ignores (`fileExtension`, `hidePageHeader`, `hidePageTitle`,
`hideBreadcrumbs`, `parametersFormat`, `propertiesFormat`, `enumMembersFormat`,
`indexFormat`, `entryFileName`, `mergeReadme`). `docs/api/` in `.gitignore:35` becomes
`docs/site/`.

New `scripts/docs-serve.mjs` — `node:http` static server, **zero new dependencies**,
matching this repo's habit of scripting over adding libraries. Scripts:

| Script | Does |
|---|---|
| `docs` | `typedoc` → `docs/site` |
| `docs:serve` | `typedoc --watch` + `docs-serve.mjs` on :3500 |
| `docs:check` | `typedoc --treatWarningsAsErrors` — the link gate, CI-ready |
| `docs:reference`, `docs:coverage` | unchanged |

Turn `treatWarningsAsErrors` on **after** the 11 warnings above are fixed, in this same
phase, so the gate starts green.

Watch out: `--watch` rebuilds the whole project (8 s) and documents are converted, not
hot-swapped — editing a guide costs a full rebuild. Acceptable at 882 pages; revisit if
it doubles.

**Also in this phase:** add `"src/types"` to `entryPoints`. Without it `Package`,
`Campaign`, `Order`, `Cart`, `CartSummary`, `Offer`, `Discount` and 19 more have no page at
all — see the last paragraph of [§8.1](#81-plugins--evaluated-2026-07-31). Re-run
`--validation.notExported true` afterwards and fix whatever is still reported before
turning on `treatWarningsAsErrors`.

### Phase 9 — nav, URLs, landing page

This is the phase that decides whether the site is usable, and the trial exposed two real
problems.

**Flat document URLs.** A page lands at
`documents/features_cart_quantity-control_guide_reference_attributes.html`. That is both
ugly and a public URL surface the moment a version is published — **freeze the shape here,
before Phase 10, because renaming later breaks customer links.** Options: accept the
flattening, or set `router` (`kind-dir` / `structure`) and check what the document paths
become.

**A flat sidebar.** 347 documents with no frontmatter list as one pile. Fix by generating
frontmatter:

- The generated pages (`reference/*.md`, `logs.md`, `errors.md`, `relations.md`,
  `get-started.md`, …) already have owners in `src/docs/render/render-*.ts` — emit
  `title` / `group` / `category` there, and the existing drift tests keep them honest.
- The hand-written three (`overview.md`, `use-cases.md`, `glossary.md`) get frontmatter
  once by codemod, then a new `docs:coverage` metric — *guide pages carrying nav
  frontmatter* — keeps new files from regressing.
- One root document per feature: `overview.md` declares `children: [get-started.md, …]`,
  so the tree reads **Features › Cart › Quantity Control › Attributes**.

**The landing page lies.** `src/index.ts`'s `@packageDocumentation` (lines 1–36) sends
readers to `/docs/campaigns/javascript-api/methods`, `/docs/campaigns/feature-guides/all-attributes`
and friends — all dead once developer-docs is out. Rewrite it as the site's real front
door with document links, plus `navigationLinks` (GitHub, playground), `titleLink`, and a
`customCss` pass for readability.

**Two plugins belong to this phase** ([§8.1](#81-plugins--evaluated-2026-07-31)):
`typedoc-plugin-mdn-links`, which needs no decisions, and `typedoc-plugin-llms-txt`,
which reads the frontmatter this phase writes — so add it last, after the frontmatter
generation above is landing clean. **Both landed 2026-07-31**, after the frontmatter: 272
MDN links across the build, and `llms.txt` at each version root with one section per feature,
taken from the `category` frontmatter.

### Phase 10 — versioning

**Model: one static folder per released tag, built from that tag, plus a `latest` alias
and an in-page version switcher.** This mirrors how the SDK itself ships —
`public/loader.js:43` serves
`cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{version}/dist` — so a page pinned to
`v0.4.28` has docs that describe `v0.4.28`, which is the whole point. Current version:
`0.4.30`.

```
docs/site/
  index.html      → redirect to latest/
  versions.json   [{ "version": "0.4.30", "tag": "v0.4.30", "current": true }, …]
  latest/         the newest release build
  v0.4.30/  v0.4.29/  …
  dev/            built from the working tree — never published
```

Work items:

1. **`scripts/docs-build-version.mjs`** — `git worktree add` the tag to a temp dir, link
   this checkout's `node_modules` into it, run TypeDoc there with `out` pointing at
   `docs/site/v<tag>`, then `git worktree remove`. **Prototype this first**: an old tag's
   sources may not type-check against today's `node_modules`, and that is the one
   unverified assumption in §8.
2. **Decide the version floor.** Older tags predate the guides entirely, so their build
   would be an API-only site with an empty Guides tree. Only tags at or after the first
   release containing `src/features/**/guide/` get a versioned build; older versions
   redirect to `latest` with a banner. One command settles the floor —
   `git tag --sort=v:refname | head` and `git log --diff-filter=A --format=%H -1 -- 'src/features/*/*/guide'`.
3. **Version switcher** — **evaluate `@shipgirl/typedoc-plugin-versions` 0.3.2 before
   writing this by hand** ([§8.1](#81-plugins--evaluated-2026-07-31)); it ships items 3–6
   (folder layout, minor-version symlinks, header `<select>`, stable/dev aliases) and only
   works if the eventual host serves symlinks. If it is rejected, the hand-rolled version
   is: `customJs` fetches `../versions.json`, renders a `<select>` in the header, and on
   change jumps to **the same path** in the target version, falling back to that version's
   index when the page does not exist there — pages get renamed across versions and a 404
   must not be the answer.
4. **Stale banner** from the same script whenever `current !== true`: "You are reading
   v0.4.28. Latest is v0.4.30."
5. **`hostedBaseUrl` per version build** so canonical URLs and the sitemap point at the
   version they belong to.
6. **`versions.json` is generated, not hand-kept** — from the tag list plus
   `package.json`'s `version`, with a drift test in `src/tests/docs/` like every other
   generated artifact here.
7. **CI:** build `dev` on every PR with `docs:check` as the gate; build a version folder
   when a `v*` tag appears. **Build only — no publish step.** `docs/site/` stays
   gitignored and putting it online is Bond's call.

### Phase 11 — what publishing core actually changes

- **`@internal` needs a policy.** 24 tags in `src/core`, 0 in `src/state`. With core as an
  entry point, `excludeInternal: true` would silently hide members again — and §5q found
  most of those tags sit on **file-header blocks in what was then `core/docs/` (now
  `src/docs/`, see §0) that attach to no declaration**. Recommendation: keep
  `excludeInternal: true`, delete the header-block
  tags, and let the tag keep its plain meaning for the few members that genuinely hide.
- **Two documents now say something false** and must be corrected in the same change:
  CLAUDE.md's "TSDoc inside `src/core/**` reaches no reader (only four core symbols are
  re-exported and the TypeDoc plugin drops class pages)", and `src/core/README.md`'s claim
  that core is excluded because it is `@internal` (§5q proved it was excluded by
  unreachability plus `DROP_DIRS`; after Phase 8 it is not excluded at all).
- **Core TSDoc becomes reader-visible**, so §5q's numbers — 43% of top-level exports and
  46% of public members carry a real summary; all 8 root-level core files have an
  undocumented top-level export — turn into a ratcheted `coreExportsWithoutSummary`
  metric frozen at today's value. A gate, not a writing project.
- **Mermaid.** 4 blocks across `src/core/guide/`, `product-display`, and `upsell` render as
  plain code — [`.claude/rules/guide.md`](../.claude/rules/guide.md) tells authors to draw
  diagrams, so the site should render them. **Use `@boneskull/typedoc-plugin-mermaid` with
  `"mermaidSource": "local"`** ([§8.1](#81-plugins--evaluated-2026-07-31)) rather than
  hand-vendoring `mermaid.min.js` under `docs/assets/`: local mode copies mermaid's ESM
  entry and chunk directory into `assets/mermaid/`, so the site still works offline (no
  CDN), and the plugin supplies the light/dark theme variants a hand-rolled `customJs` would
  have to write. It needs `mermaid` (`>=11`) as a devDependency.

  **Settled 2026-07-31 — the plugin does handle document pages.** The open question above
  (3 of the 4 blocks live in `projectDocuments`, and the README only documents TSDoc
  comments) was answered by building it: all four pages —
  `Core_Subsystems_Analytics`, `Core_Subsystems_Error_Handling`,
  `Features_Display_Product_Display_Overview`, `Features_Order_Upsell_Overview` — carry a
  `.mermaid-block` with a dark and a light diagram plus the source as a no-JS fallback.
  Phase 11 first shipped a hand-vendored `mermaid.min.js` instead; that is now **reverted in
  favour of the plugin**, deleting `docs/assets/vendor/` (3.5 MiB committed),
  `docs/assets/mermaid-init.snippet.js`, `scripts/docs-assets.mjs` (the whole script), the
  155-line spliced IIFE in `docs/assets/site.js`, and the vendor fallback in
  `docs-serve.mjs`. Two things the swap needed: `.mjs` in `docs-serve.mjs`'s MIME table (a
  module script served as `application/octet-stream` is refused by the browser), and CSS
  that spaces `.mermaid-block` rather than setting `display` on `.mermaid`, which the plugin
  drives with an inline style.

  **Cost, measured:** mermaid's ESM entry plus its 206 lazily-imported chunks is **+207
  files / +16 MiB per version folder that contains a diagram** — and only those: the plugin
  copies nothing when a build has no mermaid block, verified on `v0.4.30`, which produced
  none. The old vendoring copied 3.5 MiB into *every* folder unconditionally. Browsers still
  download only the chunks a diagram needs.

### Phase 12 — unhook developer-docs

- `scripts/docs-coverage.mjs`: delete `resolveDocsSite()` (~lines 490–500) and the
  informational "attributes mentioned somewhere on the docs site" metric (~lines 785–795).
  That is the last code path reaching into `../../developer-docs`.
- Rewrite the prose references: [CLAUDE.md](../CLAUDE.md),
  [`.claude/rules/documentation.md:30`](../.claude/rules/documentation.md),
  `.claude/skills/sdk-docs/SKILL.md` §5b, and mark
  [`redirect-map.md`](./redirect-map.md) historical.
- Mark superseded in this document: **§4** (7 doors → 4), **§5e** and **§5p** (redirects,
  the 62-file deletion), and §2's `next-validate-link` idea — `docs:check` replaces it.
- **Not our repo, not our task:** the 62 stale `data-attributes/` pages. Noted in §0
  item 2 and left there.

### Phase 13 — hosting (decided 2026-07-31)

**Target: Cloudflare Workers static assets.** Config lives in
[`docs/wrangler.jsonc`](./wrangler.jsonc); the site is assembled and checked by
[`scripts/docs-publish.mjs`](../scripts/docs-publish.mjs) (`npm run docs:publish`).

```
npm run docs:publish                # build every eligible tag, assemble, preflight
npm run docs:serve                  # read it at :3500 before anyone else does
npx wrangler deploy -c docs/wrangler.jsonc     # a human runs this, never an agent
```

**Why not Cloudflare Pages**, which is the product the name suggests: Pages caps a
deployment at **20,000 files on every plan**. Workers static assets allows 20,000 free /
**100,000 paid** (Wrangler >= 4.34.0), and 25 MiB per file on both.

Measured 2026-07-31, the whole `0.4` line — 31 tags — built end to end into `docs/site`:
**6,431 files, 213.8 MiB**, largest file 3.4 MiB. Either product fits *today* — a tag
build is ~200 pages, because no tag yet carries the current guide set. That stops being
true the moment one does: a working-tree build is **904 files**, so a run of releases at
that size reaches ~28,000 and Pages is out with no migration path. Picking the ceiling we
grow into rather than the one we grow out of. It also matches `developer-docs`, which
already deploys as an assets-only Worker, so there is one mechanism in the org, not two.

Note on the 213.8 MiB: ~109 of it was 32 copies of the 3.4 MiB vendored `mermaid.min.js`,
one per version folder plus `latest/`. **That is gone** — the mermaid plugin (§8.1) now
copies mermaid's ESM bundle only into folders that actually contain a diagram, and no tag
below the current one does. The trade is file *count*, not bandwidth: a diagram-carrying
folder gains 207 files, so a release folder goes from ~773 to ~980. Wrangler
content-addresses assets, so identical chunks upload once. Re-measure with
`npm run docs:publish` before assuming headroom against the 20,000-file free ceiling.

Measured after the swap (`docs:publish --versions 3 --free-plan`): **837 files, 13.9 MiB,
largest file 0.2 MiB** for the three newest tags plus `latest/` — where the largest file
used to be the 3.4 MiB mermaid bundle. None of those tags carries a diagram, so none
carries a mermaid chunk.

What `docs-publish.mjs` does that a bare `wrangler deploy` cannot:

1. **Builds every eligible tag** (`--skip-existing`, so a released tag is built once).
2. **Materialises `latest/` as a real directory copy.** Wrangler walks the asset tree with
   `lstat`, so a symlinked folder is not uploaded — the same caveat §8.1 flagged for
   GitHub Pages, and the reason `linkLatest()`'s symlink cannot be what ships. One extra
   copy of ~200 files is cheaper than being clever.
3. **Prunes the site root** to exactly the version folders, `latest/`, and the generated
   root files. `dev/` is built from the working tree and is never published; a plain
   `npm run docs` leaves a whole unversioned site at that root (`classes/`, `documents/`,
   ~900 files) which would otherwise ship describing no version in particular.
4. **Writes what Cloudflare reads**: `_headers` (one `/*` block — matching rules *merge*
   rather than override, so overlapping `Cache-Control` blocks would concatenate),
   `robots.txt`, and a `404.html` with root-absolute links, because a 404 body is served
   at the URL that missed and a relative link there resolves against nothing.
5. **Preflights the limits** — file count, 25 MiB per file, and any stray symlink — and
   fails before an upload does.

Fixed on the way through, and a standing constraint: `docs-build-version.mjs` resolves a
few `typedoc.json` options against *this* checkout rather than the tag's worktree, because
no tag has `docs/assets/` or `docs/site-home.md`. `readme` had just been added to
`typedoc.json` and was not in that list, which failed **every** tag build with
`Provided README path, docs/site-home.md could not be read` (exit 4). **Any new
`typedoc.json` option holding a path into `docs/` must be added to `ASSET_OPTIONS`** — the
symptom is total, not partial, so it is loud, but it is not obvious where to look.

Open, deliberately: **no hostname yet.** Without `--base-url` the build sets no
`hostedBaseUrl`, so there are no canonical URLs and no `sitemap.xml`, and `robots.txt`
disallows everything — a `workers.dev` hostname indexing 31 near-identical copies of the
same docs is worse than not being found. Re-run with `--base-url https://<host>` once the
name is picked; that flips `robots.txt` to indexing the current version folder (which is
what `latest/`'s canonical tags nominate) and excluding the older ones.

Still open from [Phase 10](#phase-10--versioning) item 7: **CI**. Nothing builds versions
automatically yet, and a CI job may build but must not publish. `npx wrangler` is on the
`permissions.deny` list in
[`.claude/settings.json`](../.claude/settings.json) alongside `wrangler`, so the deploy
step cannot be taken by an agent by accident.

### What §8 does not change

The manifests, the `src/docs/render/render-*.ts` generators, the 19 coverage metrics and
their ratchet, `npm run docs:reference`, the drift tests, and the guide format in
[`.claude/rules/guide.md`](../.claude/rules/guide.md) all stay exactly as shipped. **This
is a change of output target, not of content.** Every page the programme produced is
carried over — that is why option "one door" was chosen over an API-only site.

### Risks

- **URL shape is a one-way door.** Once a version is published the flat
  `documents/features_cart_…html` names are in customers' hands. Decide in Phase 9; do not
  revisit after Phase 10 ships.
- **Versioned builds from old tags are unproven.** Item 1 of Phase 10 is a prototype for
  exactly this reason; if a tag will not build, the fallback is to version only from the
  first tag that does and let older readers land on `latest` with a banner.
- **The default theme has no MDX components.** Verified: **0 of 354** markdown files use
  `<Callout>`, `<Tabs>`, `<Cards>` or `<Steps>` today. Add that constraint to the guide
  rules so it stays true.
- **8 s full rebuilds in watch mode** grow with the page count. Fine at 882.
- **One site, two audiences.** Publishing core alongside the author-facing guides risks a
  reader wandering into `AttributeScanner` internals. Mitigation is nav, not exclusion:
  core/state land under a clearly labelled contributor group, below Guides.

---

## 8a. Phases 8–12 as shipped (2026-07-31)

Five agents ran §8 in parallel (Phase 8, 9, 10, 11, 12), plus two follow-up jobs and the
lead holding the shared spine — `typedoc.json`, `package.json`,
[`docs-coverage.mjs`](../scripts/docs-coverage.mjs), and this plan. **The site exists and
builds clean.**

```bash
npm run docs         # typedoc → docs/site   (891 pages, 0 errors, 0 warnings, ~9s)
npm run docs:serve   # typedoc --watch + static server on :3500
npm run docs:check   # typedoc --treatWarningsAsErrors — the link gate
npm run docs:version -- v0.4.30   # one version folder, built from that tag
npm run docs:versions             # versions.json + the root redirect
```

Baseline after the run: `npm run type-check` clean · `npx vitest run src/tests/docs/`
596 pass · `npm run docs:coverage` **20 metrics at 100%**, empty baseline · docs build
**0 errors, 0 warnings**.

### What shipped, against what §8 predicted

| Phase | Predicted | Shipped |
|---|---|---|
| 8 | HTML config, Fumadocs pipeline deleted, serve script | Done. `scripts/typedoc-fumadocs.mjs` (108 lines) and `docs/api/` gone, both markdown plugins dropped, zero-dependency `scripts/docs-serve.mjs` |
| 9 | frontmatter nav, URL shape frozen, landing page | Done, by a **different mechanism** than planned — see below. 346 pages carry nav frontmatter; new [`src/docs/content/nav.ts`](../src/docs/content/nav.ts) is the one place it is written |
| 10 | versioning, tag-build prototype | Done. **The prototype worked**, further back than expected |
| 11 | `@internal` policy, README fix, mermaid | Done. All 24 tags removed; mermaid renders via `@boneskull/typedoc-plugin-mermaid` (`"mermaidSource": "local"`), as §8.1 prescribed — the hand-vendored bundle it shipped with first is gone |
| 12 | unhook developer-docs | Done. No code path or instruction file points at `../../developer-docs` |

### Nine things §8 got wrong, found by building it

1. **`children` frontmatter is the wrong tool.** With `projectDocuments` matching every
   guide file, a page named in `children` is emitted **twice**. The tree is built instead
   from a **path-shaped `title`** (`Features/Cart/Quantity Control/Attributes`), which
   needs no config change.
2. **`title` *is* the URL.** TypeDoc assigns `frontmatter.title` to the reflection name,
   and the router turns that into the filename. So renaming a title moves a published
   page — this, not the router option, is the URL-freeze lever Phase 9 was looking for.
   The `docs:coverage` gate now fails on a duplicate title for exactly this reason.
3. **The sidebar was never a "flat pile".** A document's name already defaulted to its
   path relative to `src`, so the tree existed with ugly labels and a redundant `guide`
   level. The count was **346**, not 354/347.
4. **`group` frontmatter is inert** while `categorizeByGroup: false`; only `category`
   renders. Both are written anyway, so flipping that option needs no doc change.
5. **Absolute links are not validated.** TypeDoc's `validation.invalidLink` checks
   *relative* paths only, so `](/docs/campaigns/…)` passes silently — `docs:check` cannot
   catch the next dead absolute link. The two dead Fumadocs links were found by grep, not
   by the gate.
6. **Missing `customCss`/`customJs` is a hard error**, not a warning: TypeDoc refuses to
   generate at all. Wiring those keys before the files exist breaks the build.
7. **TypeDoc copies no static assets** — `customCss`/`customJs` are the only files that
   travel. That first produced a `scripts/docs-assets.mjs` copy step, a repo-served
   `assets/vendor/**` fallback in `docs-serve.mjs` (TypeDoc clears the out directory, so
   `--watch` lost the bundle on the first rebuild), and a copy call in
   `docs-build-version.mjs`. **All three are deleted:** a plugin that needs a runtime asset
   copies its own, on every render, into every version folder it builds — which is what
   `@boneskull/typedoc-plugin-mermaid` does. The lesson is narrower than it looked: TypeDoc
   copies no static assets *of yours*, so reach for a plugin before a copy script.
8. **`@internal` in core hid nothing at all** — not "most", *all* 24. Every tag sat in a
   file-header block before the first `import`, which TypeDoc does not treat as a module
   comment. All 161 pages of `src/core/docs/**` were rendering regardless. **The lever
   left unpulled:** adding `@module` beside `@internal` makes the tag work, verified. It
   would drop those 161 pages — deliberately not done, because the manifest modules carry
   the best authoring TSDoc in the repo, which is what §8 decision 4 wants read.
   **Superseded by E1 (see §0):** `core/docs/` moved to `src/docs/`, which is no longer
   under the `src/core` entry point at all, so those ~161 pages (163 measured just before
   the move) stopped publishing outright rather than needing `@module` to hide them.
9. **The floor recipe in §8 Phase 10 gives a wrong answer.**
   `git log --diff-filter=A -- 'src/features/*/*/guide'` returns a `node_modules` chore
   commit. `git tag` is also denied to agents; `git for-each-ref --sort=v:refname
   refs/tags` is the working substitute, and the floor is found by counting guide files
   per tag.

### Versioning: the prototype worked, and exposed a real break

Building an old tag works — `git worktree add`, symlink `node_modules`, generate a config,
run TypeDoc. **0 TypeScript errors** compiling old sources against today's
`node_modules`, verified at `v0.4.30`, `v0.4.28`, `v0.4.3` and `v0.3.4`. §8's fallback
("version only from the first tag that builds") is not needed.

**Floor: `v0.4.0`** — the whole `0.4` line (Bond, 2026-07-31). It is a parameter
(`VERSION_FLOOR`, `--floor`), not a constant.

It was briefly `v0.4.3`, the first release with a real guide set (97 files; `v0.4.2` has
3, everything older has none), on the argument that an API-only site with an empty Guides
tree is worse than the stale banner. Overruled: those are still the truthful docs for a
page pinned to `v0.4.0`, and publishing per tag is what makes that true. Measured cost of
the three extra tags — `v0.4.0` and `v0.4.1` build **0** document pages, `v0.4.2` builds
3, ~110 files each. `v0.3.x` stays out.

Three blockers §8 did not anticipate, all solved in
[`docs-build-version.mjs`](../scripts/docs-build-version.mjs):

- **No released tag has a `typedoc.json`** — the config is generated per build.
- **Released tags have a different source layout.** At `v0.4.30` the guides live under
  `src/enhancers/**` + `src/stores/**` (98 files); at HEAD they live under
  `src/features/**` + `src/state/**` (346). A `LAYOUTS` table carries both generations.
- **TypeDoc resolves relative option paths against the options file, not the cwd** — every
  generated path is absolute.

**The URL break to decide before the first publish.** Because titles are path-shaped and
the layout was renamed, `v0.4.30` publishes
`documents/enhancers_cart_AddToCart_guide_overview.html` while the next release publishes
`documents/Features_Cart_Add_to_Cart_Overview.html`. **Every guide page changes URL once,
at the next release**, and the page count roughly triples (98 → 346). The version
switcher already falls back to the target version's index when a page does not exist
there, so it degrades rather than 404s — but the break is real and it is one-time.

`hostedBaseUrl` is **opt-in** (`--base-url` / `$DOCS_BASE_URL`), not defaulted: there is
no public URL yet, and inventing one bakes a wrong `<link rel=canonical>` into every page.
That is the one manual input a publish still needs.

### Known limitations, recorded rather than papered over

- **Sidebar order inside a feature is alphabetical** — `Get Started`, `Glossary`,
  `Overview`, … rather than reading order. Not fixable from frontmatter. Ordering the
  `projectDocuments` globs **duplicates pages** (891 → 1045; TypeDoc does not dedupe
  across globs) and negation patterns (`!…`) make the build fail outright — both measured.
  The remaining options are a file-name convention or `router: "structure"`, and neither is
  worth a URL change on its own.
- **`router: "structure"`** would give directory-shaped URLs but also flattens API pages
  out of `interfaces/`, `classes/`, … — a whole-site decision that must be made **before**
  a version is published.
- **Entry-point asymmetry:** `src/state/**/*.state-manifest.ts` publish as modules (because
  `src/state` is an entry point) while `src/features/**/*.manifest.ts` do not.
- **`docs/site/latest` is a symlink**, with a copy fallback only when `symlinkSync` throws.
  Some archive tooling and static hosts will not follow it.

### Beyond the agreed scope, left in place

`scripts/docs-publish.mjs` + `docs/wrangler.jsonc` assemble the full multi-version site,
write `_headers` / `robots.txt` / `404.html`, and check the file count against
Cloudflare's ceiling (Workers static assets, because Pages caps a deployment at 20,000
files on every plan and a run of releases at today's working-tree size — ~904 files each —
passes that; see [Phase 13](#phase-13--hosting-decided-2026-07-31)). **It never deploys** —
it prints the
`npx wrangler deploy -c docs/wrangler.jsonc` command for a human, because deploying is
never an agent's step to take. This goes past §8
decision 3 ("local dev server only"); it is kept because it is inert until a human runs
that command, and hosting is still an open decision.

---

## 8b. The follow-up round (2026-07-31, same day)

§8a closed the phases. This round closed the defects §8a's own agents reported, in five
parallel jobs plus the lead. **Nothing here was a new feature — it was the bill for the
site change**, and two items turned out to be live corruption rather than tidy-ups.

Baseline after the round: `type-check` clean · `npx vitest run` **61 files, 1574 passed /
211 skipped** · `npm run docs` **0 errors, 0 warnings**, 882 pages · `npm run docs:check`
passes · `npm run docs:coverage` **20 metrics at 100%**, empty baseline.

### Two gates added, both proven to fire

| Gate | Catches | Why the build could not |
|---|---|---|
| **Site-absolute links** (`docs-coverage.mjs`) | any `](/…)` in guide markdown, TSDoc, or the `docs/` index pages | TypeDoc's `validation.invalidLink` resolves **relative** paths only, so three dead Fumadocs links had already shipped past it |
| **Duplicate nav titles + sibling prefixes** | two pages claiming one URL; a page whose title puts it in the wrong subtree | `title` *is* the filename, and nothing else checks it |

Both are **outside the ratchet** — they are not gaps to document later, they are the
published URL surface breaking, so they cannot be frozen into the baseline. Each was
verified by deliberately breaking the tree and watching the gate fail.

`npm run docs:check` also joined CI (`.github/workflows/build.yml`), after `docs:coverage`
and before `build`. Lint is still **not** in CI — 12,406 errors would make it red on the
first run; that decision is still §0 item 1.

### The unescaped-pipe corruption — 16 rows, live

Looking for `{@link}` damage turned up a different bug in the generated tables: a union
type or description containing `|` was interpolated raw, so the markdown row silently lost
its last column. **16 rows across 10 pages** — `events.md` for package-selector,
express-checkout-container and upsell; `attributes.md` for package-selector,
package-toggle, cart-item-list, prospect-cart, accordion and quantity-text. A reader saw a
table with a missing description, not an error.

Fixed by giving `render-feature-reference.ts` the `cell()` escape helper its sibling
renderers already had, and escaping one hand-authored pipe in a manifest
(`{bottle|bottles}`). Verified zero unescaped pipes inside any table code span across all
346 pages.

### The `{@link}` blind spot, in three places

`ts.JSDocLink` keeps the symbol in `name` and only the trailing text in `text`, so any
reader that inspects `text` alone loses the link:

- `src/tests/docs/extract-event-docs.ts` — `{@link Foo}` rendered as **nothing**,
  `{@link Foo | label}` left a stray `|` that broke its own table row. `exampleOf` had the
  same defect. A URL link is a fourth shape (`name` is the *scheme*, `https`).
- `scripts/docs-coverage.mjs` — an `EventMap` summary written purely as a link scored as
  **undocumented**, so the gate would demand prose that was already there.

Both fixed, with a regression test (`src/tests/docs/extractEventDocs.test.ts`, 4 tests,
confirmed failing 3/4 against the old extractor). No committed guide had been corrupted by
this one — the author who hit it had worked around it with `@remarks`.

### `Order` vs `OrderData`, resolved without a breaking change

`OrderData` was not a curated public view of an order — it was a lossy copy: six fields
identical to `Order`, two degraded to `any` (`lines`, `user`), and **15 fields simply
missing**, while every API path and every `order:completed` emit site hands over a full
`Order`.

`Order`, `OrderLine`, `OrderUser`, `OrderAddress` and `MarketingAttribution` are now
exported and documented, and `OrderData` is `Pick<Order, …>` with its six members
redeclared — so **tsc now rejects drift between the two** and the emitted `.d.ts` keeps the
same eight members with the same types. **Not breaking**, verified against the built
declarations.

What was deliberately *not* done, because it would break a customer's compile:

- `type OrderData = Order` (the finding's own suggestion) adds 15 required fields.
- Retyping `EventMap['order:completed']` as `Order` is safe for subscribers
  (contravariance) but breaks `EventBus.emit`, which is exported.

Both are documented where a reader meets them instead: `OrderData`'s summary and the
event's `@remarks` say the declared payload is the guaranteed six fields while the
delivered object is a full `Order`.

### Smaller items, and one that was ten times bigger than reported

- **`order-manager.ts` had 24 raw `console.*` calls, not the 3 reported.** 17 breadcrumbs
  became `logger.debug`; 7 `console.error`s were **removed** because each sat directly
  above an equivalent `logger.error`. Safe because `logger.error` has an explicit
  always-log path (`core/logger.ts:52`) — production error visibility is unchanged, while
  the debug breadcrumbs now correctly go silent there.
- **8 stale post-rename paths** in guides (`src/stores/…`, `src/enhancers/…`). Half were
  found only by searching the `@/stores/…` **alias** form, which a `src/…` search misses.
- **Manifest publishing asymmetry** resolved by excluding both families: their content
  already ships as guide pages, so the raw module pages were worse-formatted duplicates.
  882 pages, down from 896.
- `.claude/rules/testing.md` cited `src/test/setup.ts`; `vitest.config.ts` registers
  `src/tests/setup.ts`. `.gitignore` gained `.wrangler/`.
- `.claude/rules/documentation.md` now carries the rules the gates enforce: **`title` is
  the URL** (renaming moves a published page, duplicates are rejected), `children`
  frontmatter double-emits, and no site-absolute links.

Findings **80–91** went to [code-findings.md](./code-findings.md). Two claims in them were
corrected while being written: five of nine "duplicate types" were double-counting an
existing finding (they pair against `types/cart.ts`, which has **zero importers**), and
`User`/`OrderUser` are not a duplicate name at all — two names, identical fields. The real
new duplication is `Package`, `Campaign` and `ShippingOption`.

### `playground/` removed (Bond, 2026-07-31)

Deleted on request. It was a **nested git repo with no remote and no `.gitmodules`** — an
orphan gitlink whose 2 commits existed only on Bond's disk, so a plain delete would have
been unrecoverable and a fresh clone of the parent never fetched it anyway. Archived first
to `campaign-cart-playground-archive-2026-07-31.bundle` (**112 KB**, from 1.1 GB on disk —
746 MB `node_modules` + 293 MB `.next`, 616 KB of actual source), `git bundle verify`
clean, and **test-restored before** the `rm`. Restore with
`git clone <bundle> playground`.

References removed from `.eslintrc.json` and `.prettierignore`. Two look related and are
not: `vite.config.ts:336` opens the *hosted* `developers.29next.com/playground/`, and
`.claude/settings.local.json` points at `docs/content/playground/example/*.html`. Nothing
in build, test, docs or CI depended on the directory.

### Still open — decisions, not work

1. **The URL break at the next release** (§8a) — unchanged and still the one to settle
   before publishing a version.
2. **Hosting**: no hostname, so no canonical URLs, no sitemap, and `robots.txt` disallows
   everything.
3. **Lint** (§0 item 1): 13,615 problems, 7,432 auto-fixable, still absent from CI.
4. **The vendored mermaid bundle** is 3.5 MB for 4 diagram pages (lazy-loaded, so the cost
   is repo size).
5. **`render-html-custom-data.ts`** still points VS Code hovers at the retired
   `developers.nextcommerce.com` — blocked on item 2.
