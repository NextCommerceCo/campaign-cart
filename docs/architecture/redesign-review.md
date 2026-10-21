# Campaign SDK redesign — research & review

Status: October 2026. Input for the rewrite of `campaign-cart` (648 files, 143k LOC) into
`campaign-sdk`. Companion to [design.md](design.md) and the two diagrams in
`.archify/architecture-campaign-engine-*` and `.archify/architecture-storage-layer-*`.

Evidence comes from reading `campaign-cart/src` + `dist/` (built 15 Oct), and from counting
attribute usage in the real campaign repos (`my-campaigns`, `campaign-cart-starter-templates`,
`campaign-cart-example`, `campaigns-os`). Numbers in brackets are usage counts across those
repos. `campaigns-app` (the builder) emits **no** `data-next-*` markup at all — real pages are
static templates with a per-campaign `config.js`.

---

## 1. Why the old SDK is slow (measured)

A landing page today:

|                                                      | Raw         | Gzip        |
| ---------------------------------------------------- | ----------- | ----------- |
| Eager JS before boot (main + state + vendor + …)     | 234 KB      | 77 KB       |
| Analytics + attribution + error handler, every page  | 125 KB      | 32 KB       |
| Idle "preload" of checkout/upsell chunks, every page | 367 KB      | 106 KB      |
| **Total JS a landing page downloads**                | **~726 KB** | **~215 KB** |
| UMD fallback (single file)                           | 1,147 KB    | 284 KB      |

The vendor chunk (34 KB gz) carries **highlight.js and FontAwesome — debug-only** — plus
zustand and decimal.js. `test-mode.ts` (Konami listener) and `debug-utils` are in the main chunk.

Boot is a strict `await` chain (`sdk-initializer.ts:45-111`). Nothing on the page shows a price
until the **DOM scan at step 15**:

```
module waterfall (3 rounds)
→ geo: 3 requests to i18n-rules, up to 3 s        (default currencyBehavior:'auto')
→ attribution chunk  (→ utm-transfer chunk)
→ GET /campaigns/?currency=   (sessionStorage cache 10 min, so every new tab pays)
→ analytics chunk (117 KB) imported even when disabled
→ NextCampaign 3rd-party script, polled up to 5 s, then sleep 100 ms
→ sleep 50 ms (cart rehydration)
→ DOM scan: batches of 10, each batch awaits import()+initialize() before the next
→ window.next created, next:initialized
```

Other main-thread costs: 1,004 logger call sites each parsing `location.search`; 7 zustand
stores JSON-parsed at import; `storageScopeSuffix()` rehashed on every key; up to 3 body-wide
MutationObservers; **one `/carts/calculate` call per selector card** on init, on voucher change
and on currency change.

The only lazy pattern that works well today: Google Places / address autocomplete loads on first
field focus. Everything else is either eager or "preloaded" unconditionally.

---

## 2. What real pages actually use

From 10 campaigns in `my-campaigns` + starters (counts are total occurrences):

**Heavily used**

| Area                             | Attributes                                                                                                                                                                               | Count     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Display                          | `data-next-display` (`package.*`, `cart.*`, `order.*`, `bundle.*`)                                                                                                                       | 1,538     |
| Show/hide                        | `data-next-show` / `data-next-hide`                                                                                                                                                      | 360 / 169 |
| Format                           | `data-next-format` = `currency` 160, `percentage` 93, `address` 4, `phone` 2 — nothing else                                                                                              | 264       |
| Bundle selector (one-of-N cards) | `bundle-selector` 265, `bundle-card` 241, `bundle-display` 309, `bundle-id/items/vouchers`                                                                                               | ~1,100    |
| Order bumps (on/off toggles)     | `package-toggle` 97, `toggle-card` 131, `toggle-display` 202, `bump` 132                                                                                                                 | ~560      |
| Checkout                         | `checkout-field` 372, `component` 577 (shipping-field-row 130, error boxes), `payment-method/form` 220, `express-checkout` 96, `shipping-id` 113                                         | ~1,400    |
| Upsell                           | `upsell` 100, `upsell-action` add 56 / skip 55, `upsell-context` 75                                                                                                                      | ~350      |
| Receipt                          | `order.*` display, `order-items` 76                                                                                                                                                      | ~400      |
| Discounts list                   | `data-next-discounts` (offer / voucher)                                                                                                                                                  | 233       |
| Add to cart                      | `data-next-action="add-to-cart"` 94, `package-id` 218, `quantity` 155                                                                                                                    |           |
| JS API                           | `next.on` 185 (mostly exit-intent/fomo events), `next.exitIntent` 32, `next.cart.*` 24, `applyCoupon` 15, `getPackage` 12, `swapCart` 9, `getAvailableVariantAttributes` 32 (MV starter) |           |
| Meta                             | `next-page-type` 44, `next-funnel` 39, `next-success-url` 26, `next-upsell-accept/decline-url` 23                                                                                        |           |
| Config                           | every `config.js` sets `apiKey, currencyBehavior, paymentConfig.expressCheckout, addressConfig, googleMaps, analytics (only nextCampaign enabled), utmTransfer, storeName`               | 19 files  |

