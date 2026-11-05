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
   `helpers/`. When a file passes 300 lines (imports not counted), split it by domain. `tests/architecture.test.ts`
   holds a budget for each file still over: it only shrinks, and goes when the file is split.
4. **Imports go one way** (table below), enforced by `tests/architecture.test.ts`.
5. **Named exports only.** `index.ts` only as a chunk entry, never a re-export barrel.
   Enforced by the same test.
6. **Compat code lives in `compat/`, one file (or one folder, once it passes the line limit) per chunk that
   uses it.** Each item is
   `@deprecated` with its replacement. A file there still ships in the chunk that imports it,
   so the folder decides ownership, not loading. Dropping 0.4.x support = deleting `compat/`.
7. **`src/` root holds the entries** `loader.ts`, `boot.ts` and `config.ts`. Every other
   feature is a folder or a file inside one.
8. **Comments are rare.** Code says what it does; `docs/` says why. The exception is async
   ordering the code cannot show (an identity token, a serialized chain, latest-wins): one line
   on why.
9. **Build output is never committed.** CI builds `dist/`.
10. **Pages own their CSS; 0.4.x's stylesheet ships unchanged.** The SDK sets classes and
    attributes. The 0.4.x loader linked `campaign-cart.css`, and live pages rely on it (receipt
    skeleton, button spinners, `.hide` utilities, radio and validation styles), so
    `public/campaign-cart.css` is a verbatim copy that the loader links from its own folder.
    New CSS never goes there; trimming it is a decision for after the 0.4.x pages move.
11. **A class owns a resource, a factory owns a domain's actions, a function does the rest.**
    A class holds something long-lived with identity (`Engine`, `Api`, `StorageAdapter`,
    `BindContext`); a `create<Domain>(ctx)` factory returns a domain's actions on Engine state,
    which they change only through `ctx.update`; bindings and transforms are plain functions. No
    inheritance beyond `Error`; a union with a `switch` until the same switch appears three times.

## Glossary

| Term            | Meaning                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| selector        | A bundle selector (`data-next-bundle-selector`): cards to pick from, mode `swap`, `select` or `offer`. Pages say bundle            |
| card            | One option of a selector (`data-next-bundle-card`), with its lines and its quote                                                   |
| slot            | One unit of a configurable card line, which can be its own variant (`data-next-bundle-slot-template-id`)                           |
| toggle          | A package switched on or off by its own card (`data-next-toggle-card`), kept in the cart as its own group                          |
| group           | A named part of the cart: its lines and vouchers. `items`, a selector id or a toggle id; the cart is every group merged            |
| held            | A coupon entered before the cart could be priced, checked at its next price                                                        |
| frozen          | The cart while an order is placed: every cart action is a no-op, so a double click cannot change what is paid for                  |
| calculating     | A price request is running; latest wins, so an older answer is dropped                                                             |
| settled         | Internal moment once a change was priced (or failed): `shipping.settled` is when 0.4.x sent its shipping events                    |
| lead            | The Open Cart the checkout saves once the name and the `data-next-lead` contact fields (`email`, `phone`, both or `off`) are valid |
| attach          | `engine.attach(ctx => create…(ctx))`: a lazy chunk adds its actions to the Engine (`engine.checkout`, `engine.order`)              |
| domain event    | An `EventMap` event (`cart.added`): what happened, for page scripts, analytics and debug                                           |
| analytics event | A GA4-named event the analytics chunk derives from domain events (`add_to_cart`); `next.analytics.on`, `dataLayer`                 |
| compat          | 0.4.x names and behaviour, only in `src/compat/`; deleting the folder drops 0.4.x support                                          |

## Repository

