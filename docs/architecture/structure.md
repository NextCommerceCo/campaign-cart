# Project and file structure

Status: agreed, 21 Oct 2026 (revised after an independent review). Where code, tests and docs
go, and the rules that keep it that way. Read with [engine.md](engine.md).

## Why: how campaign-cart became hard to change

| campaign-cart (0.4.x)                                                                   | Effect                                                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 2,022 tracked files; checkout 7 folders deep                                            | Finding where something happens took a search                                  |
| Folders by kind of code: `managers/`, `processors/`, `services/`, `builders/`, `utils/` | One feature spread over many folders; two order-create paths grew side by side |
| Tests in three places (`src/**/tests`, `src/tests`, `e2e`)                              | No single place to see what is covered                                         |
| Generated docs inside `src/` (`src/docs`, per-feature `guide/`)                         | Source and docs drifted                                                        |
| 3 tsconfigs, 2 vite configs, ESLint + Prettier + typedoc + patches                      | Tooling work before feature work                                               |
| `dist/` committed                                                                       | Merge conflicts on every rebuild                                               |

## Rules

1. **Folders are features.** Everything about one thing sits together: `checkout/address/`
   holds every address file. Every top-level folder except `engine/` and `compat/` is a chunk.
2. **Headless code is `engine/` and each feature's `state`** (`checkout/state/`,
   `order/state.ts`): no browser globals, and the only code that calls the API or storage.
   Three levels at most: `src/<feature>/<part>/<file>.ts`.
3. **Split by domain, never by kind of code.** No `managers/`, `services/`, `utils/`,
   `helpers/`. When a file passes ~300 lines, split it by domain.
4. **Imports go one way** (table below), enforced by `tests/architecture.test.ts`.
5. **Named exports only.** `index.ts` only as a chunk entry, never a re-export barrel.
   Enforced by the same test.
6. **Compat code lives in `compat/`, one file per chunk that uses it.** Each item is
   `@deprecated` with its replacement. A file there still ships in the chunk that imports it,
   so the folder decides ownership, not loading. Dropping 0.4.x support = deleting `compat/`.
7. **`src/` root holds the entries** `loader.ts`, `boot.ts`, `config.ts` and the one-file
   `debug.ts` chunk. Every other feature is a folder or a file inside one.
8. **Comments are rare.** Code says what it does; `docs/` says why.
9. **Build output is never committed.** CI builds `dist/`.
10. **Pages own their CSS; 0.4.x's stylesheet ships unchanged.** The SDK sets classes and
    attributes. The 0.4.x loader linked `campaign-cart.css`, and live pages rely on it (receipt
    skeleton, button spinners, `.hide` utilities, radio and validation styles), so
    `public/campaign-cart.css` is a verbatim copy that the loader links from its own folder.
    New CSS never goes there; trimming it is a decision for after the 0.4.x pages move.

## Repository

```
.github/workflows/ci.yml   format check · typecheck · test · build with size budgets
docs/
  architecture/            design.md · engine.md · structure.md
  guides/                  for page builders: attributes · javascript-api · events · migrating-from-0.4
public/campaign-cart.css   the 0.4.x stylesheet, unchanged; copied to dist/ beside loader.js
scripts/size.mjs           gzip budget per chunk; fails the build
dev/                       bun dev, bun run e2e, bun run qa: campaign pages + the SDK + mock or proxied API
src/  tests/               below
CLAUDE.md                  these rules, short, for AI-assisted maintenance
README.md · package.json · tsconfig.json · vite.config.ts (build + test) · .prettierrc.json
```

A `docs/architecture/decisions/` folder is added with the first decision worth its own page.

The SDK ships from the CDN only (`loader.js` on a script tag): no npm entry, `exports` or
`.d.ts`, so the Engine API is not a public contract.

## Source

```
src/
  loader.ts            loader      reads the page setup, starts the campaign GET, imports boot
  config.ts            loader      page setup from the script tag and URL
  boot.ts              boot        boot: Engine, bindings, window.next, ready
  engine/              boot        headless core every page needs
    engine.ts types.ts events.ts log.ts         the Engine, its state types, events, the one logger
    api.ts storage.ts                           the API (also maps order errors: one request less per lazy chunk) and storage
    values.ts condition.ts                      paths and formatting for display, conditions
    attribution.ts params.ts scope.ts           visit attribution, kept URL params, storage scope
    cart/                                       cart.ts selectors.ts toggles.ts: cart actions, bundle selectors, toggles
  bindings/            boot        DOM, one file per attribute family
    index.ts                       bindAll: scan once, render on subscribe
    context.ts                     BindContext (engine, claim, warn)
    dom.ts                         setText, setVisible, setState, parse helpers
    display.ts bundle-selector.ts variants.ts package-toggle.ts add-to-cart.ts
    cart-summary.ts cart-controls.ts links.ts
    slots.ts                       slots chunk: a bundle selector with a slot template (multi-variant pages)
    widgets.ts                     widgets chunk: accordion, tooltip, scroll hint and countdown 0.4.x pages rely on
  checkout/            checkout    loaded when the page has form[data-next-checkout], bound on ready
    index.ts                       bindCheckout: submit, steps, error box, processing overlay
    state/                         headless: checkout.ts (actions, order body), rules.ts (i18n-rules API, checks), phone.ts
    address/                       country.ts (the page's fields follow the country), block.ts ([data-next-address]),
                                   autocomplete.ts, billing.ts (same-as-shipping, cloned rows), phone.ts (flag, mask)
    payment/                       card.ts (payment radios and panels, payment.js), express.ts, logos.ts
    form/                          fields.ts, labels.ts (floating), errors.ts, texts.ts, reformat.ts (keep the caret)
    review.ts                      [data-next-checkout-review]
  order/               order       loaded when the page has an upsell offer or order.* values
    index.ts state.ts upsell.ts receipt.ts   state.ts is headless: load, accept, skip
  analytics/           analytics   subscriber, loaded on idle
    index.ts                       startAnalytics: data layer delivery and event mapping
    ecommerce.ts                   item, cart and order ecommerce payloads
  debug.ts             debug       loaded with ?debug=1
  compat/                          @deprecated 0.4.x support; each file ships with its importer
    config.ts          loader      nextConfig / meta-tag readers, nextReady, next:ready
    legacy.ts          boot        window.next 0.4.x API, selector ids, event names
    exit-intent.ts     exit-intent loaded on the first next.exitIntent() call
    checkout.ts        checkout    page field names, os-* names, old config, step guard, prospect DOM event
    order.ts           order       accept / decline words, old next-url and offer attributes
```

