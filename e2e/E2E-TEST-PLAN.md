# E2E Test Coverage Task — all features + core

Goal: bring Playwright E2E coverage to **every feature enhancer and every core
service**, following the model already established in
[add-to-cart.spec.ts](./add-to-cart.spec.ts).

## The model to copy (do not deviate without reason)

Each spec:

1. Loads the **real SDK** from the Vite dev server (`webServer` in
   [playwright.config.ts](../playwright.config.ts) starts `npm run dev` on
   `:3000`, `baseURL` is set).
2. Loads a **fixture HTML** under [e2e/fixtures/](./fixtures/) containing the
   `data-next-*` attributes under test + `<meta name="next-api-key">` +
   `<script type="module" src="/src/index.ts">`.
3. **Stubs the network** with `page.route('**/api/v1/...**', ...)` — never hits
   `campaigns.apps.29next.com`. Only the network is faked; the SDK is real.
4. Waits for boot: `await page.waitForFunction(() => Boolean(window.next?.on))`.
5. Asserts on **EventBus events** (`window.next.on(...)`) and/or **DOM state**
   (`data-next-display` text, managed CSS classes like `next-selected`,
   `next-in-cart`).

Routes to stub per fixture (extend as needed):
- `**/api/v1/campaigns/**` → campaign JSON (packages, currencies, shipping)
- `**/api/v1/carts/calculate/**` → `{ lines, totals }`
- `**/api/v1/orders/**` → order/upsell JSON (checkout + order specs)

### Shared setup work (do first — unblocks everything)

- [x] Extract the inline `CAMPAIGN` object + `page.route` beforeEach into a
      reusable helper under `e2e/fixtures/` — `campaign.ts` (`MINIMAL_CAMPAIGN`,
      `RICH_CAMPAIGN`), `order.ts` (`TEST_ORDER`), `routes.ts` (`stubCampaign`,
      `stubCart`, `stubOrder`, `stubProspectCart`, `stubAddressAutocomplete`,
      `stubAll`, `bootSdk`, `captureEvents`).
- [x] Add a richer multi-package campaign fixture (recurring package, variants,
      shipping methods, multiple currencies) — `RICH_CAMPAIGN`.
- [x] Add an order/upsell stub fixture for checkout + order specs — `TEST_ORDER`.
- [x] Confirm Playwright browsers installed (`npx playwright install`).

> **Playwright config fix:** `webServer` readiness now uses `port: 3000` (TCP)
> instead of an HTTP `url` probe — the dev server has no root route (`GET /` →
> 404), which the HTTP probe treated as never-ready and timed out.
> **Run E2E without the HTML report hanging:** the `html` reporter serves a
> blocking report at the end; run with `PLAYWRIGHT_HTML_OPEN=never` (or
> `--reporter=line`) in non-interactive/CI contexts.

---

## Features — one spec + fixture per enhancer

Each item = one `<feature>.spec.ts` + one `fixtures/<feature>.html`. Assert the
enhancer's **events, managed attributes/classes, and display output** (see each
feature's `guide/reference/events.md` + `attributes.md` for the contract).

### cart/
- [x] `add-to-cart` — DONE (model spec). NOTE: `cart.quantity` is **not** a real
      token — use `cart.totalQuantity`/`cart.itemCount`. `cart:item-added` fires
      twice (store op without `source`, then handler with `source`).
- [x] `package-selector` — select card → `next-selected` class, `selector:item-selected` / `selector:selection-changed`, `data-selected-package`. NOTE: auto-selects the first card on boot.
- [x] `package-toggle` — toggle add/remove, `next-in-cart`/`next-not-in-cart` sync
- [x] `bundle-selector` — bundle selection → cart contents
- [x] `quantity-control` — +/- updates cart qty + emits `cart:quantity-changed`
- [x] `remove-item` — removes line, cart empties
- [x] `cart-item-list` — renders lines on cart change; **re-render safety** verified (add 2nd item re-renders correctly; in-row buttons re-enhanced)
- [x] `cart-summary` — totals/subtotal recompute on change; `next-cart-empty`/`next-cart-has-items`
- [x] `accept-upsell` — covered by `upsell.spec.ts` accept flow → order upsell added
- [x] `coupon` — apply → `coupon:applied`; re-apply → `coupon:validation-failed`. FINDING: no offer/voucher validation exists (see Findings), so an "invalid" code cannot fail — only a re-applied one.
- [x] **conflict guard** (`conflict-guard.spec.ts`): FINDING — swap-selector + add-to-cart is NOT runtime-guarded; it double-writes *quantity* (`totalQuantity` climbs) though line count (`itemCount`) stays 1. Spec locks the real invariant + documents the hazard.

