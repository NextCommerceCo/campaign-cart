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
7. **`src/` root holds the entries** `loader.ts`, `boot.ts` and `config.ts`. Every other
   feature is a folder or a file inside one.
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
  architecture/            design.md · engine.md · structure.md · parity-0.4.md (what 0.4.43 pages use,
                           and how each is supported) · redesign-review.md (research before the rewrite)
  guides/                  for page builders: attributes · javascript-api · events · migrating-from-0.4
public/campaign-cart.css   the 0.4.x stylesheet, unchanged; copied to dist/ beside loader.js
scripts/size.mjs           gzip budget per chunk; fails the build
scripts/tsugi.mjs          npm run tsugi -- <tag>: compiles the tsugi design system at a release tag into vendor/
vendor/tsugi/tsugi.css     Tailwind preflight, tsugi base and the components the debug panel uses, for its shadow root;
                           generated, never edited
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
    engine.ts types.ts events.ts log.ts         the Engine, shared types and State, events and their payloads, the one logger
    api.ts storage.ts                           the API (also maps order errors: one request less per lazy chunk) and storage
    values.ts format.ts tokens.ts condition.ts  display paths, value formatting, template tokens, conditions
    attribution.ts params.ts scope.ts           visit attribution, kept URL params, storage scope
    cart/                                       cart.ts selectors.ts toggles.ts types.ts: cart actions, bundle selectors, toggles, their types;
                                                variants.ts: a package's variant choices, for slots and debug
  bindings/            boot        DOM, one file per attribute family
    index.ts                       bindAll: scan once, render on subscribe
    context.ts                     BindContext (engine, claim, warn)
    dom.ts                         setText, setVisible, setState, token stamping
    display.ts bundle-selector.ts package-toggle.ts add-to-cart.ts
    cart-summary.ts cart-controls.ts links.ts
    slots.ts                       slots chunk: a bundle selector with a slot template (multi-variant pages)
    widgets.ts                     widgets chunk: accordion, tooltip, scroll hint and countdown 0.4.x pages rely on
  checkout/            checkout    loaded when the page has form[data-next-checkout], bound on ready
    index.ts                       bindCheckout: submit, steps, error box, processing overlay
    state/                         headless: checkout.ts (actions), order-body.ts (order body, payment codes),
                                   rules.ts (i18n-rules API, checks), phone.ts (formatting, phone fields), types.ts
    address/                       country.ts (the page's fields follow the country), block.ts ([data-next-address]),
                                   autocomplete.ts, billing.ts (same-as-shipping, cloned rows), phone.ts (flag, mask)
    payment/                       card.ts (payment radios and panels, payment.js), express.ts, logos.ts
    form/                          fields.ts, labels.ts (floating), errors.ts, texts.ts, reformat.ts (keep the caret)
    review.ts                      [data-next-checkout-review]
  order/               order       loaded when the page has an upsell offer or order.* values
    index.ts state.ts upsell.ts receipt.ts   state.ts is headless: load, accept, skip
  analytics/           analytics   subscriber, loaded on idle
    index.ts                       startAnalytics: engine events → GA4-named `analytics` events
    context.ts                     page context and event ids
    ecommerce.ts                   item, cart and order ecommerce payloads
  debug/               debug       loaded with ?debug=1
    index.ts                       startDebug: floating button with issue count, menu, panel (journey, issues, checkout, analytics, elements, state, logs), window.nextDebug
    state.ts                       headless: the pages of this tab and what happened on each, the panel as it was left; kept in the
                                   session under next:debug, outside the storage scope
    journey.ts                     the Journey tab: tsugi's journey of the tab's pages, the picked page's stats and timeline
    icons.ts                       Lucide icons as inline SVG (a shadow root cannot load tsugi's icon font)
    elements.ts view.ts            page elements: what each data-next-* resolves to, highlight, pick; value tree
    cart.ts                        the cart part of Checkout, as campaign-client draws it: lines with their variant,
                                   stepper and price, a line opened for its discounts and variant selects (a bundle slot
                                   changes through its selector), vouchers, shipping, totals and the math that checks them
    checkout.ts                    the Checkout tab: what stands between the shopper and the order, the cart, the
                                   customer and payment as the checkout holds them; Check form and Fill test details
                                   call engine.checkout
    picker.ts                      Add packages: tsugi's dialog listing the campaign's packages by product, as the
                                   dashboard's product picker
    analytics.ts                   analytics runs, each walked Trigger → Decide → Build → Push → Deliver from the
                                   analytics chunk's decision traces
    providers.ts                   which providers are on, engine event → GA4 / dl_* wiring (checked against
                                   compat/analytics.ts), parameter checks
    styles.ts                      vendored tsugi first, then the panel, analytics and cart stylesheets on its tokens
  compat/                          @deprecated 0.4.x support; each file ships with its importer
    config.ts          loader      nextConfig / meta-tag readers, nextReady, next:ready
    legacy.ts          boot        window.next 0.4.x API, selector ids, event names
    exit-intent.ts     exit-intent loaded on the first next.exitIntent() call
    checkout.ts        checkout    page field names, os-* names, old config, step guard, prospect DOM event
    order.ts           order       accept / decline words, old next-url and offer attributes
    analytics.ts       analytics   dl_* events (Elevar format) into NextDataLayer / dataLayer, built from `analytics`
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
| debug       | `?debug=1`, then every page of the tab until `?debug=0`             | 40 KB         |

## Imports

| File                      | May import                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `engine/**`, `*/state/**` | `engine/**` and the feature's own `state`, and no browser globals                                   |
| `bindings/*`              | `engine/*` (boot files), `bindings/*`, `compat/legacy.ts`                                           |
| `checkout/*`              | `engine/*`, `checkout/*`, `bindings/context.ts`, `bindings/dom.ts`, `compat/checkout.ts`            |
| `order/*`                 | `engine/*`, `order/*`, `bindings/context.ts`, `bindings/dom.ts`, `compat/order.ts`                  |
| `analytics/*`             | `engine/*`, `compat/analytics.ts`                                                                   |
| `debug/*`                 | `engine/*`, `debug/*`, `vendor/tsugi/tsugi.css`                                                     |
| `compat/*`                | `engine/*`, `compat/*`; `compat/analytics.ts` also `analytics/context.ts`, `analytics/ecommerce.ts` |
| `boot.ts`                 | `engine/*` (boot files), `bindings/*`, `compat/legacy.ts`; lazy chunks only via `import()`          |
| `loader.ts`               | `config.ts`, `compat/config.ts`; `boot.ts` only via `import()`                                      |
| `config.ts`               | `compat/config.ts`                                                                                  |

Lazy chunks are `checkout/`, `order/`, `analytics/`, `debug/`, `bindings/slots.ts`,
`bindings/widgets.ts`, `compat/exit-intent.ts`, plus `compat/checkout.ts`, `compat/order.ts` and
`compat/analytics.ts`, which only their own chunk may import statically.

A type used by one domain sits in that domain's `types.ts` (`engine/cart/`, `checkout/state/`) or
beside its actions (`OrderState` in `order/state.ts`); one that several domains share stays in
`engine/types.ts`. `import type` is erased at build, so the table does not apply to it: `State`
names the checkout and order slices without loading their chunks.

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
  bindings/ checkout/ order/ analytics/ compat/ debug/   the rest, happy-dom
  boot.test.ts · loader.test.ts · pages.test.ts · architecture.test.ts
  fixtures/
    campaign.ts api.ts storage.ts engine.ts pages.ts order.ts rules.ts
    pages/<campaign>/<page>.html           my-campaigns pages, copied verbatim, source on line 1
    pages/starter/<campaign>-<page>.html   starter-template pages, copied verbatim, source commit on line 1
```

The Playwright run on the built `dist/` is `bun run e2e` in `dev/`, not part of `npm test`.

A test file mirrors the module it covers, and a chunk entry's test is named after the chunk
(`tests/checkout/checkout.test.ts` covers `src/checkout/index.ts`). Checkout's DOM parts
(`address/`, `form/`, `payment/`) are tested through that entry, on real template pages. Every
bug fix adds a test that fails without the fix.
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
| An engine action | `src/engine/<domain>.ts`; test in `tests/engine/`; events in `events.ts` and `docs/guides/events.md`                                                                      |
| A lazy feature   | `src/<feature>/index.ts`, or a file in the folder it belongs to; `import()` from boot; a `LAZY` entry in `tests/architecture.test.ts`; a budget row in `scripts/size.mjs` |
| A deprecation    | the old name in `src/compat/<chunk>.ts` with `@deprecated Use …`; a row in `docs/guides/migrating-from-0.4.md`                                                            |
