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

1. **`engine/` is the headless layer; every other folder is a chunk.** Inside a folder, one file
   per domain or attribute family.
2. **Two levels at most:** `src/<area>/<file>.ts`.
3. **Split by domain, never by kind of code.** No `managers/`, `services/`, `utils/`,
   `helpers/`. When a file passes ~300 lines, split it by domain.
4. **Imports go one way** (table below), enforced by `tests/architecture.test.ts`.
5. **Named exports only.** `index.ts` only as a chunk entry, never a re-export barrel.
   Enforced by the same test.
6. **Compat code is one file per chunk.** `legacy.ts` (core), `checkout/legacy.ts`,
   `order/legacy.ts`, plus the `legacy*` readers in `config.ts`. Each item is `@deprecated`
   with its replacement. Dropping 0.4.x support = deleting those files.
7. **Comments are rare.** Code says what it does; `docs/` says why.
8. **Build output is never committed.** CI builds `dist/`.
9. **Pages own their CSS; 0.4.x's stylesheet ships unchanged.** The SDK sets classes and
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

## Source

```
src/
  loader.ts            loader      reads the page setup, starts the campaign GET, imports core
  config.ts            loader      page setup; @deprecated readers for nextConfig / meta tags
  core.ts              core        boot: Engine, bindings, window.next, ready
  legacy.ts            core        @deprecated API for 0.4.x page scripts
  engine/              headless    no DOM; the only code that calls the API or storage
    engine.ts types.ts                          core
    cart.ts selectors.ts values.ts condition.ts core
    api.ts storage.ts events.ts                 core (api.ts also maps order errors: one request less per lazy chunk)
    attribution.ts params.ts scope.ts           core
    checkout.ts rules.ts                        loaded by the checkout chunk
    order.ts                                    loaded by the order chunk
  bindings/            core        DOM, one file per attribute family
    index.ts                       bindAll: scan once, render on subscribe
    context.ts                     BindContext (engine, claim, warn)
    dom.ts                         setText, setVisible, setState, parse helpers
    display.ts bundle-selector.ts variants.ts package-toggle.ts add-to-cart.ts
    cart-summary.ts cart-controls.ts links.ts
  checkout/            checkout    loaded when the page has form[data-next-checkout], bound on ready
    index.ts                       bindCheckout: submit, steps, error box, processing overlay
    form.ts address.ts billing.ts  fields, country/state/location, same-as-shipping and cloned rows
    address-form.ts                [data-next-address]: the country's fields from its i18n-rules layout
    payment.ts express.ts logos.ts payment radios and panels, payment.js card, express buttons
    review.ts                      [data-next-checkout-review]
    messages.ts                    field and payment error display
    texts.ts                       English texts by code; i18n-rules' translated messages first
    legacy.ts                      page field names, os-* names, old config, step guard, prospect DOM event
  order/               order       loaded when the page has an upsell offer or order.* values
    index.ts upsell.ts receipt.ts legacy.ts
  analytics.ts         analytics   subscriber, loaded on idle
  exit-intent.ts       exit-intent loaded on the first next.exitIntent() call
  slots.ts             slots       loaded when a bundle selector has a slot template (multi-variant pages)
  widgets.ts           widgets     accordion, tooltip, scroll hint and countdown 0.4.x pages rely on; loaded when present
  debug.ts             debug       loaded with ?debug=1
```

| Chunk       | Loaded when                                                         | Budget (gzip) |
| ----------- | ------------------------------------------------------------------- | ------------- |
| loader      | always, inline                                                      | 2.5 KB        |
| core        | always                                                              | 25 KB         |
| checkout    | `form[data-next-checkout]`                                          | 30 KB         |
| order       | `[data-next-upsell]` or `order.*`                                   | 10 KB         |
| analytics   | idle after ready                                                    | 8 KB          |
| exit-intent | first `next.exitIntent()`                                           | 3 KB          |
| slots       | a bundle selector with a slot template                              | 6 KB          |
| widgets     | `[data-next-accordion]`, `[data-next-tooltip]`, `[data-next-timer]` | 3 KB          |
| debug       | `?debug=1`                                                          | 3 KB          |

## Imports

| File                                         | May import                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `engine/*`                                   | `engine/*` only, and no browser globals                                |
| `bindings/*`                                 | `engine/*` (core files), `bindings/*`, `legacy.ts`                     |
| `checkout/*`                                 | `engine/*`, `checkout/*`, `bindings/context.ts`, `bindings/dom.ts`     |
| `order/*`                                    | `engine/*`, `order/*`, `bindings/context.ts`, `bindings/dom.ts`        |
| `analytics.ts`, `exit-intent.ts`, `debug.ts` | `engine/*`                                                             |
| `slots.ts`                                   | `engine/*`, `bindings/dom.ts`                                          |
| `widgets.ts`                                 | nothing (pure page UI)                                                 |
| `core.ts`, `legacy.ts`                       | `engine/*` (core files), `bindings/*`; lazy chunks only via `import()` |
| `loader.ts`                                  | `config.ts`; `core.ts` only via `import()`                             |

`tests/architecture.test.ts` fails on: an import outside this table; a static import of a lazy
chunk; a static path from `core.ts` to `engine/checkout|order|rules.ts`; a browser global
(`document`, `window`, `location`, `navigator`, `history`, `localStorage`, `sessionStorage`,
`fetch`, `matchMedia`, `CustomEvent`, `requestIdleCallback`) inside `engine/`; a folder deeper
than two levels; a default export or a re-export barrel.

## Tests

```
tests/
  engine/          one file per engine module, runs in Node — proves the Engine is headless
  bindings/ checkout/ order/   one file per binding, happy-dom
  analytics.test.ts · legacy.test.ts · boot.test.ts · architecture.test.ts
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

| Adding           | Where                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An attribute     | `src/bindings/<family>.ts` (or the checkout / order folder), registered in its `index.ts`; a test beside the others; a row in `docs/guides/attributes.md` |
| An engine action | `src/engine/<domain>.ts`; test in `tests/engine/`; events in `types.ts` and `docs/guides/events.md`                                                       |
| A lazy feature   | `src/<feature>.ts` or `src/<feature>/index.ts`; `import()` from core; a budget row in `scripts/size.mjs`                                                  |
| A deprecation    | the old name in that chunk's `legacy.ts` with `@deprecated Use …`; a row in `docs/guides/migrating-from-0.4.md`                                           |