**Expression language actually used:** bare boolean paths (`cart.hasItems`, `package.hasSavings`,
`order.hasTax`), one call form `cart.hasCoupon()`, and `param.x=='y'`. **Zero** uses of `&&`,
`||`, `<`, `>`. 114 distinct display paths; the top 30 cover >90 %.

**Dead in practice (0–7 uses, mostly copied template code):** `package-selector` (5!),
`show-if/hide-if` (0), `data-next-await` (350 uses but documented no-op), `data-next-timer`
(0 — pages use their own JS), tooltip options, `address` auto-renderer (7), `checkout-review`
(14), `quantity-text`, `remove-item`, `clear-cart`, `prospect-cart` attributes (3; the feature
itself is wired by the checkout form), `next-debug` meta, `?debug`, `?reset`, profiles API,
`next.track/ready/version`, GTM/Facebook/RudderStack/custom providers (present but disabled in
every config), `data-next-element="timer"` and `catalog-component` (page-kit markers, not SDK).

---

## 3. Self-review of the first design pass

What I proposed earlier and what the evidence changes:

| Earlier claim                                                                             | Verdict                                                                                                                                        | Correction                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The campaign builder emits `data-funnel`, so two funnels on one key never share a cart." | **Wrong.** `campaigns-app` emits no SDK markup.                                                                                                | `data-funnel` lives in each campaign's `config.js` / script tag. Pages already carry `<meta name="next-funnel">` (39 uses) — read that as the fallback before the top-folder heuristic. |
| "Attributes only; the JS API is secondary."                                               | **Half right.** Pages use `next.on`, `next.cart.*`, `applyCoupon`, `getPackage`, variant lookups.                                              | Keep a small, typed `window.next` = `{on, off, dispatch/actions, getState, campaign helpers}`. Everything it can do, attributes do through the same actions.                            |
| "Features: cart · checkout · offers · display · countdown"                                | **Too generic.** Real split is by page type.                                                                                                   | Chunks follow the funnel: `core` (every page) · `checkout` · `order` (upsell + receipt). Countdown out (pages own it).                                                                  |
| "Lazy-load per feature when the page uses it"                                             | **Right idea, wrong grain.** The old SDK does exactly this (~30 chunks) and it causes the import waterfall.                                    | Three page-type chunks, one `modulepreload` each; prefetch the _next_ page's chunk on idle.                                                                                             |
| "Engine emits domain events; analytics maps to `dl_*`"                                    | Confirmed. 22 of 37 `dl_*` names are real; Facebook/GA4 bridges target a name that is never emitted.                                           | Ship the 22 real events; fix the upsell-purchase mapping.                                                                                                                               |
| "Debug subscribes to events"                                                              | Confirmed, plus: today's debug selectors **mutate real state** and Konami places **real test orders**.                                         | Debug = read-only subscriber + dispatches ordinary actions. Test mode = `pk_test_` key only. No Konami.                                                                                 |
| "Storage: localStorage cart, sessionStorage checkout"                                     | Confirmed, plus: a **plain-text PII cookie for 365 days** (`next_user_data`) and unhashed email/phone in every dataLayer event.                | No PII in cookies or dataLayer. Visitor id only.                                                                                                                                        |
| Geo / currency: not addressed                                                             | **Biggest single boot cost** (3 requests, 3 s cap, before the campaign fetch).                                                                 | Currency resolved server-side on the campaign GET (backend ask B5). No geo on landing.                                                                                                  |
| "Cart calculator duplicates server pricing"                                               | **Wrong.** The calculator is an API wrapper. The duplication is in ~10 display/selector files doing their own price math (one has a qty² bug). | Client does **zero** price math. Server numbers in, `Intl` out.                                                                                                                         |

---

## 4. Redesign matrix — every old feature

