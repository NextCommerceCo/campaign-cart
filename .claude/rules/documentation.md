# Documentation Rules

Applies to **every** doc in this repo: TSDoc/TypeDoc comments, per-feature
`guide/` docs, folder `README.md`s, and the TypeDoc HTML docs site
(`npm run docs` → `docs/site`).

> How to *write* docs well (templates, the four reader questions, cautions,
> cross-linking) lives in the **`sdk-docs` skill** — invoke it whenever you write
> or change docs. Per-feature `guide/` format lives in
> [.claude/rules/guide.md](./guide.md). This file is the short, non-negotiable
> **policy**: docs ship with the code, and they must be readable.

---

## 1. Docs ship with the code (Definition of Done)

A code change is **not done** until its docs are updated **in the same change** —
not a follow-up, not a TODO, not "later". If you change behavior but not the
docs, the change is incomplete.

What a change touches → what you update, together:

| You changed… | Update in the same change |
|---|---|
| A public export in `src/index.ts` (type, method, store) | its **TSDoc** — summary + `@example` + `@category` |
| A data shape / interface / event payload | its **TSDoc** in `src/types/*` (top summary + per-field) |
| An enhancer's attribute, event, error, log, or business rule | its **`guide/`** — see the sync table in [guide.md](./guide.md) |
| A new feature / a feature's activating `data-next-*` | its **`guide/`** (new feature → scaffold the full set) |
| What a `state/`, `core/`, or `features/` folder holds | that folder's **`README.md`** |

The docs site is a **versioned TypeDoc HTML build** of these same sources — TSDoc,
`guide/` markdown, and state references all render as pages via `npm run docs`
(→ `docs/site`; `npm run docs:serve` to preview on :3500). Updating the source
*is* updating the site — never hand-edit `docs/site` (gitignored, generated). See
the `sdk-docs` skill §5b.

**Published docs describe a *tag*, not your working tree.** `npm run docs:publish`
builds one folder per released tag and checks it against Cloudflare's asset limits
([`docs/wrangler.jsonc`](../../docs/wrangler.jsonc)); it stops short of deploying,
which stays a human's command. So a doc fix reaches readers when the release that
carries it is tagged — not when it lands on a branch. The one exception is `main/`,
the unreleased folder built from the `main` branch tip (`npm run docs:main`): it
carries merged-but-untagged docs, is not a version entry, and is never indexed. It
does not make a doc fix "published" — a reader on a pinned SDK still reads the tag
they load. See [documentation-plan.md §8c](../../docs/documentation-plan.md).

**Guide markdown must stay plain markdown.** The TypeDoc theme has no MDX
components — `<Callout>`, `<Tabs>`, `<Cards>`, `<Steps>` render as literal text,
not widgets. Do not introduce them (0 of 354 files use them today; keep it that
way).

**Frontmatter drives the site nav — and `title` is the URL.** `title`, `group` and
`category` on a document decide where it sits in the sidebar, and TypeDoc turns
`title` into the page's filename: `Features/Cart/Quantity Control/Attributes`
lands at `documents/Features_Cart_Quantity_Control_Attributes.html`. Three
consequences, all enforced by `npm run docs:coverage`:

- A hand-written guide page **needs** frontmatter, or it publishes as an orphan
  outside the tree. Generated pages get theirs from
  [`src/docs/content/nav.ts`](../../src/docs/content/nav.ts) — the one place it is written.
- **Renaming a `title` moves a published page.** Treat it as a breaking change to
  customer links, not a cosmetic edit.
- **Two pages may not share a title** — that is two pages claiming one URL, and one
  silently wins. The gate fails on it, and it cannot be frozen into the baseline.

Do not use `children` frontmatter: with the current `projectDocuments` globs it
emits the named page twice.

**No site-absolute links.** `](/docs/campaigns/…)` and any other `](/…)` are dead —
the site has no absolute routes. TypeDoc's own link check cannot see them (it
resolves relative paths only), so `npm run docs:coverage` fails on them instead.
Link a relative path to the target `.md`, or use `{@link ExportedName}`.

