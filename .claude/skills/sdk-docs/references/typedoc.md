# TypeDoc authoring reference

How TSDoc in this repo becomes pages on the docs site. Config:
[`typedoc.json`](../../../../typedoc.json). Companion to [`SKILL.md`](../SKILL.md) §5b.

## What gets published

```jsonc
"entryPoints": ["src/index.ts", "src/core", "src/state"],
"entryPointStrategy": "expand"
```

Three entry points, not one. `expand` means each folder is walked and **every file
becomes its own module page** — so a TSDoc comment anywhere in `src/core` or
`src/state` is published, not just the `src/index.ts` surface.

That splits the audience, and the split decides where you write:

| Reader | Reads | So write there |
|---|---|---|
| Integrator — "what do I call?" | `src/index.ts` API pages | TSDoc on the public export |
| Contributor — "how is this built?" | `core/` + `state/` symbol pages | TSDoc on the class/function |
| Page author — "how do I use the SDK?" | `src/core/guide/` markdown | the guide, **never** a class page |

An author does not browse class pages. Boot order, meta tags, storage TTLs and
the rest stay in `src/core/guide/`, even though the classes behind them now
publish. Putting author-facing explanation in a TSDoc comment hides it.

Excluded: `**/*.test.ts`, `**/tests/**`, `**/*.manifest.ts`,
`**/*.state-manifest.ts`, plus `excludePrivate` / `excludeInternal` /
`excludeExternals`.

`src/features/**` is **not** an entry point — features are documented through
their `guide/` folders, which are pulled in as `projectDocuments`.

## Tags — what is actually used

Counts are real (`grep` over `src/`), so they tell you the house style:

| Tag | Uses | Notes |
|---|---|---|
| `{@link}` | 415 | The cross-reference. A broken one **fails `docs:check`** — see below. |
| `@example` | 206 | Expected on every public method/attribute. |
| `@category` | 142 | Sidebar grouping. Drifting — see below. |
| `@param` | 104 | Only where the name alone is not enough. |
| `@inheritDoc` | 63 | A thin orchestrator reuses its handler/renderer's prose. Write it once. |
| `@deprecated` | 34 | Renders a banner. Always say what replaces it. |
| `@returns` | 18 | Skip when the summary already says it. |
| `@internal` | 14 | Hides a symbol (`excludeInternal: true`). |
| `@see` | 3–4 | Prefer an inline `{@link}` in prose. |
| `@remarks` | 3 | Rare here; extra detail below the summary. |
| `@packageDocumentation` | 1 | `src/index.ts` — the site homepage intro. |
| `@throws` `@defaultValue` `@group` `@typeParam` | **0** | Not house style. `@group` especially: `categorizeByGroup: false`, so `@category` is the grouping axis — using `@group` would create a second, competing one. |

### A `@category`-only block documents nothing

```ts
/** @category Cart */          // ✗ files it under a heading, tells the reader nothing
export function addItem() {}
```

This is exactly what `extract-next-methods.ts`'s `hasSummary` flag exists to
catch: a block with no sentence of its own publishes no documentation, however
many tags it carries. Lead with a sentence; tags are metadata, not content.

### `{@link}` vs a relative link

- **Symbol → `{@link ExportedName}`.** Resolves anywhere, survives file moves.
- **Document → a relative `.md` path**, e.g. a markdown link whose target is
  `./get-started.md`.
- **Never a site-absolute path** — a target starting with `/`. The site has no
  absolute routes; TypeDoc's own checker resolves relative paths only and cannot
  see them, so `docs:coverage` fails on them instead.

`"validation": { "invalidLink": true }` plus `docs:check`'s
`--treatWarningsAsErrors` means an unresolvable `{@link}` is a **build failure**,
not a warning. That is the one TypeDoc gate that bites.

### What is *not* gated

```jsonc
"validation": { "notDocumented": false, "notExported": false }
```

**Missing TSDoc never fails anything.** No gate asks whether a public export has a
comment. Coverage is enforced only by `npm run docs:coverage` (attributes,
`EventMap` TSDoc, guide pages, tested examples, nav frontmatter) and the drift
tests in `src/tests/docs/`. So "the build is green" says nothing about whether you
documented the thing you just exported.

## `@category` — the live drift

`categorizeByGroup: false`, so categories are the sidebar's top-level axis and
`categoryOrder` in `typedoc.json` fixes their order. Anything not listed falls
into the trailing `*` bucket in arbitrary order.

Today they disagree, and **nothing checks it**:

| | Categories |
|---|---|
| Ordered **and** used | `Cart` `Campaign` `Events` `Shipping` `Coupons` `Analytics` |
| Used but **unordered** → `*` | `URL Parameters` (16) `Upsells` (8) `Popups` (8) `Metadata` (8) `Utility` (6) `Attribution` (6) `Core` (2) |
| Ordered but **never used** | `SDK` `Stores` `Advanced` |

That is **54 of 129** tagged symbols — 42% — landing in the catch-all. When you add
a `@category`, either use one already in `categoryOrder` or add it there in the
same change. Check with:

```bash
grep -rhE "^\s*\*?\s*@category\s+\S" src | sed -E 's/^\s*\*?\s*@category\s+//' | sort | uniq -c | sort -rn
```

## Diagrams

A ` ```mermaid ` fenced block works **inside a TSDoc comment**, not just in guide
markdown — `@boneskull/typedoc-plugin-mermaid` with `mermaidSource: "local"`
renders it in the reader's theme, and JavaScript-off readers still see the source.
Never commit a rendered image.

## Other config worth knowing

- **`sort: ["source-order"]`** — members appear in the order they are written in
  the file, not alphabetically. Reordering a class reorders its page, so put the
  member a reader needs first, first.
- **`gitRevision: "main"`** — every "Defined in" source link points at `main`. A
  symbol only on your branch links to a path that 404s until merge.
- **`projectDocuments`** pulls in `src/features/**/guide/**`, `src/state/**/guide/**`,
  `src/core/guide/**`, plus `docs/attribute-index.md` and `docs/sdk-attributes.md`.
  A guide file outside those globs is simply not published.
- **`readme: docs/site-home.md`** is the landing page — not the repo README.
- **`typedoc-plugin-llms-txt`** emits `docs/site/llms.txt` on every build, so the
  site is machine-readable for agents. Nothing to maintain by hand.
- **`typedoc-plugin-mdn-links`** turns built-in types (`Promise`, `HTMLElement`)
  into MDN links automatically — don't hand-write those links.

## Commands

```bash
npm run docs          # build → docs/site
npm run docs:serve    # preview on :3500, watches sources
npm run docs:check    # build with warnings as errors — the link gate
npm run docs:coverage # the documentation-gap ratchet
npm run docs:reference # regenerate the generated pages (UPDATE_DOCS=1 vitest src/tests/docs/)
```

`docs/site/` is generated and gitignored — never hand-edit it.