Legend: **Keep** = same job, rewritten small · **Merge** = folds into another primitive ·
**Cut** = not in v1 (page-kit or nobody uses it) · **Lazy** = how it loads.

### 4.1 Core (every page) — target ≤ 25 KB gzip total

| Old                                                                                            | LOC    | Decision              | New shape                                                                                                                                                                                                                                                          | Loads          |
| ---------------------------------------------------------------------------------------------- | ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `loader.js` + `index.ts` boot (18 serial steps)                                                | ~1,000 | **Rewrite**           | `campaign.js`: read key/funnel, **start campaign fetch immediately** (or read cache), `modulepreload` core, import. No retry loop, no sleeps.                                                                                                                      | inline, ~2 KB  |
| 7 zustand stores + `config` + `parameter`                                                      | ~2,000 | **Merge → one State** | Plain object `{campaign, cart, checkout, order, visitor, attribution, params, ui}`; persisted slices written on idle. No zustand, no decimal.js.                                                                                                                   | core           |
| `next-commerce/*` facade (67 methods, 13 files)                                                | 1,943  | **Cut 80 %**          | `window.next = {on, off, dispatch, actions.*, getState, campaign.{package, packageByVariants}}`. Drops callbacks API (never triggered), url-params API, attribution setters, `formatPrice` (broken `require()`), `validateCheckout`.                               | core           |
| `events.ts` + 79-key EventMap + DOM CustomEvents                                               |        | **Keep, shrink**      | One bus, ~20 domain events, **ring-buffer replay** so late subscribers (analytics, debug) see boot events. One DOM event `next:ready`.                                                                                                                             | core           |
| `attribute-scanner` + `dom-observer` + 3 MutationObservers                                     | ~1,200 | **Rewrite**           | One `querySelectorAll` on ready, group by attribute, bind synchronously. No MutationObserver; `next.bind(el)` for page JS that injects HTML.                                                                                                                       | core           |
| `storage.ts` + `storage-scope.ts`                                                              | 494    | **Rewrite**           | Adapter from the storage diagram: memory-first, probe once, envelope `{v,t,d}`, scope = `hash(key + funnel)`.                                                                                                                                                      | core           |
| `attribution-collector` + `utm-transfer` + `parameter` store + `url-utils.preserveQueryParams` | 1,290  | **Merge**             | Capture once on entry (utm_*, affid, sub1-5, gclid, fbclid, click ids, funnel, landing_page, referrer) → `visitor` slice. SDK-driven navigations carry only attribution params (not `debug`, `test`, `ignore`). Link rewriting = click-delegate only, no observer. | core (+ ~1 KB) |
| `logger.ts` (1,004 call sites)                                                                 | 131    | **Cut**               | Engine emits `debug` events only when a debug subscriber exists; zero cost otherwise. Setup mistakes → `console.warn` always.                                                                                                                                      | —              |
| `monitoring/error-handler` (patches `console.error`, hooks window errors)                      | 106    | **Cut**               | Engine catches its own action errors → `error` event → collector. No global patches.                                                                                                                                                                               | —              |
| `test-mode.ts` (Konami, eager)                                                                 | 367    | **Cut**               | `pk_test_` key = sandbox.                                                                                                                                                                                                                                          | —              |
| `currency-formatter`                                                                           | 218    | **Keep**              | `Intl.NumberFormat` cache keyed by locale+currency. Percent via Intl too.                                                                                                                                                                                          | core           |
| `i18n-rules` geo on every page                                                                 | 1,913  | **Move → checkout**   | Landing never calls i18n-rules. Currency from server (B5).                                                                                                                                                                                                         | checkout chunk |

### 4.2 Bindings — core (every page)