| Chunk       | Loaded when                                                         | Budget (gzip) |
| ----------- | ------------------------------------------------------------------- | ------------- |
| loader      | always, inline                                                      | 2.5 KB        |
| boot        | always                                                              | 25 KB         |
| checkout    | `form[data-next-checkout]`                                          | 30 KB         |
| order       | `[data-next-upsell]` or `order.*`                                   | 10 KB         |
| analytics   | idle after ready                                                    | 8 KB          |
| exit-intent | first `next.exitIntent()`                                           | 3 KB          |
| slots       | a bundle selector with a slot template                              | 6 KB          |
| widgets     | `[data-next-accordion]`, `[data-next-tooltip]`, `[data-next-timer]` | 3 KB          |
| debug       | `?debug=1`                                                          | 3 KB          |

## Imports

| File                      | May import                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `engine/**`, `*/state/**` | `engine/**` and the feature's own `state`, and no browser globals                          |
| `bindings/*`              | `engine/*` (boot files), `bindings/*`, `compat/legacy.ts`                                  |
| `checkout/*`              | `engine/*`, `checkout/*`, `bindings/context.ts`, `bindings/dom.ts`, `compat/checkout.ts`   |
| `order/*`                 | `engine/*`, `order/*`, `bindings/context.ts`, `bindings/dom.ts`, `compat/order.ts`         |
| `analytics/*`, `debug.ts` | `engine/*`                                                                                 |
| `compat/*`                | `engine/*`, `compat/*`                                                                     |
| `boot.ts`                 | `engine/*` (boot files), `bindings/*`, `compat/legacy.ts`; lazy chunks only via `import()` |
| `loader.ts`               | `config.ts`, `compat/config.ts`; `boot.ts` only via `import()`                             |
| `config.ts`               | `compat/config.ts`                                                                         |

Lazy chunks are `checkout/`, `order/`, `analytics/`, `debug.ts`, `bindings/slots.ts`,
`bindings/widgets.ts`, `compat/exit-intent.ts`, plus `compat/checkout.ts` and `compat/order.ts`,
which only their own chunk may import statically.

`tests/architecture.test.ts` fails on: an import outside this table; a static import of a lazy
chunk; a static path from `boot.ts` to `checkout/state` or `order/state`; a browser global
(`document`, `window`, `location`, `navigator`, `history`, `localStorage`, `sessionStorage`,
`fetch`, `matchMedia`, `CustomEvent`, `requestIdleCallback`) in headless code; a folder deeper
than three levels; a default export or a re-export barrel; `console` outside `engine/log.ts` and
`loader.ts`.

## Tests

```
tests/
  engine/ checkout/state/ order/state.test.ts   headless code, runs in Node — proves it never needs a DOM
  bindings/ checkout/ order/ analytics/ compat/   the rest, happy-dom
  boot.test.ts · loader.test.ts · debug.test.ts · pages.test.ts · architecture.test.ts
  fixtures/
    campaign.ts api.ts storage.ts engine.ts pages.ts
    pages/<campaign>/<page>.html   real template pages copied verbatim, source commit on line 1
  e2e/             Playwright on the built dist/ with the network stubbed — lands with checkout
```

A test file mirrors the module it covers. Every bug fix adds a test that fails without the fix.
One test binds each real template page and fails on any `[next]` warning, so templates and SDK
cannot drift silently.

## Docs

- `docs/architecture/` — why the code is shaped this way.
- `docs/guides/` — for people building campaign pages: every attribute, the `window.next` API,
  every event, and the 0.4.x → new migration table. Written by hand, kept short.

## Recipes

| Adding           | Where                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An attribute     | `src/bindings/<family>.ts` (or the checkout / order folder), registered in its `index.ts`; a test beside the others; a row in `docs/guides/attributes.md`                 |
| An engine action | `src/engine/<domain>.ts`; test in `tests/engine/`; events in `types.ts` and `docs/guides/events.md`                                                                       |
| A lazy feature   | `src/<feature>/index.ts`, or a file in the folder it belongs to; `import()` from boot; a `LAZY` entry in `tests/architecture.test.ts`; a budget row in `scripts/size.mjs` |
| A deprecation    | the old name in `src/compat/<chunk>.ts` with `@deprecated Use …`; a row in `docs/guides/migrating-from-0.4.md`                                                            |
