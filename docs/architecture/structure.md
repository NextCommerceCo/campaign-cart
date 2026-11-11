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
   Only entries (`loader.ts`, `config.ts`, `boot.ts`, a chunk's `index.ts`) import compat; a feature
   exposes hooks or options that compat fills (`checkout/hooks.ts`).
7. **`src/` root holds the entries** `loader.ts`, `boot.ts` and `config.ts`. Every other
   feature is a folder or a file inside one.
8. **Comments are rare.** Code says what it does; `docs/` says why. The exception is async
   ordering the code cannot show (an identity token, a serialized chain, latest-wins): one line
   on why.
9. **Build output is never committed to main.** CI builds `dist/`. Running the CI
   workflow by hand on main tags the `package.json` version on a commit off main that adds it,
   which jsDelivr serves; an existing tag is never moved. A release is tried first as a beta:
   set the version to `<version>-beta.<n>` (`0.5.1-beta.1`), tag it the same way and load
   `@v<version>-beta.<n>` on a page, then set the final version and tag again. A beta gets no
   GitHub release, so it stays out of the docs site; its changes are in `CHANGELOG.md`.
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

| Term           | Meaning                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| selector       | A bundle selector (`data-next-bundle-selector`): cards to pick from, mode `swap`, `select` or `offer`. Pages say bundle                                                                       |
| card           | One option of a selector (`data-next-bundle-card`), with its lines and its quote                                                                                                              |
| slot           | One unit of a configurable card line, which can be its own variant (`data-next-bundle-slot-template-id`)                                                                                      |
| toggle         | A package switched on or off by its own card (`data-next-toggle-card`), kept in the cart as its own group                                                                                     |
| group          | A named part of the cart: its lines and vouchers. `items`, a selector id or a toggle id; the cart is every group merged                                                                       |
| held           | A coupon entered before the cart could be priced, checked at its next price                                                                                                                   |
| frozen         | The cart while an order is placed: every cart action is a no-op, so a double click cannot change what is paid for                                                                             |
| calculating    | A price request is running; latest wins, so an older answer is dropped                                                                                                                        |
| settled        | Internal moment once a change was priced (or failed): `shipping.settled` is when 0.4.x sent its shipping events                                                                               |
| lead           | The Open Cart the checkout saves once the name and the `data-next-lead` contact fields (`email`, `phone`, both or `off`) are valid                                                            |
| attach         | `engine.attach(ctx => create…(ctx))`: a lazy chunk adds its actions to the Engine (`engine.checkout`, `engine.order`)                                                                         |
| domain event   | An `EventMap` event (`cart.added`): what happened, for page scripts, analytics and debug                                                                                                      |
| tracking event | An event the analytics chunk derives from domain events at the moments that count for tracking, carrying the same objects (`product_added_to_cart`); `next.analytics.on` and the destinations |
| destination    | Where tracking events go, remapped to a vendor's format: GTM (`dl_*` pushes), GA4 (`gtag`), Meta pixel (`fbq`), RudderStack (`rudderanalytics`); each loaded only when it is on               |
| compat         | 0.4.x names and behaviour, only in `src/compat/`; deleting the folder drops 0.4.x support                                                                                                     |

## Repository

```
.github/workflows/ci.yml   format check · typecheck · test · build with size budgets
docs/
  architecture/            design.md · engine.md · structure.md · walkthrough.md (one click through the code) · parity-0.4.md (what 0.4.43 pages use,
                           and how each is supported) · redesign-review.md (research before the rewrite)
  guides/                  for page builders: attributes · javascript-api · events · migrating-from-0.4;
                           event-reference/<group>/lifecycle.md, drawn by hand, one per event group
  event-examples.json      an example payload of every public event, recorded by tests/event-examples.test.ts
  analytics-examples.json  the object, data, triggers and dataLayer push of every tracking event, recorded by tests/analytics-examples.test.ts
  destination-examples.json  what GTM, GA4, Meta and RudderStack send for each tracking event, recorded by tests/destinations/examples.test.ts
public/campaign-cart.css   the 0.4.x stylesheet, unchanged; copied to dist/ beside loader.js
scripts/size.mjs           gzip budget per chunk; fails the build over one, or on a chunk without one
scripts/migrate.mjs        node scripts/migrate.mjs <page.html|styles.css> [--write]: rewrites a page's earlier attributes to
                           attributes v2; tests/migrate.test.ts renders real pages both ways when MIGRATE_PAGES is set
scripts/tsugi.mjs          npm run tsugi -- <tag>: compiles the tsugi design system at a release tag into vendor/
scripts/docs-*.mjs         npm run docs: the guides staged for TypeDoc, an Event Reference page per EventMap event, an
                           Analytics Reference page per tracking event and per destination
vendor/tsugi/tsugi.css     Tailwind preflight, tsugi base and the components the debug panel uses, for its shadow root;
                           generated, never edited
vendor/tsugi/payment-icons.css  tsugi's payment icons the payment step shows, inlined; a chunk of its own
dev/                       bun dev, bun run e2e, bun run perf, bun run qa: campaign pages + the SDK + mock or proxied API
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
    engine.ts types.ts actions.ts  the Engine, shared types and State, next.actions / data-next-action (every action,
                                   one object of field names in, { ok, errors } out)
    tracking.ts                    what every destination shares: units, value, currency, line ids, startDestination
                                   (skip, burst, deliver), createOnce (page, checkout and browser keys); the 0.4.x order
                                   product and tax-basis guess (@deprecated)
    runtime/                       what the engine runs on: api.ts (the API; also maps order errors: one request less per
                                   lazy chunk), storage.ts, session.ts (the campaign session the NEXT analytics script
                                   shares), log.ts (the one logger), flow.ts (latestWins, serialize), id.ts (event ids)
    visit/                         the visit: visit.ts (timers, exit-intent count: engine.visit), attribution.ts, params.ts
                                   (kept URL params), scope.ts (storage scope), geo.ts (the visitor's country; a chunk),
                                   debug-config.ts (a nextConfig tried from the debug panel)
    order/                         order.ts (the Order every order.* event and snapshot() carry, the reported ledger),
                                   address.ts (an API address as the public Address), address-line.ts (form fields
                                   as an API address; an address on one line by a named layout; a 10-digit phone
                                   as text; a chunk checkout, order and attributes v2 share),
                                   payment.ts (codes and aliases, labels, wallets, express buttons; a chunk the lazy
                                   chunks share, kept out of boot)
    display/                       what pages read: values.ts (display paths), format.ts (money, percent, savings;
                                   localeOf; a currency's format by the page's formats.currency.<code>), tokens.ts (template tokens), condition.ts (the 0.4.x condition parser and
                                   compare, the one meaning of == != > < >= <=), texts.ts (texts by key: i18n-rules'
                                   /v1/locales, the page's translations), query.ts (next.query / data-next-query: paths
                                   over the objects events carry, fields a page defines; a chunk of its own)
    events/                        one file per event group (carts.ts, checkout.ts, …): its objects and its events;
                                   context.ts the envelope every event carries; bus.ts the EventMap and the bus
    cart/                          cart.ts (cart actions), coupons.ts (checking, holding and removing codes), lines.ts
                                   (groups merged into lines), public.ts (the Cart, Checkout and toggle that events
                                   carry), selectors.ts (bundle selectors), variants.ts (a package's variant choices),
                                   summary-tokens.ts (the cart summary's tokens), quotes.ts, toggles.ts, types.ts
  dom/                 boot        the DOM toolkit bindings, attributes v2, checkout and order share
    context.ts                     BindContext (engine, claim, warn, listen, offs: what dispose removes)
    dom.ts                         selector and toggle registration, state classes, showWhen, input values, a card from
                                   its element, the bundle selector id, the one template token pattern and fill, image sources
    templates.ts                   fillTokens, stamp, eachTokenText (the one walk over template text)
    environment.ts ready.ts        the page and browser every event's context carries; the nextReady queue
    browser.ts                     what the Engine reads from the browser: storage, cookies, the visit (fbp/fbc, pixel id)
  bindings/            boot        0.4.x attributes, one file per attribute family
    index.ts                       bindAll: scan once, render on subscribe, dispose; loads cart-summary.ts when a bound
                                   node has [data-next-cart-summary] or [data-next-discounts] outside a card (`ready` settles)
    cards.ts                       the 0.4.x card dialect: card ids, data-next-selected, setState, line properties
    display.ts bundle-selector.ts package-toggle.ts add-to-cart.ts
    cart-controls.ts links.ts
    cart-summary.ts                cart summary chunk: [data-next-cart-summary], cart-level [data-next-discounts]
    promotion.ts                   [data-next-promotion]: promotion.viewed once half of it is on screen, promotion.clicked
    slots.ts                       slots chunk: a bundle selector with a slot template (multi-variant pages)
    slot-properties.ts             slots chunk: the page's default properties and a unit's own, on every unit
  attributes/          attributes  attributes v2, loaded when a page has one or a script calls a new action; legacy pages never load it
    index.ts                       bindAttributes: scopes first (for, selectors, options), then each, then query, show, actions, fields
    context.ts                     AttributeContext: the scope each element reads short paths from, errors.<field>
    display.ts                     data-next-for, -query, -show / -hide, -each
    expression.ts value.ts         the condition grammar (&&, ||, > <) on engine/display/condition's compare; a value written by its
                                   field's type or data-next-format
    options.ts                     data-next-selector / -option: picks, order bumps, offers on ?ref_id pages
    actions.ts                     data-next-action: arguments from the element, its form and its scope; data-next-go
    fields.ts                      data-next-field outside a checkout: variants.<code> pickers, a slot's properties
    i18n.ts            i18n        data-next-i18n: a key's text from nextConfig.translations, then i18n-rules' /v1/locales;
                                   its own chunk, loaded by any page with [data-next-i18n]
  checkout/            checkout    loaded when the page has form[data-next-checkout], bound on ready
    index.ts                       bindCheckout: submit, steps, error box, processing overlay
    hooks.ts                       CheckoutHooks: what compat/checkout.ts adds; bindCheckout calls them
    state/                         headless: checkout.ts (actions), contact.ts (the lead: when the Open Cart is saved),
                                   place-order.ts (placeOrder, redirectFor), order-body.ts (order body), fields.ts (what
                                   the shopper types, leaves and picks; address.entered / address.updated),
                                   rules.ts (i18n-rules API, checks), phone.ts (formatting, phone fields), countries.ts
                                   (the country list and the visitor's country), types.ts
    address/                       country.ts (the page's fields follow the country), block.ts ([data-next-address]),
                                   autocomplete.ts, billing.ts (same-as-shipping, cloned rows), phone-input.ts (flag, mask)
    payment/                       methods.ts (payment radios and panels, the method choice widget.ts shares),
                                   card.ts (card fields, payment.js), expiry.ts (month + year selects or card.expiry),
                                   widget.ts ([data-next-payment]), express.ts, logos.ts
    form/                          fields.ts, names.ts (a field's name in every spelling, its country's rules),
                                   labels.ts (floating), errors.ts, texts.ts, reformat.ts (keep the caret)
    review.ts                      [data-next-checkout-review]
  order/               order       loaded when the page has an upsell offer or order.* values
    index.ts state.ts upsell.ts receipt.ts values.ts   state.ts is headless: load, accept, skip; values.ts the order.*
                                   display paths
  analytics/           analytics   subscriber, loaded on idle
    index.ts                       startAnalytics: engine events → each group's handlers → tracking events (`analytics`)
    report.ts                      emit and skip with their trace, typed by `TrackingMap`; Handlers and dispatch
    pages.ts carts.ts checkout.ts orders.ts promotions.ts   one file per event group: what it sends, and when
    items.ts                       a CartItem at the price the server gave it, the catalog's, or the one it was reported with
    destinations.ts                which destinations are on (nextConfig.analytics.destinations over the 0.4.x keys); starts
                                   the dl_* data layer and returns its exit-intent handler; import() of each other one
  destinations/        ga4, meta, rudderstack   one chunk per built-in destination, loaded after analytics when it is on
    ga4.ts                         Ga4EventMap, the tracking event → GA4 remap, startGa4: the page's gtag
    meta.ts                        MetaEventMap, the tracking event → Meta remap, startMeta: the page's fbq
    rudderstack/                   index.ts startRudderStack: the page's rudderanalytics, waiting for ready();
                                   calls.ts the tracking event → 0.4.x RudderStack calls; types.ts RudderStackEventMap
  debug/               debug       loaded with ?debug=1
    index.ts                       startDebug: floating button with issue count, menu, panel (journey, issues, checkout,
                                   analytics; developer mode adds events, elements, state, logs and .devonly detail),
                                   window.nextDebug; returns stop(), which removes every listener, subscription and the panel
    state.ts                       headless: the pages of this tab and what happened on each, the panel as it was left;
                                   kept in the session under next:debug, outside the storage scope
    ui/                            the panel itself: shell.ts (its state and moves between views, painting), view.ts (h(),
                                   rows, badges, the value tree), tabs.ts menu.ts picker.ts (Add packages), stream.ts
                                   event-detail.ts (event rows and their detail), source-card.ts, icons.ts (Lucide as
                                   inline SVG), styles.ts (vendored tsugi, then each tab's stylesheet) theme.ts
    tabs/                          one file per tab and what only it uses: journey.ts source.ts (where the tab came from),
                                   checkout.ts address.ts cart.ts cart-line.ts (the Checkout tab), analytics.ts
                                   providers.ts (setup notes, event wiring checked against compat/analytics/), events.ts
                                   logs.ts issues.ts elements.ts legacy.ts (each earlier attribute's v2 name), locale.ts
                                   config.ts draft.ts (Page config), benchmark.ts
  compat/                          @deprecated 0.4.x support; each file ships with its importer
    config.ts          loader      nextConfig / meta-tag readers, nextReady, next:ready
    legacy/            boot        events.ts: selector ids, the 0.4.x event names made from the new events;
                                   payloads.ts: their 0.4.x cart and item shapes; registry.ts: next.on for 0.4.x names
                                   (lazy chunks add theirs with addLegacyEvents) with the page moments and picks it keeps until the legacy chunk
                                   loads; api.ts: the window.next 0.4.x API,
                                   nextReady; globals.ts: NextConfig and the one nextConfig() reader, nextConfig.analytics,
                                   the old SDK's stored personal data
    exit-intent.ts     exit-intent loaded on the first next.exitIntent() call; the popup's promotion.* events
    widgets.ts         widgets     deprecated page widgets 0.4.x pages rely on: accordion, tooltip, scroll hint, countdown
    checkout.ts        checkout    legacyCheckout: nextConfig address and payment options, lead attributes, step guard and
                                   the 0.4.x DOM events, as checkout/hooks.ts hooks; the checkout's 0.4.x event names
    order.ts           order       the old offer attribute, the order's 0.4.x event names
    analytics/         analytics   index.ts: the NextDataLayer destination on startDestination, dl_* events (Elevar format)
                                   into NextDataLayer / dataLayer; pushes.ts: each event's dl_* fields, one dl_add_to_cart /
                                   dl_remove_from_cart push per burst of line events; exit-pushes.ts: dl_exit_intent_*;
                                   ecommerce.ts: their GA4-style ecommerce payloads (items, value, purchase); schema.ts:
                                   DataLayerEventMap, the type every dl_* push is checked against
```

| Chunk        | Loaded when                                                                                         | Budget (gzip) |
| ------------ | --------------------------------------------------------------------------------------------------- | ------------- |
| loader       | always, inline                                                                                      | 2.5 KB        |
| boot         | always                                                                                              | 26 KB         |
| checkout     | `form[data-next-checkout]`                                                                          | 30 KB         |
| order        | `[data-next-upsell]` or `order.*`                                                                   | 10 KB         |
| analytics    | idle after ready                                                                                    | 8 KB          |
| ga4          | after analytics, when `destinations.ga4` is on                                                      | 2 KB          |
| meta         | after analytics, when `destinations.meta` is on                                                     | 2 KB          |
| rudderstack  | after analytics, when `destinations.rudderstack` is on                                              | 3 KB          |
| exit-intent  | first `next.exitIntent()`                                                                           | 3 KB          |
| slots        | a bundle selector with a slot template                                                              | 6 KB          |
| attributes   | a v2 attribute on the page, or a script's first new-style action                                    | 12 KB         |
| variants     | shared by slots, attributes and debug (`engine/cart/variants.ts`)                                   | 1 KB          |
| query        | `next.query`, `next.watch`, `next.define`, attributes v2, a v2 checkout (`engine/display/query.ts`) | 2 KB          |
| cart summary | `[data-next-cart-summary]`, or `[data-next-discounts]` outside a card                               | 3 KB          |
| widgets      | `[data-next-accordion]`, `[data-next-tooltip]`, `[data-next-timer]`                                 | 3 KB          |
| i18n         | `[data-next-i18n]`                                                                                  | 1 KB          |
| legacy       | at boot on a page with any markup but v2's; elsewhere a script's first 0.4.x `next.on` name         | 3.5 KB        |
| debug        | `?debug=1`, then every page of the tab until `?debug=0`                                             | 56.5 KB       |
| debug icons  | the Checkout tab's payment step                                                                     | 16 KB         |
| geo          | shared by checkout and debug (`engine/visit/geo.ts`)                                                | 1 KB          |
| payment      | shared by checkout, order, destinations and debug (`engine/order/payment.ts`)                       | 1 KB          |
| address      | shared by checkout, order and attributes v2 (`engine/order/address-line.ts`)                        | 0.5 KB        |

## Imports

| File                      | May import                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `engine/**`, `*/state/**` | `engine/**` and the feature's own `state`, and no browser globals                                     |
| `dom/*`                   | `engine/*` (boot files), `dom/*`                                                                      |
| `bindings/*`              | `engine/*` (boot files), `bindings/*`, `dom/*`                                                        |
| `checkout/*`              | `engine/*`, `checkout/*`, `dom/*`; `compat/checkout.ts` from `index.ts`                               |
| `order/*`                 | `engine/*`, `order/*`, `dom/*`; `compat/order.ts` from `index.ts`                                     |
| `analytics/*`             | `engine/*`, `compat/analytics/*`; `destinations/*` only via `import()`                                |
| `attributes/*`            | `engine/*`, `attributes/*`, `dom/*`                                                                   |
| `destinations/*`          | `engine/*`                                                                                            |
| `debug/*`                 | `engine/*`, `debug/*`, `vendor/tsugi/tsugi.css`; `vendor/tsugi/payment-icons.css` only via `import()` |
| `compat/*`                | `engine/*`, `compat/*`, `dom/dom.ts`, `checkout/form/names.ts`, `order/upsell.ts`                     |
| `boot.ts`                 | `engine/*` (boot files), `bindings/*`, `dom/*`, `compat/legacy/*`; lazy chunks only via `import()`    |
| `loader.ts`               | `config.ts`, `compat/config.ts`; `boot.ts` only via `import()`                                        |
| `config.ts`               | `compat/config.ts`                                                                                    |

Lazy chunks are `checkout/`, `order/`, `analytics/`, `attributes/`, `destinations/ga4.ts`, `destinations/meta.ts`,
`destinations/rudderstack/`, `debug/`, `bindings/slots.ts`, `bindings/cart-summary.ts`,
`attributes/i18n.ts`, `compat/exit-intent.ts`, `compat/widgets.ts`, `compat/legacy/index.ts` (with the `events.ts` and
`payloads.ts` beside it), plus `compat/checkout.ts`, `compat/order.ts` and `compat/analytics/`,
which only their own chunk may import statically.

The legacy chunk makes 0.4.x `next.on` names from the events. Boot keeps the rest of
`compat/legacy/`: `window.next`'s 0.4.x methods, the page moments (`checkout:started`, …) and the
picks and clicks the payloads read. A listener added before the chunk has loaded is held, and
hears the events since it was added once it has; from then on each as it happens.

A type used by one domain sits in that domain's `types.ts` (`engine/cart/`, `checkout/state/`) or
beside its actions (`OrderState` in `order/state.ts`); one that several domains share stays in
`engine/types.ts`, with the bodies the `Api` sends. The engine imports nothing outside `engine/`,
types included: a lazy chunk adds its `State` slice and its `Engine` actions with `declare module`
(`checkout/state/types.ts`, `order/state.ts`, `debug/state.ts`) and saves its slice through
`ctx.persist`.

`tests/architecture.test.ts` fails on: an import outside this table; a static import of a lazy
chunk; a static path from `boot.ts` to `checkout/state` or `order/state`; a browser global
(`document`, `window`, `location`, `navigator`, `history`, `localStorage`, `sessionStorage`,
`fetch`, `matchMedia`, `CustomEvent`, `requestIdleCallback`) in headless code; a folder deeper
than three levels; a default export or a re-export barrel; `console` outside `engine/runtime/log.ts` and
`loader.ts`; an import, type or `declare module`, from `engine/` to anywhere else; a compat import outside
an entry; a payment method's
label or alias outside `engine/order/payment.ts`.

## Tests

```
tests/
  engine/ checkout/state/ order/state.test.ts   headless code, runs in Node — proves it never needs a DOM
  bindings/ checkout/ order/ analytics/ compat/ debug/   the rest, happy-dom
  boot.test.ts · loader.test.ts · pages.test.ts · architecture.test.ts
  golden.test.ts                   binds and renders every fixture page, compared with tests/golden/; GOLDEN_PAGES=dir,dir
                                   adds my-campaigns and the starter templates (snapshots in .golden/, not committed)
  event-examples.test.ts           records docs/event-examples.json; fails on a public event without an example
  analytics-examples.test.ts       records docs/analytics-examples.json; fails on an analytics event without an example
  destinations/examples.test.ts    records docs/destination-examples.json; fails on a vendor event without an example
  fixtures/
    campaign.ts api.ts storage.ts engine.ts pages.ts order.ts rules.ts
    pages/<campaign>/<page>.html           my-campaigns pages, copied verbatim, source on line 1
    pages/starter/<campaign>-<page>.html   starter-template pages, copied verbatim, source commit on line 1
```

The Playwright scenarios (`bun run e2e`, the SDK from source, one file per concern in
`dev/e2e/scenarios/`) and the load-time run on the built `dist/` (`bun run perf`) are in `dev/`,
not part of `npm test`.

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
  page is generated from `EventMap` and `docs/event-examples.json`, and each tracking event's from
  `TrackingMap` and `docs/analytics-examples.json`, and each destination's from its event map
  (`DataLayerEventMap`, `Ga4EventMap`, `MetaEventMap`) and `docs/destination-examples.json`.

## Recipes

| Adding           | Where                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An attribute     | `src/bindings/<family>.ts` (or the checkout / order folder), registered in its `index.ts`; a test beside the others; a row in `docs/guides/attributes.md`                                       |
| An engine action | `src/engine/<domain>.ts`; test in `tests/engine/`; events in its group's file under `engine/events/` with TSDoc and `@group`, public in `boot.ts`, an example in `tests/event-examples.test.ts` |
| A lazy feature   | `src/<feature>/index.ts`, or a file in the folder it belongs to; `import()` from boot; a `LAZY` entry in `tests/architecture.test.ts`; a budget row in `scripts/size.mjs`                       |
| A deprecation    | the old name in `src/compat/<chunk>.ts` with `@deprecated Use …`; a row in `docs/guides/migrating-from-0.4.md`                                                                                  |
