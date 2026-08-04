---
name: sdk-docs
description: >-
  Documentation methodology for the Campaign Cart SDK — how to write docs a
  newcomer can actually use. Load when writing or updating ANY docs: the feature
  catalog, per-feature guide/ docs, state/store reference docs, folder READMEs,
  TSDoc/TypeDoc comments, or the TypeDoc HTML docs site. Organized around
  the four questions every reader asks: (1) what features does the SDK have,
  (2) how does it work, (3) what is the state — schema, operations, fields, and
  what the data looks like, (4) what do I need to watch out for. Carries the
  reader-question → doc-layer map, the feature-catalog and state-reference
  templates, the "cautions" standard, and the cross-link / no-duplicate rules.
  Also owns the TypeDoc authoring reference — entry points and who reads each,
  the tag inventory and house style, @category ordering, which TypeDoc warnings
  are build failures and which gaps nothing catches. Pairs with the sdk-structure
  skill (where code lives) and .claude/rules/guide.md (per-feature guide format).
---

# SDK Docs

How to document the Campaign Cart SDK so someone who has never seen it can learn
what it does, how it works, and how to use it safely — without reading the source.

> **North star:** write for the reader's *questions*, not the code's *shape*.
> A reference grouped by TypeScript kind (Classes / Interfaces) fails this;
> a reference grouped by task (Cart / Campaign / Events) passes it.

## 0. The four questions every doc must serve

Every reader — new dev, integrator, someone debugging prod — arrives with some
mix of these. Each has a home; know which doc answers which.

| The reader asks… | Answered by | Format |
|---|---|---|
| **1. What can this SDK do?** (what features exist, which are core) | **Feature catalog** (`docs`/README index) | §1 + `references/feature-catalog.md` |
| **2. How does *this* feature work?** | Per-feature **`guide/`** | `.claude/rules/guide.md` |
| **3. What is the state?** schema, fields, operations, example data | **State reference** (per store) | §3 + `references/state-reference.md` |
| **4. What do I import / call exactly?** | **TypeDoc** (TSDoc → API pages) | §5c + `references/typedoc.md` |
| **5. What do I watch out for?** | a **Cautions** block in *every* doc above | §4 |