### display/
- [x] `cart-display` — `cart.*` tokens update live
- [x] `product-display` — `package.*` fields render (explicit-id path, `<img>` src, ancestor context)
- [x] `selection-display` — reflects current selector selection
- [x] `order-display` — `order.*` tokens after URL auto-load. FINDING: `next-loaded` class is not applied on the URL-auto-load path (subscription fires only on change); content still renders + `display-visible`.
- [x] `conditional-display` — `data-next-show`/`data-next-hide` toggles on state
- [x] `shipping-display` — shipping method/price render (`shipping.name` resolves to `code`)
- [x] `timer` — countdown, `timer:expired` on expiry, hide/reveal swap
- [x] `quantity-text` — qty text binding (`{qty}`/`{qty*N}`/`{singular|plural}`)

### checkout/
- [x] `checkout-form` — `checkout:form-initialized` + field validation (`has-error`/`next-error-field`/`no-error`). Real payment/Spreedly tokenization + order completion not exercised headless (limitation).
- [x] `checkout-review` — child `[data-next-checkout-review]` renders values; `next-review-empty`
- [x] `express-checkout-container` — injects button + `express-checkout:initialized`; `next-cart-empty` on cart change (not initial render)
- [x] `address-autocomplete` — NextCommerce fallback provider drives `address:autocomplete-filled` (Google Maps provider needs external SDK — limitation)
- [x] `prospect-cart` — create → DOM CustomEvent `next:prospect-cart-created`. NOTE: creates via `POST /api/v1/carts/` (not `/prospect-carts/`).

### order/
- [x] `upsell` — `upsell:initialized`; accept → `upsell:adding` then `upsell:added` (stub order + upsell)
- [x] `order-item-list` — renders order lines from orderStore (URL auto-load)

### behavior/
- [x] `fomo-popup` — `window.next.fomo(config)` → `fomo:shown` + `.next-fomo-wrapper.next-fomo-show`
- [x] `simple-exit-intent` — `window.next.exitIntent(opts)` → desktop mouse-out trigger → `exit-intent:shown`/`exit-intent:closed`. Desktop-only (`disableOnMobile` defaults true) — skipped on mobile projects.

### ui/
- [x] `accordion` — expand/collapse, aria state, `accordion:toggled`/`opened`/`closed`
- [x] `tooltip` — show/hide on hover/focus, `role="tooltip"` + `aria-describedby`
- [x] `scroll-hint` — `scroll-hint:updated`; active at **top** (not bottom) when content overflows

---

## Core — services + cross-cutting behavior

Core has no `data-next-*` of its own; test it through fixtures that exercise the
service and assert observable behavior (events, storage, DOM scan results).