```
.github/workflows/ci.yml   format check · typecheck · test · build with size budgets
docs/
  architecture/            design.md · engine.md · structure.md · walkthrough.md (one click through the code) · parity-0.4.md (what 0.4.43 pages use,
                           and how each is supported) · redesign-review.md (research before the rewrite)
  guides/                  for page builders: attributes · javascript-api · events · migrating-from-0.4;
                           event-reference/<group>/lifecycle.md, drawn by hand, one per event group
  event-examples.json      an example payload of every public event, recorded by tests/event-examples.test.ts
  analytics-examples.json  the params of every analytics event, recorded by tests/analytics-examples.test.ts
public/campaign-cart.css   the 0.4.x stylesheet, unchanged; copied to dist/ beside loader.js
scripts/size.mjs           gzip budget per chunk; fails the build over one, or on a chunk without one
scripts/tsugi.mjs          npm run tsugi -- <tag>: compiles the tsugi design system at a release tag into vendor/
scripts/docs-*.mjs         npm run docs: the guides staged for TypeDoc, an Event Reference page per EventMap event
vendor/tsugi/tsugi.css     Tailwind preflight, tsugi base and the components the debug panel uses, for its shadow root;
                           generated, never edited
vendor/tsugi/payment-icons.css  tsugi's payment icons the payment step shows, inlined; a chunk of its own
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
    engine.ts types.ts log.ts                   the Engine, shared types and State, the one logger
    events/                                     one file per event group (carts.ts, checkout.ts, …): its objects and its events;
                                                context.ts the envelope every event carries; bus.ts the EventMap and the bus
    api.ts storage.ts                           the API (also maps order errors: one request less per lazy chunk) and storage
    values.ts format.ts tokens.ts condition.ts  display paths, value formatting, template tokens, conditions
    flow.ts                                     latestWins (a newer run drops the older) and serialize (one at a time)
    visit.ts                                    the visit's timers and exit-intent count (engine.visit)
    attribution.ts params.ts scope.ts           visit attribution, kept URL params, storage scope
    order.ts                                    the Order every order.* event and snapshot() carry, from the API's order
    id.ts session.ts                            event ids, the campaign session the NEXT analytics script shares
    cart/                                       cart.ts (cart actions), coupons.ts (checking, holding and removing codes),
                                                lines.ts (groups merged into lines), public.ts (the Cart, Checkout and toggle
                                                that events carry), selectors.ts (bundle selectors, and a package's variant
                                                choices for slots and debug), toggles.ts, types.ts
  bindings/            boot        DOM, one file per attribute family
    index.ts                       bindAll: scan once, render on subscribe
    context.ts                     BindContext (engine, claim, warn)
    environment.ts                 the page and browser every event's context carries
    dom.ts                         setText, setVisible, setState, token stamping
    display.ts bundle-selector.ts package-toggle.ts add-to-cart.ts
    cart-summary.ts cart-controls.ts links.ts
    promotion.ts                   [data-next-promotion]: promotion.viewed once half of it is on screen, promotion.clicked
    slots.ts                       slots chunk: a bundle selector with a slot template (multi-variant pages)
  checkout/            checkout    loaded when the page has form[data-next-checkout], bound on ready
    index.ts                       bindCheckout: submit, steps, error box, processing overlay
    state/                         headless: checkout.ts (actions), contact.ts (the lead: when the Open Cart is saved),
                                   place-order.ts (placeOrder, redirectFor), order-body.ts (order body, payment codes),
                                   rules.ts (i18n-rules API, checks), phone.ts (formatting, phone fields), types.ts
    address/                       country.ts (the page's fields follow the country), block.ts ([data-next-address]),
                                   autocomplete.ts, billing.ts (same-as-shipping, cloned rows), phone.ts (flag, mask)
    payment/                       card.ts (payment radios and panels, payment.js), express.ts, logos.ts
    form/                          fields.ts, labels.ts (floating), errors.ts, texts.ts, reformat.ts (keep the caret)
    review.ts                      [data-next-checkout-review]
  order/               order       loaded when the page has an upsell offer or order.* values
    index.ts state.ts upsell.ts receipt.ts   state.ts is headless: load, accept, skip
  analytics/           analytics   subscriber, loaded on idle
    index.ts                       startAnalytics: engine events → each group's handlers → GA4-named `analytics` events
    report.ts                      emit and skip with their trace, typed by `AnalyticsMap`; Handlers and dispatch
    pages.ts carts.ts checkout.ts orders.ts promotions.ts   one file per event group: what it sends, and when
    ecommerce.ts                   item, cart and order ecommerce payloads
  debug/               debug       loaded with ?debug=1
    index.ts                       startDebug: floating button with issue count, menu, panel (journey, issues, checkout, analytics; developer mode adds elements, state, logs and .devonly detail), window.nextDebug
    state.ts                       headless: the pages of this tab and what happened on each, the panel as it was left; kept in the
                                   session under next:debug, outside the storage scope
    journey.ts                     the Journey tab: tsugi's journey of the tab's pages, the picked page's stats and timeline
    icons.ts                       Lucide icons as inline SVG (a shadow root cannot load tsugi's icon font)
    elements.ts view.ts            page elements: what each data-next-* resolves to, highlight, pick; value tree
    cart.ts                        the cart part of Checkout, as campaign-client draws it: lines with their variant,
                                   stepper and price, a line opened for its discounts and variant selects (a bundle slot
                                   changes through its selector), vouchers, shipping, totals and the math that checks them
    checkout.ts address.ts         the Checkout tab: whether the order can go through and each step, the cart, the
                                   customer with addresses written by the country's i18n-rules format; Check form and
                                   Fill test details call engine.checkout
    picker.ts                      Add packages: tsugi's dialog with every package in one list, as campaign-client's picker;
                                   Add and the stepper set the quantity through engine.cart
    analytics.ts                   the Analytics tab: a verdict, the GA4 funnel checked off across the tab's pages, where
                                   events are pushed, then this page's events; one opens in tsugi's dialog, a tab for its
                                   summary (why, what it reached, whether its value adds up, items), the raw event and one
                                   for what each data layer or GA4 got
    reconcile.ts                   whether an event's value adds up to the cart or the order it came from
    providers.ts                   which providers are on, engine event → GA4 / dl_* wiring (checked against
                                   compat/analytics.ts), parameter checks
    styles.ts                      vendored tsugi first, then the panel, analytics and cart stylesheets on its tokens
  compat/                          @deprecated 0.4.x support; each file ships with its importer
    config.ts          loader      nextConfig / meta-tag readers, nextReady, next:ready
    legacy/            boot        events.ts: selector ids, the 0.4.x event names made from the new events;
                                   payloads.ts: their 0.4.x cart and item shapes; registry.ts: next.on for 0.4.x names
                                   (lazy chunks add theirs with addLegacyEvents); api.ts: the window.next 0.4.x API,
                                   nextReady; globals.ts: nextConfig.analytics, the old SDK's stored personal data
    exit-intent.ts     exit-intent loaded on the first next.exitIntent() call; the popup's promotion.* events
    widgets.ts         widgets     deprecated page widgets 0.4.x pages rely on: accordion, tooltip, scroll hint, countdown
    checkout.ts        checkout    page field names, os-* names, old config (express checks), step guard,
                                   the 0.4.x Open Cart DOM event, the checkout's 0.4.x event names
    order.ts           order       accept / decline words, old next-url and offer attributes, the order's 0.4.x event names
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
| debug icons | the Checkout tab's payment step                                     | 16 KB         |

## Imports

| File                      | May import                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `engine/**`, `*/state/**` | `engine/**` and the feature's own `state`, and no browser globals                                     |
| `bindings/*`              | `engine/*` (boot files), `bindings/*`, `compat/legacy/*`                                              |
| `checkout/*`              | `engine/*`, `checkout/*`, `bindings/context.ts`, `bindings/dom.ts`, `compat/checkout.ts`              |
| `order/*`                 | `engine/*`, `order/*`, `bindings/context.ts`, `bindings/dom.ts`, `compat/order.ts`                    |
| `analytics/*`             | `engine/*`, `compat/analytics.ts`                                                                     |
| `debug/*`                 | `engine/*`, `debug/*`, `vendor/tsugi/tsugi.css`; `vendor/tsugi/payment-icons.css` only via `import()` |
| `compat/*`                | `engine/*`, `compat/*`; `compat/analytics.ts` also `analytics/ecommerce.ts`                           |
| `boot.ts`                 | `engine/*` (boot files), `bindings/*`, `compat/legacy/*`; lazy chunks only via `import()`             |
| `loader.ts`               | `config.ts`, `compat/config.ts`; `boot.ts` only via `import()`                                        |
| `config.ts`               | `compat/config.ts`                                                                                    |

Lazy chunks are `checkout/`, `order/`, `analytics/`, `debug/`, `bindings/slots.ts`,
`compat/exit-intent.ts`, `compat/widgets.ts`, plus `compat/checkout.ts`, `compat/order.ts` and
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
  event-examples.test.ts           records docs/event-examples.json; fails on a public event without an example
  analytics-examples.test.ts       records docs/analytics-examples.json; fails on an analytics event without an example
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
  every event, and the 0.4.x → new migration table. Written by hand, kept short; each event's own
  page is generated from `EventMap` and `docs/event-examples.json`, and each analytics event's from
  `AnalyticsMap` and `docs/analytics-examples.json`.

## Recipes

| Adding           | Where                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An attribute     | `src/bindings/<family>.ts` (or the checkout / order folder), registered in its `index.ts`; a test beside the others; a row in `docs/guides/attributes.md`                                       |
| An engine action | `src/engine/<domain>.ts`; test in `tests/engine/`; events in its group's file under `engine/events/` with TSDoc and `@group`, public in `boot.ts`, an example in `tests/event-examples.test.ts` |
| A lazy feature   | `src/<feature>/index.ts`, or a file in the folder it belongs to; `import()` from boot; a `LAZY` entry in `tests/architecture.test.ts`; a budget row in `scripts/size.mjs`                       |
| A deprecation    | the old name in `src/compat/<chunk>.ts` with `@deprecated Use …`; a row in `docs/guides/migrating-from-0.4.md`                                                                                  |