Do not answer a question in the wrong layer (e.g. don't bury "what features
exist" inside a TypeDoc class page). Cross-link; never duplicate (§5).

## 1. Feature catalog — "what does the SDK do?"

The first thing a newcomer wants is a **map of capabilities**, not an alphabetical
class list. Maintain a single catalog that lists every feature, one line each,
grouped by category, with the activating `data-next-*` attribute and a "core vs
optional" marker. Source of truth for categories: `src/features/README.md`.

Each entry answers, in one line: *what problem it solves* + *how it's turned on*.

```md
### Cart  (core)
- **Add to cart** — `data-next-action="add-to-cart"` — adds a package to the cart.
- **Package selector** — `data-next-selector-id` — pick one package from a group.
- **Quantity control** — `data-next-quantity` — +/- an item's quantity. (optional)
```

Rules:
- **Mark core vs optional.** A reader must see the ~5 features that matter first.
- **Lead with the attribute**, since that is how the feature is actually used.
- Link each entry to its `guide/overview.md`.
- Keep it flat and scannable — this is an index, not a tutorial.

## 2. How it works — the mental model

Before the per-feature detail, one page explains the **activation model** so the
rest makes sense: HTML gets `data-next-*` attributes → `SDKInitializer` boots on
`DOMContentLoaded` → `AttributeScanner` finds elements and instantiates the bound
feature → features read/write `state/` → `state` changes emit events → other
features/analytics react. Include one diagram. (Concept, not API.) This is the
`overview.md` "Concept" section scaled to the whole SDK — put it on the docs
homepage / `core/README.md`, and let feature guides assume it.

## 3. State reference — "what is the state?"

This is the layer most often missing. For **each store** a reader needs four
things, in this order. Full template: `references/state-reference.md`.

1. **What it holds** — one sentence in product terms (not "a Zustand store").
2. **Schema** — every field: name, type, nullable?, and **business meaning**
   (not just the type). Note computed vs. persisted vs. transient.
3. **Operations** — what you can *do*: the async operations (`sdk.cart.*` /
   `cartOperations`), the sync setters, and the selectors/getters — each with
   one line on effect. Say which layer to call (facade vs. store).
4. **Example data** — a realistic JSON snapshot so the shape is concrete.
5. **Cautions** (§4) — persist key, `.data` gotcha, thin-state, TTL, etc.

Reader-language rules (same spirit as `guide.md`):
- Field descriptions use **business language** and explain nullability in
  product terms ("`null` means shipping not chosen yet").
- Distinguish **read** (fields/selectors) from **write** (operations/setters) —
  a reader must know what mutates state and through which layer.
- The store's async surface is **deprecated in favor of `sdk.cart.*`** — document
  the blessed path first, note the store delegators as legacy.

## 4. Cautions — "what do I watch out for?"

Every catalog entry, feature guide, and state reference ends with a **Cautions**
block. Vague warnings are useless; be specific and name the failure.

- State the trap, the symptom, and the fix. ("Renaming a `persist` key wipes live
  carts → sessions reset silently → never rename; add a new field instead.")
- Pull the durable, cross-cutting traps from the **sdk-structure**
  `references/behavior-contracts.md` (`.data` not `.campaign`, `super.destroy()`
  first, template re-render safety, swap-vs-select double-writes, persist keys)
  and cite them where they bite — don't restate them wholesale.
- If a feature has no real caution, say "None beyond the standard contracts" —
  don't invent filler.

## 5. Cross-link, never duplicate

- One fact lives in one place; everywhere else links to it. The feature catalog
  links to guides; guides link to the state reference and TypeDoc; the state
  reference links to `sdk.cart.*` in TypeDoc.
- **TypeDoc = the exact API lookup**, grouped by task via `@category`. It is *not*
  where you explain concepts or list features — that's the catalog/guides. Full
  authoring rules in [`references/typedoc.md`](./references/typedoc.md).
- **Three entry points, not one:** `src/index.ts`, `src/core`, `src/state`, with
  `entryPointStrategy: "expand"`. Every file under `core/` and `state/` publishes
  its own module page, so their TSDoc reaches a reader. `src/features/**` is
  *not* an entry point — features publish through their `guide/` folders.
- **`src/core` has its own guide** — [`src/core/guide/`](../../../src/core/guide/):
  a landing page, 11 subsystem overviews under `subsystems/`, and 10 generated
  reference pages under `reference/` (boot order, meta tags, URL parameters,
  storage keys and TTLs, the `window.next` API, the `window` surface, logs,
  errors, the analytics catalogue and the provider matrix). The inventory that
  drives it is [`docs/content/core-subsystems.ts`](../../../src/docs/content/core-subsystems.ts).
  Its unit of documentation is the **contract a page depends on**, not the class —
  a contract, because by-file and by-symbol both cut across the thing a page
  actually depends on.
- **Core TSDoc now reaches a reader.** `src/core` (and `src/state`) is a TypeDoc
  entry point, so its exported symbols render as real pages on the docs site —
  for **contributors** browsing classes/interfaces. That does not change where
  *author-facing* explanations live: an author reads `src/core/guide/` markdown,
  not a class page, so behaviour like boot order, meta tags, and storage TTLs
  stays documented there, not in comments. (Core is **not** excluded by
  `@internal` tags — there are none on any exported declaration there.
  `src/core/README.md` claimed otherwise until 2026-07-31.)
- When code changes, update the doc in the **same change** (the sync rule in
  `.claude/rules/guide.md` applies to all these layers, not just guides).

## 5b. Publishing to the docs site

The docs site is a single **versioned TypeDoc HTML build** (`npm run docs` →
`docs/site`; `npm run docs:serve` to preview on :3500; `npm run docs:check` as
the link gate, CI-ready). It renders code TSDoc and `guide/` markdown as one set
of pages. Write **one** guide per feature that reads well for everyone — do NOT
fork it into "external" vs "internal" versions. A newcomer and a maintainer read
the same page; put the simple usage first and the depth below it.

| Source | Renders as | Answers |
|---|---|---|
| Code TSDoc (`src/index.ts`, `src/core`, `src/state` entry points) | API reference pages | "what fields/methods does X have?" |
| `src/.../guide/*.md` markdown | Feature guide pages | "what is this feature and how do I use it?" |

- **One page tree per feature, simple-first.** A feature's guide reads
  `overview` → `get-started` → `use-cases` → `relations` → `glossary` →
  `reference/*`, in that order, on the site. No external/internal split.
- **Guide markdown must stay plain markdown.** TypeDoc's theme has no MDX
  components — `<Callout>`, `<Tabs>`, `<Cards>`, `<Steps>` are not supported.
  Relative `.md` links between guides render correctly as-is; keep samples
  inside ordinary fenced code blocks.
- **Diagrams: a ` ```mermaid ` fenced block, nothing else.** It renders as a real
  diagram, in the reader's light or dark theme, in guide pages *and* in TSDoc
  comments — `@boneskull/typedoc-plugin-mermaid` handles it, and readers with
  JavaScript off still see the source. Write the diagram in the markdown; never
  commit a rendered image or add site JavaScript for it.
- **Frontmatter drives the nav.** `title`, `group`, `category`, and `children`
  on a document decide its place in the sidebar — a new hand-written page needs
  this frontmatter or it will not appear in the tree.
- **`docs/site/` is gitignored and generated** — never hand-edit it; change the
  source (TSDoc or guide markdown) and rebuild with `npm run docs`.
- **What readers see is a tag, not your branch.** `npm run docs:publish` builds
  one folder per released tag into `docs/site`, points `latest/` at the newest,
  and preflights Cloudflare's asset limits
  ([`docs/wrangler.jsonc`](../../../docs/wrangler.jsonc)). It never deploys — the
  `wrangler deploy` step is Bond's. Your guide reaches readers when its release
  is tagged. It also publishes `main/` from the `main` branch tip
  (`npm run docs:main`) — merged-but-untagged docs, noindex, not a version entry,
  and never `latest/`. `dev/` (`--dev`) stays local and is pruned at publish.

## 5c. TSDoc that publishes well

Full reference — every tag, the config, the gates:
[`references/typedoc.md`](./references/typedoc.md). The five that matter most:

- **Lead with a sentence. A tags-only block documents nothing.**
  `/** @category Cart */` files a symbol under a heading and tells the reader
  nothing — which is precisely what `extract-next-methods.ts`'s `hasSummary` flag
  exists to detect. Tags are metadata, not content.
- **Nothing fails when you forget.** `validation.notDocumented` is `false`, so no
  gate asks whether a public export has a comment. A green build says nothing
  about whether you documented what you just exported — that judgement is yours.
- **A broken `{@link}` *is* a build failure.** `validation.invalidLink` plus
  `docs:check --treatWarningsAsErrors` turns it into an error. Use `{@link Name}`
  for symbols, a relative `.md` path for documents, and never a site-absolute
  `](/…)` path.
- **`@category` must exist in `categoryOrder`** (`typedoc.json`), or the symbol
  lands in the unordered `*` bucket. Add it to the config in the same change —
  `src/tests/docs/categoryOrder.test.ts` fails both ways (unordered category, and
  a listed category nothing tags).
- **Match the house style, which is narrow**: `{@link}`, `@example`, `@category`,
  `@param`, `@inheritDoc`, `@deprecated`, `@returns`, and `@internal`. `@throws`,
  `@defaultValue` and `@group` have **zero** uses — `@group` in particular would
  fight `@category`, since `categorizeByGroup` is `false`.

Write for the audience the entry point implies: `src/index.ts` TSDoc is read by
integrators, `core/`/`state/` symbol pages by contributors, and page authors read
`src/core/guide/` markdown instead of either. Author-facing behaviour in a class
comment is hidden from the person who needs it.

## 6. Writing style (applies everywhere)

- Answer the question in the first sentence; detail after.
- No jargon a newcomer wouldn't know without defining it (link the glossary).
- Every public method/attribute gets a runnable `@example` — the single biggest
  readability win.
- Forbidden words: "simple", "easy", "just", "straightforward". Forbidden shapes:
  a wall of types with no overview; a class page used as a feature list; a
  caution with no fix.
