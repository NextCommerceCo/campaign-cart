# core/

**The engine** — the machinery that runs the SDK. The *classes* here are internal and
free to move; consumers only ever import `src/index.ts`. The *behaviour* is a different
matter, and conflating the two is a mistake worth avoiding: core is where the boot
sequence, the API-key meta tag, the storage keys and their expiry, `?debug=true`, the
`window.next` surface, error capture, attribution, and all analytics live. A page author
never imports `SDKInitializer` and depends entirely on what it does.

> **Reader-facing documentation for that behaviour is in [`guide/`](./guide/)**, mostly
> generated from this source and drift-checked. Start at
> [`guide/overview.md`](./guide/overview.md) for the map of subsystems; the contracts —
> boot order, storage keys and TTLs, meta tags, URL parameters, logs, errors, the
> analytics catalogue, and the `window.next` API — are under
> [`guide/reference/`](./guide/reference/). The inventory that ties them together is
> [`src/docs/content/core-subsystems.ts`](../docs/content/core-subsystems.ts), and
> `npm run docs:coverage` measures it. The machinery that generates these pages lives
> in [`src/docs/`](../docs/) — a build-time layer, deliberately outside the engine.

## Contents

| Path | What it is |
|------|------------|
| `attribute-scanner/` | Discovers `data-next-*` elements and instantiates the bound feature (dynamic `import()` per feature) |
| `sdk-initializer/` | Boot sequence — config, location/currency, campaign load, analytics, DOM scan |
| `next-commerce/` | The programmatic SDK facade (`NextCommerce` / `sdk.*`, incl. `sdk.cart.*`). The class — constructor, singleton, and every method's signature/TSDoc — stays here; each method's body delegates to a same-named function in a sibling module in the same folder, grouped by `@category`: `next-commerce.cart.ts`, `next-commerce.campaign.ts`, `next-commerce.events.ts`, `next-commerce.analytics.ts`, `next-commerce.attribution.ts` (Metadata + Attribution), `next-commerce.shipping.ts`, `next-commerce.utility.ts`, `next-commerce.coupons.ts`, `next-commerce.popups.ts`, `next-commerce.upsells.ts`, `next-commerce.url-params.ts` |
| `base/` | Base feature classes (`base-enhancer`, `base-cart-enhancer`, `base-action-enhancer`, `base-display-enhancer` + the display routing table, validator and error boundary it needs) + `attribute-parser`, `dom-observer`. See [`base/README.md`](./base/README.md) for why the display base is here rather than in `features/display/` |
| `analytics/` | Analytics subsystem (providers, events, tracking) — a lazy `analytics` chunk, not a feature |
| `debug/` | Dev-only debug overlay/panels — loaded via dynamic `import()` so it never ships in the production bundle |
| `attribution/` | Attribution capture run at SDK init: `attribution-collector` (reads UTM/referrer/funnel into `attribution.state`) and `utm-transfer` (propagates URL params to page links) |
| `rendering/` | Template machinery shared by features that render lists and price lines: `template-renderer` (renders `data-next-*` templates to DOM), `discount-renderer` (formats/renders discount lines), `slot-conditionals` (evaluates conditional template slots) |
| `ui/` | DOM widgets shared across feature categories: `loading-overlay` (shown during add-to-cart / checkout submit) and `general-modal` (generic dialog shell). Not enhancers — no `data-next-*` activation, no manifest, no guide |
| `monitoring/` | `error-handler` — central runtime error capture, emits on the event bus |
| `logger.ts` | `Logger` / `createLogger` — leveled logging used across every layer |
| `events.ts` | `EventBus` — the type-safe SDK event bus (`EventMap`) |
| `storage.ts` | `StorageManager` / `sessionStorageManager` — persistence helper backing the stores' `persist` |
| `country-service/` | Loads and caches country/state geographic data for checkout, debug, and init |
| `url-utils.ts` | `preserveQueryParams` / `navigateWithParams` — carries tracking parameters across navigations, and `isDebugMode` / `isDebuggerMode`. Reads **and writes** `parameter.state`, which is why it is not a `utils/` helper |
| `currency-formatter.ts` | `CurrencyFormatter` + the `formatCurrency` / `formatNumber` / `formatPercentage` / `getCurrencySymbol` helpers. Falls back to the campaign's currency and the visitor's locale when a caller does not name one, so it reads `campaign.state` and `config.state` |
| `test-mode.ts` | Detects and manages SDK test mode |