| Old                                                                                                                                    | LOC    | Decision                       | New attribute(s)                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-display` + 5 display enhancers + `PROPERTY_MAPPINGS` + 5-level format inference                                             | ~3,500 | **Rewrite as one**             | `data-next-text="cart.total"` (alias `data-next-display` in compat). Typed schema: `cart.* · package.* · card.* · order.* · checkout.* · shipping.* · param.* · campaign.*`. Format comes from the schema type (money/percent/int/text/date); `data-next-format` only for `address` / `phone`. No name heuristics, no `.raw`.       |
| `data-next-show` / `hide` (6 evaluator copies, broken mixed-domain)                                                                    | 2,115  | **Rewrite as one**             | Grammar = exactly what pages use: `path`, `!path`, `path == 'literal'`, `path != 'literal'`. One evaluator over the same schema. Hidden elements still re-evaluate (old bug: never re-shown).                                                                                                                                       |
| `bundle-selector` (3,177) + `package-selector` (1,080, 5 uses) + `selection-display` + `selector.*`/`bundle.*` displays                | ~5,500 | **Merge → `data-next-select`** | One "pick one card" primitive. A card = `[{package, qty}]` + optional vouchers + shipping. `data-next-card`, `data-next-selected`. Inside a card, `data-next-text="card.price"`. Swap mode = default (select mode = `data-next-select="none"`). Card prices from campaign data (no per-card network); server total after selection. |
| `package-toggle` + `toggle.*` display + bump detection                                                                                 | 1,624  | **Merge → `data-next-toggle`** | On/off bump: `data-next-toggle` + `data-next-package-id` + optional `data-next-qty-sync`. Upsell variant = same attribute, context from page.                                                                                                                                                                                       |
| `add-to-cart` + `cart/shared` properties                                                                                               | 625    | **Keep**                       | `data-next-add` (or `data-next-action="add-to-cart"` compat) reads the enclosing select/toggle through state, not DOM expandos. Optional `data-next-url`.                                                                                                                                                                           |
| `quantity-control` + `remove-item` + inline steppers                                                                                   | 532    | **Merge**                      | `data-next-qty="+1" / "-1" / "0"` on any element inside a line/card context.                                                                                                                                                                                                                                                        |
| `coupon` (3 attribute namespaces)                                                                                                      | 314    | **Keep**                       | `data-next-coupon` (input + button inside). Validity from the server response (B6), not two compare calls.                                                                                                                                                                                                                          |
| `cart-summary` (own template dialect + own condition evaluator) + `cart-item-list` + `discount-renderer`                               | ~2,000 | **Merge → `data-next-each`**   | `<template data-next-each="cart.lines">` with `data-next-text="line.*"` inside; same for `cart.discounts`, `order.lines`. No `{token}` language, no inline-styled default templates.                                                                                                                                                |
| `conditional-display` param conditions                                                                                                 |        | **Merge**                      | `param.*` is just another schema root.                                                                                                                                                                                                                                                                                              |
| `product-display` `campaign.*` + variant helpers                                                                                       | 690    | **Keep small**                 | `campaign.name/currency`, `package.<id>.*`; variant lookup as a pure helper `next.campaign.packageByVariants({color, size})` + `data-next-variant` binding (MV campaigns).                                                                                                                                                          |
| `i18n` (`data-next-i18n`, 15 uses)                                                                                                     | 119    | **Keep, lazy**                 | Fetch locale JSON only when the attribute is present.                                                                                                                                                                                                                                                                               |
| `timer`, `quantity-text`, `shipping-display`, `display-core` debug panel / format validator (dead), `features/display/index.ts` barrel | ~1,400 | **Cut**                        | Pages own countdowns. `shipping.*` comes from `cart.shipping.*` / `checkout.shipping.*`.                                                                                                                                                                                                                                            |
| `accordion`, `tooltip`, `scroll-hint`, `general-modal`, `loading-overlay`                                                              | ~1,700 | **Cut → page-kit**             | Pure UI, no cart knowledge. The SDK exposes `html[data-next-busy]` for pages to style.                                                                                                                                                                                                                                              |
| `simple-exit-intent` (`next.exitIntent`, 32 uses) + fomo                                                                               | 953    | **Cut → page-kit plugin**      | It is a popup. If analytics wants it, page calls `next.track('exit_intent_shown')`.                                                                                                                                                                                                                                                 |

### 4.3 Checkout chunk — target ≤ 30 KB gzip, loaded when `form[data-next-checkout]` exists

| Old                                                                                                                                                                                   | LOC     | Decision                  | New shape                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `checkout-form.enhancer` (3,024) + 30 context modules + `managers/processors/builders/services` + **two order-create paths, two redirect implementations, three success-URL readers** | ~17,000 | **Rewrite**               | One action `placeOrder()`: read form → (card? tokenize) → POST `/orders/` with `Idempotency-Key` → one redirect resolver (`payment_complete_url` → `data-next-success` → `order_status_url`). On failure: message in `[data-next-error]`, keep input, retry. |
| Field names: 3 schemes, mapping table in 8 places                                                                                                                                     |         | **One scheme**            | `data-next-field="first_name"` — API names everywhere. Billing = separate fields with `billing.` prefix; no DOM cloning. `os-*` legacy only via compat file.                                                                                                 |
| `validation/*` (4 postcode checks, 4 error-display layers)                                                                                                                            | 2,208   | **Shrink**                | Required + email + card readiness client-side; phone E.164 and postcode↔state via one i18n-rules `/validate` call on submit; server 400 is final. One error renderer.                                                                                        |
| `credit-card-service` + `next-payment` tokenizer                                                                                                                                      | 1,625   | **Keep, parallel**        | `payment.js` script injected at checkout boot **in parallel** with campaign/i18n (today it is awaited serially before address setup).                                                                                                                        |
| Express checkout (buttons → POST with `payment_method`)                                                                                                                               | ~800    | **Keep**                  | Same `placeOrder({payment_method})`. Availability list from campaign only (drop the config override). No wallet SDKs (there are none today either).                                                                                                          |
| Redirect APMs (klarna, ideal, …)                                                                                                                                                      |         | **Keep**                  | Same path, no token.                                                                                                                                                                                                                                         |
| `i18n-rules` country/states/labels                                                                                                                                                    | 1,913   | **Keep, lazy, cached**    | One `/countries/:cc?include=states` per country, 1 h cache; **prefetched on landing idle** so checkout has it.                                                                                                                                               |
| `address-autocomplete` (Google on focus)                                                                                                                                              | 1,016   | **Keep the lazy pattern** | Load on first focus. Drop NextCommerce autocomplete (`addressConfig.enableAutocomplete` off everywhere).                                                                                                                                                     |
| `address-form` auto-renderer (`data-next-address`, 7 uses)                                                                                                                            | 515     | **Cut**                   | Hand-written forms only.                                                                                                                                                                                                                                     |
| `prospect-cart` (triggers, debounce, 5 dead endpoints)                                                                                                                                | 1,361   | **Shrink → ~80 LOC**      | `saveProspect()` once on email blur → POST `/carts/`. Pages listen to `prospect.saved` (24 uses of the DOM event today).                                                                                                                                     |
| Multi-step (`checkout-step`, 7 uses, one campaign)                                                                                                                                    |         | **Decide**                | Either keep `data-next-step` as pure show/hide of sections with per-step required check, or drop and make steps separate pages. Ask.                                                                                                                         |
| `checkout-review` (14)                                                                                                                                                                | 295     | **Merge**                 | `data-next-text="checkout.email"`.                                                                                                                                                                                                                           |
| `debug/test-order-manager`, Konami test order                                                                                                                                         | 569     | **Cut**                   |                                                                                                                                                                                                                                                              |

### 4.4 Order chunk — upsell + receipt, loaded when `order.*` / `data-next-upsell` present

| Old                                                                                                                                                    | LOC    | Decision               | New shape                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order/upsell` (1,375) + `cart/accept-upsell` (568) + toggle upsell path + `next.addUpsell` — 4 entry points, 2 duplicate-checks, 2 redirect resolvers | ~2,500 | **Merge → one action** | `acceptUpsell({items})` → POST `/orders/{ref}/upsells/` with `Idempotency-Key`; `declineUpsell()`. Bindings: `data-next-upsell-accept="/up2"`, `data-next-upsell-decline="/thank-you"`, card selection via `data-next-select`. `ref_id` always appended to the next URL. Duplicate = server says so (B1) + one client flag. |
| `order-display` + `order-item-list` + order loaded twice                                                                                               | ~900   | **Merge**              | `order.*` in the schema; `data-next-each="order.lines"`. Order loaded once from `?ref_id` by the engine, cached 15 min in session.                                                                                                                                                                                          |
| `GeneralModal.showDuplicateUpsell`                                                                                                                     |        | **Cut**                | Button disabled state + message.                                                                                                                                                                                                                                                                                            |

### 4.5 Analytics — subscriber, loaded on idle (≤ 8 KB gzip)

| Old                                                                                                                                               | LOC | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11,271 LOC: 5 providers, 4 validation layers, 37 event names (22 real), 4 session ids, 2 `event_id` generators, 2 `pushState` patches, PII cookie |     | **Rewrite → ~400 LOC.** Map domain events → the 22 real `dl_*` names. Sinks: `dataLayer` (GTM) + NEXT collector via `sendBeacon` with retry queue. One `event_id`, one session id. Replay buffer means loading late loses nothing. Facebook/TikTok mapping tables only if the campaign enables them (none do today). **No PII** in cookies or in `user_properties` — hashed email at most, visitor id otherwise. No consent gate in v1, but events are buffered so one can be added without changing the engine. |
| `view-item-list` MutationObserver scan of `[data-next-package-id]`                                                                                |     | **Replace**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Emit `view_item_list` from the select/toggle bindings themselves (they know the packages). |
| NextCampaign 3rd-party script (polled 5 s on the boot path)                                                                                       |     | **Replace**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Collector call from the analytics subscriber; nothing third-party on the boot path.        |
| `utilities/NextDataLayer_GA4.js`, `TransformManual.js`, Elevar formatter                                                                          |     | **Cut**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### 4.6 Debug — separate script, `?debug=1` only (any size)

Event log, state inspector, storage tier + resolved scope, resolved attributes per element
(x-ray), network log. Country/currency switchers dispatch ordinary actions (`setCurrency`),
not private store writes. No fetch patching. Not in any production chunk.

---

## 5. Lazy vs preload — the plan

|                               | What                                                                                                                                         | How                                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inline / first**            | `campaign.js` loader                                                                                                                         | Reads `data-campaign`/`data-funnel`, starts `fetch(campaign)` before any module parses, `modulepreload` core.                                                                     |
| **Eager (core)**              | engine + core bindings                                                                                                                       | One chunk, ≤ 25 KB gz. Renders from the cached campaign snapshot **synchronously** on first run (stale-while-revalidate, localStorage 10 min), then patches when the fetch lands. |
| **By attribute**              | `checkout` chunk, `order` chunk, i18n texts, variant picker                                                                                  | Decided by the first scan; one `import()` each, with the chunk's own `modulepreload` list so there is no secondary waterfall.                                                     |
| **By idle**                   | analytics, link-param transfer                                                                                                               | `requestIdleCallback` (timeout 2 s) after `next:ready`. Replay buffer covers events emitted before they attach.                                                                   |
| **By intent**                 | Google Places                                                                                                                                | First focus on an address field (keep today's pattern).                                                                                                                           |
| **By URL / key**              | debug script, sandbox API                                                                                                                    | `?debug=1`; `pk_test_`.                                                                                                                                                           |
| **Prefetch on landing idle**  | `checkout` chunk, `/countries/:cc` for the visitor's country, `preconnect` to the payment host                                               | `<link rel=prefetch>` / warm cache. Optionally Speculation Rules `prerender` of the checkout link — measure on mobile before enabling.                                            |
| **Prefetch on checkout idle** | `order` chunk                                                                                                                                | same                                                                                                                                                                              |
| **Never**                     | UMD fallback, debug code in core, highlight.js/FontAwesome, zustand, decimal.js, geo on landing, per-card calculate calls, MutationObservers |                                                                                                                                                                                   |

Target landing boot:

```
campaign.js (2 KB)          ─ fetch campaign starts here
core chunk (≤25 KB gz)      ─ restore state (sync, <5 ms) → scan → render from cache → next:ready
campaign fetch resolves     ─ patch texts; one /carts/calculate if the cart has items
idle                        ─ analytics attaches, replays; prefetch checkout chunk + countries
```

First prices on screen: one script execution after cache; one RTT without. Nothing third-party,
nothing geo, nothing analytics in front of the first paint.

---

## 6. Backend asks (beyond design.md B1–B4)

| #   | Need                                                                                                                | Why                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| B5  | `GET /campaigns/?currency=auto` resolves currency from `CF-IPCountry` / `Accept-Language`, with `Vary` so it caches | Removes the 3-request geo step from every landing page |
| B6  | `/carts/calculate` response says per voucher `applied: true/false` + reason                                         | Coupon validity without the two-call compare           |
| B7  | Campaign GET includes per-package prices at qty 1..n (or a batch calculate)                                         | Selector cards render without N network calls          |
| B8  | `/orders/{ref}` and `/orders/{ref}/upsells/` honour `Idempotency-Key` and return "already added"                    | One client flag instead of four duplicate guards       |

---

## 7. Open decisions

1. Multi-step checkout (`shop-three-step`, one campaign): keep `data-next-step` or make steps pages?
2. Compat file: ship `compat.js` mapping old attribute names (`data-next-display`, `bundle-*`,
   `toggle-*`, `os-*`) for the 10 live campaigns, or migrate the templates in `my-campaigns`
   and ship none? (Migrating is ~40 distinct attribute names; the templates are shared includes.)
3. Exit-intent / fomo: page-kit plugin or SDK optional plugin? (Page-kit recommended.)
4. Where `data-funnel` is declared for the live campaigns: `config.js` (already per-campaign) vs
   the script tag. Either works; the SDK reads script tag → `nextConfig.funnel` → `next-funnel`
   meta → top folder.
