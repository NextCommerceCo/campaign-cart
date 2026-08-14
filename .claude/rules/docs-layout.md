# Documentation Layout Rules

How a published doc page is **structured** so a reader can scan it. Sibling files
own the other halves and are not repeated here:

- [documentation.md](./documentation.md) — policy (docs ship with the code) and the
  readability bar (tone, forbidden words, no em dashes, runnable examples).
- [docs-fact-check.md](./docs-fact-check.md) — the re-checks every docs change must pass.
- [guide.md](./guide.md) — the per-feature `guide/` page set and its sync table.

> Every rule below was written after a reader could not read the page. Where a rule
> has a measurement in it, that measurement is the reason it exists.

---

## 1. The column is 630px. Design for it.

The site's content column is about **630px** at a 1200px viewport, set by
`docs/site/assets/style.css` (`grid-template-columns: minmax(0, 1fr) minmax(0, 2.5fr) minmax(0, 20rem)`).
Every layout rule follows from that width.

**Tables are two columns. Never three.** A third column forces every cell to wrap,
and a wide table overflows its grid track and paints over the table of contents.

**Column 1 is the identifier.** `Attribute`, `Value`, `Path`, `Token`, `Flag` — the
thing being looked up.

**Column 2 is headed `Description`.** Always that word. One page once carried
thirteen different second-column headings ("What it does", "What it reads", "What it
renders", "What it takes", "Goes on", "What it marks", "What it writes", …), each
invented per table. Pick the one word and stop.

**Keep description cells under ~40 characters** so they render on one line.

**Need a third fact? Split the table, do not widen it.** Two tables under
`**On the container**` and `**On a card**` carry "where it goes" better than a
`Goes on` column, and stay readable.

## 2. A list of values is a table, not a sentence

A sentence that names accepted values hides them:

```md
`data-next-format` accepts `currency`, `percentage`, `address`, and `phone`.
```

A row each exposes them, and exposes the ones you forgot:

```md
| Value | Description |
|---|---|
| `auto` | Infer from the value and the path (the default) |
| `currency` | Money, in the campaign's currency and locale |
```

Reserve prose for behaviour that is not a list: what happens on a click, what a
default means, what breaks.

## 3. One heading level per depth

`##` for sections, `###` for everything beneath them. **Never skip a level.**

A page that used `###` for some sub-sections and `####` for others rendered a ragged,
inconsistently indented table of contents, because the sidebar indents by heading
depth. `##` → `####` also skips a level.

Headings stay plain text — see [documentation.md](./documentation.md) §2 for why
backticks break the page TOC.

## 4. Every attribute gets an example

**Rule:** every attribute named in a table appears in at least one `html` block on
the same page. This is mechanically checkable — parse the page, diff the attributes
in table cells against the attributes in fenced blocks, and the difference must be
empty.

**The heading is `Example`.** Not "Every attribute in context", not anything else
invented. One word.

**Every example gets a lead-in sentence** describing what *that* markup does:

> Below is an example that binds the cart total to a span, shows one block only when
> the cart has items, hides another when it is empty, and holds a price block
> invisible until the SDK has finished its scan.

Not "an example of the attributes above". Say what the code does.

**No example butts directly against a table or a heading.** Prose comes first.

## 5. HTML examples are formatted, not hand-written

Run every `html` block through prettier at **80 columns**, then convert prettier's
self-closed void elements back to the plain form the starter templates ship:

```
prettier --parser html --print-width 80   →   <img … />
then                                       →   <img …>
```

The result wraps one attribute per line with `>` on its own line, which is the only
form that survives the 630px column:

```html
<div
  data-next-bundle-card
  data-next-quantity="1"
  data-next-min-quantity="1"
  data-next-max-quantity="5"
></div>
```

**No line inside a published `html` block exceeds 80 characters.** Hand-written
blocks broke this repeatedly; running the formatter is not optional.

## 6. Never invent a description

Pull the words from the source and cite `file:line`:

- feature manifests — `src/features/**/*.manifest.ts`
- type unions — `src/core/base/display-types.ts` and friends
- state manifests — `src/state/**/*.state-manifest.ts`

This is not ceremony. Sourcing descriptions from the manifests during one pass over
one page found three published errors:

- `data-next-format` was documented as accepting `address` and `phone`. The union at
  `src/core/base/display-types.ts:32` contains neither, and four real values were missing.
- `data-next-coupon` was documented with 1 of the 5 values in `coupon.manifest.ts`.
- Five display modifiers (`data-hide-if-zero`, `data-multiply-by`, …) were undocumented.

For example **values**, prefer `e2e/fixtures/*.html`, and prefer
`src/features/**/guide/reference/tested-example.md` above that — those are the blocks
Playwright actually runs.

## 7. Say what the thing is

Use the reader's word, not the implementation's. "The cart object", not "the cart
namespace". If a label needs explaining, it is the wrong label.

## 8. Two CSS traps this site has already hit

**Headerless facts tables.** `| | |` renders
`<thead><tr><th></th><th></th></tr></thead>` — an empty row that the `thead th`
background paints as a filled bar and the border rule outlines. It reads as a broken
box above every entry. Do not use them.

**Inline-code padding must be scoped.** `.tsd-typography code { padding: … }` also
matches `pre > code`, indenting every line of every fenced block and reading as a
stray leading space before the first character. Scope it `:not(pre) > code`.

## 9. Check what publishes before you edit

`typedoc.json` `projectDocuments` decides which markdown becomes a page. On `main`
that is **`docs/guides/**` only**. The 350+ pages under `src/**/guide/` are measured
by `docs:coverage` and drift-checked by `src/tests/docs/`, but they render nothing.

Editing an unpublished file changes no reader-facing page. Confirm the target is in
`projectDocuments` first.

## 10. Verify on the served page

`npm run docs` then look at the page, or parse the built HTML. The markdown looking
right is not evidence.

Useful checks, all mechanical:

```bash
# tables wider than two columns
grep -oE '^\|([^|]*\|){3,}$' docs/guides/**/*.md

# lines over 80 chars inside an html block
# attributes in tables that appear in no example
# empty <thead> rows in the built HTML
```

---

## Checklist

- [ ] Every table is two columns, second column headed `Description`.
- [ ] No description cell wraps (~40 chars).
- [ ] Every list of accepted values is a table, not a sentence.
- [ ] Heading levels are `##` and `###` only, no skips.
- [ ] Every attribute in a table appears in an `html` example on the page.
- [ ] Every example is headed `Example` and preceded by a "Below is an example that…" sentence.
- [ ] Every `html` block went through prettier; no line over 80 chars; void elements not self-closed.
- [ ] Every description traces to a manifest, type, or fixture — cited `file:line`.
- [ ] The file being edited is in `typedoc.json` `projectDocuments`.
- [ ] Rebuilt with `npm run docs` and checked on the page, not in the markdown.