**Never cite a source line number in anything generated.** A line is a property of the
file's *formatting*, not of the code, so a generated page that embeds one is coupled to
whitespace: one blank line in `sdk-initializer.ts` once rewrote 30 anchors in
`core/guide/reference/logs.md` and failed two drift tests. That is what made
`npm run format` unrunnable for months. Cite the **enclosing symbol** instead, through the
one helper that owns the format —
[`src/docs/extract/source-anchor.ts`](../../src/docs/extract/source-anchor.ts):

- `anchorOf(sf, node, file)` → `core/sdk-initializer.ts › SDKInitializer.initialize`
- `anchor(file, symbol)` when you already resolved the symbol
- `fileOf(anchor)` to read the file back out — **never `split(':')`**, which silently
  returns the whole string once the format changes

Two consequences when you add or change an extractor. **A symbol is not unique the way a
line was**, so any dedupe or sort keyed on the anchor has to widen: two call sites in one
method are now one anchor, and a key that was `(file, line)` must become
`(file, symbol, …whatever else distinguishes the rows)` or the page silently drops them.
And a line number is still right in an **assertion failure message** — that is a developer
finding a call site, not a published page.

**Hand-written prose is gated too, as of 2026-07-31.**
[`src/tests/docs/sourceReferences.test.ts`](../../src/tests/docs/sourceReferences.test.ts)
reads every citation in `src/docs/content/*.ts`, `src/docs/render/*.ts` and
`src/core/guide/subsystems/*.md` and asserts:

- **the cited file exists** — this is what catches a move. It had to be written because
  relocating `checkout-form.enhancer.ts` left a subsystem page citing a path that was
  simply gone, with every other gate green.
- **the cited symbol is really in that file** — this is what catches a rename.
- **no line-number citations at all.** This began as a ratchet at the 79 that existed
  when the gate was written; all 79 were converted, so it is now a flat ban. A line
  number can get the file check but never the symbol check, so every citation in these
  files is now checkable and none can silently rot.

Two things the gate cannot do, so they stay on you: it proves the symbol *exists* in the
file, not that it is the *right* symbol for the claim; and a bare basename
(`dom-observer.ts`) resolves only while it is unique across `src/` — an ambiguous one is
reported rather than guessed.

## 2. Write so a newcomer understands (readability bar)

Docs are for the reader, not the compiler. Every doc must clear this bar:

- **Answer the question in the first sentence.** What is this / what does it do —
  then the detail.
- **Plain language.** No term a newcomer wouldn't know without defining it (link
  the glossary). Say it in product terms, not "wraps `FooEnhancer`".
- **A runnable example** on every public method/attribute — the single biggest
  readability win. No `...` placeholders; use real values or clear `{TOKENS}`.
- **Every caution names the trap, the symptom, and the fix.** A warning with no
  fix is noise.
- **No wall of types with no overview**, no class/kind page used as a feature
  list. Group by task/shape, not by TypeScript kind.
- **Forbidden words:** "simple", "easy", "just", "straightforward".

## 3. One doc for everyone — no external/internal fork

Write a single guide per feature that a new integrator *and* a maintainer both
read. Put the simple usage first (what it does + how to turn it on), then the
depth below (use cases, relations, reference, logs, errors). Do **not** maintain
a separate "external" simplified copy and an "internal" detailed copy — that is a
duplicate door that drifts. Depth is ordered *within* the guide, not split across
audiences.

## 4. Cross-link, never duplicate

One fact lives in one place; everywhere else links to it (relative links). If you
find yourself pasting the same explanation twice, replace the copy with a link.
The generators and the site nav rely on this — see `sdk-docs` §5.

---

## Checklist (run before calling a change done)

- [ ] Public API changed → TSDoc summary + `@example` + `@category` updated.
- [ ] Data shape / event payload changed → its TSDoc (top + fields) updated.
- [ ] Enhancer attribute/event/error/log/rule changed → `guide/` updated per
      [guide.md](./guide.md)'s sync table.
- [ ] New feature → full `guide/` set scaffolded and it appears in Feature Guides.
- [ ] Folder purpose changed → that folder's `README.md` updated.
- [ ] Each new/changed doc clears the §2 readability bar (question-first,
      example, cautions have fixes, no forbidden words).
- [ ] No content duplicated — cross-linked instead.