- [x] `sdk-initializer` / `next-commerce` — boot, `window.next` facade, `.on/.off` work, `next-display-ready`, double-init guard. NOTE: no public `.emit` on the facade (use `EventBus.getInstance().emit`).
- [x] `attribute-scanner` — scans DOM, instantiates enhancers; **dynamically-added nodes** enhanced (via `data-next-display`; DOMObserver's `attributeFilter` excludes `data-next-action`). FINDING: removed nodes are re-enhanced (no `isConnected` check) and parent removal doesn't tear down children — teardown leak.
- [x] `base/` — focused `base-teardown.spec.ts` drives the real `super.destroy()` contract (subscription stops) directly, given the DOM-removal leak above.
- [x] `events` (EventBus) — cross-enhancer round-trip through `window.next.on` + `off` unsubscribe
- [x] `storage` — cart→`next-cart-state`, campaign→`next-campaign-cache_{CUR}`, order→`next-order` (15-min TTL via `orderLoadedAt`/`isOrderExpired`), attribution→`next-attribution`; same-session restore verified
- [x] `attribution/` — UTM/gclid captured from URL into attribution store, available for checkout
- [x] `country-service` — country/state selects populate (external CDN stubbed for determinism)
- [x] `analytics/` — `dl_*` on `window.NextDataLayer`; assert dataLayer contents. NOTE: analytics is OFF by default (needs `window.nextConfig.analytics.enabled`+`mode:'auto'`); GTM provider mirrors to `window.dataLayer`.
- [x] `monitoring/error-handler` — throwing enhancer doesn't break the page; window errors → `error:occurred`, page survives
- [x] `debug/` — mounts `#next-debug-overlay-host` (Shadow DOM). NOTE: gated on `?debugger=true`, NOT `?debug=true` (which only enables scanner perf logging).

---

## Definition of done

- [x] Every feature enhancer has a spec asserting its documented events + DOM/attribute contract. **40 spec files, 79 tests.**
- [x] Core boot, scan, dynamic-node enhancement, teardown, persistence, attribution, and analytics dataLayer are covered.
- [x] Shared fixture/route helpers used (no per-spec copy-paste of campaign JSON).
- [~] `npm run test:e2e` green across the configured projects. **Chromium + Mobile Chrome (Pixel 5): 156 passed, 2 skipped** (mobile-only skip of the desktop exit-intent trigger). Firefox/WebKit require `npx playwright install firefox webkit` in this environment.
- [x] New behavior discovered while testing is captured below (Findings). These are behavior **discrepancies / likely bugs**, not intended behaviors — surfaced for triage rather than enshrined into `guide/` docs.

## Findings & discrepancies discovered during E2E

Ranked roughly by impact. Each was verified against source; specs assert the ACTUAL behavior and document the finding inline.

1. **`getCartData().cartLines` is always empty (likely bug, public API).** `next-commerce.ts` returns `cartLines: cartStore.enrichedItems`, but `enrichedItems` has no writer anywhere in `src/` (only initialized to `[]`). An in-code comment confirms it (`core/analytics/events/ecommerce-events.ts`). Any integrator reading cart lines from the public `getCartData()` gets `[]` regardless of contents. Cart specs assert on `state.items`-backed DOM/displays instead.
2. **DOM-removal teardown leak (likely bug).** `AttributeScanner.enhanceElement` has no `isConnected` check and `DOMObserver` re-queues removed nodes as "added" (~16ms later), so a removed enhanced node is torn down then **re-enhanced** and keeps updating. Also, removing a *parent* container never tears down enhanced *children*. `base-teardown.spec.ts` drives the real `super.destroy()` contract directly as a result.
3. **Swap-selector ↔ add-to-cart double-writes quantity (contract is advisory only).** The behavior-contract warns not to pair them, but nothing enforces it at runtime: each bound add click increments quantity, so `totalQuantity` climbs (1→2→4) while `itemCount` stays 1. `conflict-guard.spec.ts` locks the line-count invariant and documents the quantity hazard.
4. **`order-display` never applies `next-loaded`/`next-loading`/`next-error` on the URL auto-load path.** The order is awaited before the store subscription is set up, and Zustand subscriptions fire only on change — so the class-toggling handler never runs for the already-present order. Content still renders and the element gets `display-visible`.
5. **Coupon has no offer/voucher validation.** `apply-coupon.ts` upper-cases the code and always returns success unless it's already applied. `coupon:validation-failed` is only reachable by re-applying an already-applied code — not by an "invalid" code.
6. **Debug overlay is gated on `?debugger=true`, not `?debug=true`.** `?debug=true` only turns on AttributeScanner perf logging.
7. **`window.next` exposes no public `emit`** — only `on`/`off`. Emit via `EventBus.getInstance().emit(...)` (same singleton).
8. **DOMObserver `attributeFilter` excludes `data-next-action`** — dynamically-injected add-to-cart buttons are not auto-enhanced; injected `data-next-display` nodes are.
9. **`express-checkout` `next-cart-empty` is applied only on a cart-store change, not initial render** (Zustand subscriptions don't fire on initial state). Same pattern as #4.
10. **`prospect-cart` creates via `POST /api/v1/carts/`, not `/api/v1/prospect-carts/`** — the `stubProspectCart` helper stubs an endpoint the create path doesn't call (kept for the other prospect endpoints).
11. **`scroll-hint` active-state is at the TOP** (`scrollTop <= threshold` + overflow), not the bottom.
12. **`package-selector` auto-selects the first card on boot** (`isPreSelected ?? items[0]`), so a bound `selection-display` renders package 1 immediately.
13. Minor: `analytics` is OFF by default (needs `window.nextConfig.analytics.enabled` + `mode:'auto'`; `dl_*` land on `window.NextDataLayer`, GTM mirrors to `window.dataLayer`); `shipping.name` resolves to the method `code`.

### Environment/tooling notes
- `webServer` readiness switched to `port: 3000` (TCP) — the HTTP `url` probe hung on the dev server's `GET / → 404`.
- Run in CI/non-interactive with `PLAYWRIGHT_HTML_OPEN=never` so the `html` reporter doesn't block serving a report.
- `npm run lint` is **pre-existing broken** (its `.eslintrc.json` extends a missing `@typescript-eslint/recommended`) and only lints `src`, not `e2e`. `npm run type-check` passes.

## Suggested order

1. Shared helpers → 2. cart/ (highest-value, most interconnected) →
3. display/ → 4. checkout/ + order/ → 5. core (boot/scan/persist/attribution/
analytics) → 6. behavior/ + ui/.