## Dependency direction

`core/` depends on **nothing above it** — never imports `features/`. It may use
`state/`, `types/`, `utils/`. Features depend on core, not the reverse.

This is why `rendering/` and `ui/` live here rather than in a feature. Both are used
from more than one category — `ui/loading-overlay` by `cart/accept-upsell`,
`checkout/`, and `order/upsell` — and the skill's §2 gives shared logic exactly three
homes: `core/`, `state/`, `utils/`. Putting a widget in `features/ui/` instead would
make every other category import across features, which is the violation §2 exists to
prevent. They replaced a former top-level `shared/` folder that had no rule governing
what belonged in it.

`url-utils.ts` and `currency-formatter.ts` are here for the mirror-image reason. Both
read state — `url-utils` also *writes* to `parameter.state` — and `src/utils/` is for
pure helpers that import nothing above them. Leaving them there made the rule in
`CLAUDE.md` ("do not import stores here") false in two of that folder's four files.
`utils/` now holds only `cookies.ts` and `voucher.ts`, and the rule is true again.
(`typeGuards.ts` was there too until 2026-08-02, when it turned out to have 23 exports and
no callers at all.)

## Pending redesign (skill §6)

The engine still uses `.getInstance()` singletons. The target is a `client.ts`
composition root that creates dependencies (`http` + `IHttpClient`, events,
state) once and injects them into features. That is a deliberate separate phase,
not a folder move — see the `sdk-structure` skill.

## Docs

**Core is a published TypeDoc entry point.** `typedoc.json` lists `src/core` (alongside
`src/index.ts` and `src/state`) as an entry point with `entryPointStrategy: "expand"`, so
every exported class, function, and type here — `AttributeScanner`, `SDKInitializer`,
`EventBus`, `Logger`, and the rest — gets its own page in the generated site, for
**contributors** browsing or extending the SDK.

This corrects what this file used to say: it claimed core was kept out of the reference
because it is "marked `@internal` (`excludeInternal: true`)". That was already wrong even
before core became an entry point — an AST scan found core was excluded by two other
things: `src/index.ts` being the *only* entry point (re-exporting four core symbols only,
leaving the rest unreachable) and a Fumadocs build step that deleted class pages outright.
Neither applies now that core is directly reachable.

`excludeInternal: true` is still the project's TypeDoc setting, and the `@internal` tag
still means what it always meant — "hide this page from the generated site" — but the tag
only does anything when it sits directly on an exported declaration (a class, function,
exported const, etc.). A comment block in `docs/` that documents a *file* rather than a
declaration is not attached to anything TypeDoc reads, so tagging it `@internal` is a
no-op either way. If you are adding one to genuinely hide a member, tag the declaration
itself and confirm it disappears from a local `npm run docs` build — don't assume the tag
worked from reading the source.

The distinction that still matters when deciding where to put an explanation: **TSDoc
inside `src/core/**` is now reader-visible, but only to contributors reading the reference
pages** — it documents *how the code is built*, for the next maintainer. It is not where a
page author looks. Anything a page author needs — boot order, meta tags, storage keys and
TTLs, URL parameters, the `window.next` API, logs, errors — stays in
[`guide/`](./guide/), which is hand-written (mostly generated from this source) for
exactly that audience. Publishing core does not merge these two docs; it gives the
contributor-facing one a home.

Orientation for contributors lives in this README and the `sdk-structure` skill.
