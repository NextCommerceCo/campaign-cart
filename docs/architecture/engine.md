# Engine design

Status: agreed design, 21 Oct 2026 (revised after an independent review). Reviews the Engine as
built (commit `d0c68899`) against what checkout, upsell and receipt need, and sets the shape to
build them on. File layout and import rules: [structure.md](structure.md).

## 1. What the Engine has to handle

From the live campaign pages (`my-campaigns`) and the 0.4.x API contract:

| Area      | Needs                                                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign  | Snapshot for first paint, fresh copy from the loader's request, currency                                                                                                                                                                                               |
| Cart      | Line groups (bundle pick, bumps, items), line properties, upsell-flagged bumps, coupons, shipping method, server totals, latest-wins recalculation                                                                                                                     |
| Selectors | Bundle cards on landing/checkout (swap into the cart); upsell offer cards with a quantity stepper and offer pricing (`/carts/calculate/?upsell=true`)                                                                                                                  |
| Checkout  | Form draft, same-as-shipping, payment method (page words → API codes), 3-step checkouts, country list and rules (states, required fields, postcode), remote postcode/phone checks, field errors, prospect cart once, place order for card / redirect methods / express |
| Order     | `ref_id` from the URL, load the order, accept an offer once even after Back, skip, receipt values                                                                                                                                                                      |
| Visit     | URL params, attribution, first landing page                                                                                                                                                                                                                            |
| Analytics | `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase` once and only when paid, `upsell_purchase` once, viewed/skipped upsell                                                                                                                           |

## 2. Review of the Engine as built

Stays: no DOM (tests run in Node); one event bus with replay; latest-wins calculation; storage
that degrades to memory; scope = key + funnel; no card data stored.

| #   | Problem                                                                            | Effect                                                                                                  |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| P1  | One class holds every action, the cart hard-coded into it (`engine.ts`, 281 lines) | Checkout and order would triple it                                                                      |
| P2  | Four ways to change state (`commit`, `setCart`, `select`, direct assignment)       | Saving and events are done by hand per path; two review bugs came from a path that forgot one           |
| P3  | Rendering is driven by domain events                                               | `cart.updated` fires for the `calculating` flag; a change with no event is never rendered               |
| P4  | Selector cards in the DOM layer, the pick in the Engine                            | `bundle.x.price` needs a callback into bindings; upsells need card lines the Engine lacks               |
| P5  | `readSession` / `writeSession`                                                     | Storage keys outside the Engine's schema                                                                |
| P6  | Async actions return `Promise<void>`, errors only as a string event                | Place order and accept offer cannot hand back what happened                                             |
| P7  | No single-flight                                                                   | A double click could place two orders or two upsells                                                    |
| P8  | Boot split between `core.ts` and the Engine                                        | restore → load → ready ordered in two places                                                            |
| P9  | Lines have no `properties` / `isUpsell`; `mergeLines` keys on package id           | Personalised lines and upsell bumps (all 8 campaigns) cannot be sent; two lines of one package collapse |
| P10 | `ref_id` is kept as a session param                                                | A stale `ref_id` rides on every later same-site link                                                    |

## 3. Design

Kept: one write path (Action → State → Event), no DOM in the Engine, everything else
subscribes. Changed:

1. **One `update(slice, patch)` path.** It saves the slice if persisted and schedules one change
   notification. No action assigns state directly.
2. **State in slices** with declared persistence (3.1).
3. **Actions grouped by domain**, one file each. `cart` and `selectors` are in the core chunk;
   `checkout` and `order` are attached by their lazy chunks, so landing pages do not download
   them (`engine.checkout = createCheckout(context)`).
4. **Two kinds of notification.** `subscribe(fn)` — state changed, once per tick, for
   rendering. `on(event)` — domain events, for analytics and page scripts.
5. **Errors live in state.** Field, decline and server errors go to `checkout.errors` /
   `order.status` and render like any state. `placeOrder` / `acceptUpsell` resolve to the
   order or `undefined`. The `error` event is for analytics and debug only.
6. **The Engine returns data, the DOM layer navigates.** Pure `redirectFor(order, successUrl)`
   and `nextUrl(target, params)` build URLs (adding `ref_id` and session params); the binding
   owns timing (upsell moves on after 1 s on error, as today).

### 3.1 State

| Slice       | Holds                                                                                                                                  | Stored                                                          | Lifetime                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| `campaign`  | campaign JSON                                                                                                                          | localStorage                                                    | 10 min snapshot                        |
| `cart`      | groups of lines `{packageId, quantity, isUpsell?, properties?}`, coupons, dismissed bumps, shipping id, summary, calculating, `frozen` | sessionStorage (not summary / calculating / frozen)             | the tab                                |
| `selectors` | per selector: cards, picked card, mode `swap \| select \| offer`, offer quotes per card (stepper quantity lands with the order chunk)  | not stored; registered by bindings                              | the page                               |
| `checkout`  | fields, same-as-shipping, payment method, step, errors, status `idle \| placing`, countries, rules per country, prospect saved         | sessionStorage: fields, same-as-shipping, step. Never card data | the tab                                |
| `order`     | ref id, order, status, pending gateway ref, accepted offers by page, reported purchase ids                                             | sessionStorage; reported ids in localStorage (last 20)          | 15 min reuse; reported ids across tabs |
| `visit`     | params (without `ref_id`), attribution, first landing page, exit-intent count                                                          | sessionStorage                                                  | the tab                                |

Lines are merged for the API by `packageId + isUpsell + properties`, not by package id alone.

### 3.2 Actions

| Action                                                                                                  | Chunk    | Notes                                                                                                                                                                                                   | API                                              | Domain events                                         |
| ------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `cart.addItem / setQuantity / removeItem / setGroup / clear / applyCoupon / removeCoupon / setShipping` | core     | no-ops while `cart.frozen`; recalculation latest-wins; `clear` also cancels a running calculation                                                                                                       | `POST /carts/calculate/`                         | `cart.updated`, `cart.calculated`, `shipping.changed` |
| `selectors.register(id, cards, mode, preferred?) / pick(id, cardId) / addToCart(id)`                    | core     | first pick: the card already in the cart, else the page's pre-selected one, else the first; `pick` in `swap` mode and `addToCart` set the cart group and shipping, skipped when the cart already has it | —                                                | `selection.changed`                                   |
| offer quotes (internal)                                                                                 | core     | every card of an `offer` selector, on register and when the campaign arrives; latest-wins; cards show package prices if it fails                                                                        | `POST /carts/calculate/?upsell=true`             | —                                                     |
| `checkout.begin()`                                                                                      | checkout | once, when the form is bound with a non-empty cart                                                                                                                                                      | —                                                | `checkout.started`                                    |
| `checkout.setField / setSameAsShipping / setPaymentMethod / setStep`                                    | checkout | payment words → API codes (`credit` → `card_token`); `setField` fires the prospect cart when email is valid and both names have 2+ characters                                                           | `POST /carts/` once                              | `checkout.shipping-added` once, `prospect.saved`      |
| `checkout.loadCountries() / loadCountry(code)`                                                          | checkout | list filtered by `campaign.available_shipping_countries`; rules cached 1 h                                                                                                                              | i18n-rules `/v1/countries`, `/v1/countries/{cc}` | —                                                     |
| `checkout.paymentReady(method)`                                                                         | checkout | reported by the DOM layer                                                                                                                                                                               | —                                                | `checkout.payment-added` once                         |
| `checkout.placeOrder({ method, tokenize?, successUrl, failureUrl })`                                    | checkout | see 3.3                                                                                                                                                                                                 | `POST /orders/`                                  | `order.placed`                                        |
| `order.load(refId)`                                                                                     | order    | latest-wins                                                                                                                                                                                             | `GET /orders/{ref}/`                             | `order.loaded { purchase?, upsells? }`                |
| `order.view()` / `order.acceptUpsell(selectorId)` / `order.skipUpsell()`                                | order    | accept is single-flight and recorded per page, so Back cannot charge twice                                                                                                                              | `POST /orders/{ref}/upsells/`                    | `upsell.viewed`, `upsell.accepted`, `upsell.skipped`  |
| `order.markReported(ids)`                                                                               | order    | called by analytics after it pushed the events                                                                                                                                                          | —                                                | —                                                     |

Validation is pure (`rules.ts`); remote checks (`/v1/validate`: postcode ↔ state, phone E.164)
run inside `placeOrder` and step advance, 4 s, and never block on failure.

### 3.3 Placing an order

1. `checkout.status = placing` and `cart.frozen = true` — the single-flight guard and a
   frozen cart, set **before** the card is tokenised.
2. Validate (fields for the method; express needs only email and names). On errors: write
   `checkout.errors`, unfreeze, stop.
3. Wait for the running cart calculation.
4. `await tokenize()` for card payments (payment.js, 30 s, in the checkout chunk).
5. Post one body built by pure `orderBody(method, state)` — card, redirect method or express
   (express sends no user and no addresses).
6. Success with `payment_complete_url` (gateway, 3-D Secure): keep the cart, set
   `order.pending = ref`, return the order. The cart is cleared when that ref later loads as
   paid. Success without it: clear cart and checkout **silently** (no `cart.updated`), return the
   order. Failure: write `checkout.errors`, unfreeze, return `undefined`.

`Idempotency-Key` is **not** sent until backend ask B1 ships (a custom header fails the API's
CORS preflight today). When it does, one key per order attempt is reused for retries after an
unknown outcome (network error, timeout, 5xx) and replaced after a definite answer or a cart
change. Until then the single-flight guard is the protection.

### 3.3.1 Checkout details

- **Field names** in the Engine are the API's and i18n-rules': `email, first_name, last_name,
phone_number, line1, line2, city, state, postcode, country, accepts_marketing`, and
  `billing_*` for the billing address. Page names (`fname`, `address1`, `postal`, …) are
  mapped by the checkout chunk.
- **Validation codes** are i18n-rules' (`blank, not_selected, invalid, invalid_characters,
contains_emoji, too_long`), so its translated `fields.<name>.errors` show as they are.
  Required: email, names, line1, city, country; postcode and state where the country's rules
  say; phone only when the page marks it. Express checks only email and names.
- **Remote checks** (`/v1/validate`) give the phone in E.164 for the order and show a
  postcode outside its state as a warning. They never block, and never on our failure.
- **After a paid order** (no `payment_complete_url`) the cart and form are cleared from state
  and storage **without a re-render**, so the page does not flash an empty cart while it
  navigates. With a gateway URL the cart is kept for a retry after a failed payment.
- **Unchanged from 0.4.x on purpose:** `user.language: 'en'`, `accepts_marketing` defaults to
  true, 400 `errors{}` are joined into the general message rather than mapped to fields.

### 3.4 Purchases (once, and only when paid)

`order.load` reports a purchase only when the order has no `payment_complete_url`, the page is
not the failure landing (`?payment_failed=true` or the failure path recorded at placeOrder), and
the ref is not in the reported list (localStorage, last 20). Upsell purchases are the order's
`is_upsell` lines not yet reported. Analytics turns them into `dl_purchase` /
`dl_upsell_purchase` and then calls `order.markReported(ids)`, so a late or missing analytics
chunk never uses them up. Nothing is queued across a redirect.

### 3.4.1 Order details

- The order chunk loads on pages with `[data-next-upsell]`, `[data-next-order-items]` or an
  `order.*` display or condition. It loads `?ref_id` (or `?order_ref_id`), reusing the tab's
  copy for 15 minutes, and the page is revealed (`html[data-next-ready]`, 0.4.x's
  `next-display-ready`) only after that, so the receipt skeleton never lifts onto empty fields.
- An offer is accepted at most once per order and page (`order.accepted`, sessionStorage), so
  Back cannot charge twice; a repeat moves on as if accepted. Lines are the offer selector's
  picked card × its stepper quantity, with the card's vouchers.
- `order.loaded` carries `purchase` (the id to report) and `upsells` (unreported upsell lines,
  numbered in order). Upsells are reported from the order on the page after the accept, so a
  redirect can never drop them, and nothing is queued. A paid order clears a cart that was
  kept for a payment gateway.
- `order.*` values resolve once the chunk registers them (`registerValues`); before that they
  read as not loaded, so `data-next-show="order.hasTax"` stays hidden rather than warning.

### 3.5 Domain events

| Event                                                                     | Payload                                                                                              | Used by                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `campaign.loaded`                                                         | campaign, fromCache                                                                                  | bindings                                                                 |
| `cart.updated`                                                            | cart (lines, coupons or shipping changed; not the calculating flag; not the silent post-order clear) | analytics, page scripts                                                  |
| `cart.calculated`                                                         | summary                                                                                              | analytics                                                                |
| `selection.changed`                                                       | selectorId, cardId, items                                                                            | page scripts (`bundle:selection-changed`)                                |
| `shipping.changed`                                                        | methodId                                                                                             | page scripts                                                             |
| `checkout.started` / `checkout.shipping-added` / `checkout.payment-added` | lines / tier / method                                                                                | analytics                                                                |
| `prospect.saved`                                                          | cart, email, phone (E.164)                                                                           | checkout binding → `next:prospect-cart-created` DOM event for forwarders |
| `order.placed`                                                            | order                                                                                                | analytics                                                                |
| `order.loaded`                                                            | order, purchase? (id), upsells? ({id, number, line})                                                 | analytics, then `order.markReported`                                     |
| `upsell.viewed` / `upsell.accepted` / `upsell.skipped`                    | refId, lines                                                                                         | analytics                                                                |
| `ready`                                                                   | lines; once, when a campaign is available (snapshot or fresh); emitted by `start()`                  | core (`html[data-next-ready]`, legacy announce, analytics), page scripts |
| `storage.degraded`, `error`, `exit-intent.*`                              | as today                                                                                             |                                                                          |

### 3.6 Engine core

```ts
class Engine {
  constructor(options); // restores saved state (cleared first with `reset`), applies ?forcePackageId
  start(): Promise<void>; // ready from the snapshot → load the campaign → ready if not yet
  getState(): State;
  subscribe(fn: () => void): () => void; // after any change, once per tick
  on(event, fn, { replay }): () => void; // domain events
  cart: CartActions;
  selectors: SelectorActions;
  checkout?: CheckoutActions;
  order?: OrderActions; // attached by their chunks
}
// context given to every action file: getState, update(slice, patch), emit, api, storage
```

`values.ts` reads only `getState()`, so `bundle.main.price` resolves from `selectors` (offer
cards use their quote).

## 4. Main flows

**Boot.** `new Engine()` restores the tab's state → core binds the page (selectors register and
put their pick in the cart) → `engine.start()` → `ready` → core sets `html[data-next-ready]` and
loads analytics on idle.

**Landing → add to cart.** binding → `cart.addItem` → `update(cart)` → save + notify →
`cart.updated` → latest-wins calculate → `cart.calculated` → re-render.

**Checkout.** fields → `checkout.setField` → submit → binding calls
`checkout.placeOrder({ method, tokenize, successUrl, failureUrl })` (3.3) → on an order the
binding navigates to `redirectFor(order, successUrl)`; on `undefined` the errors are already in
state and rendered.

**Upsell.** `order.load(ref)` → `order.view()` → accept: `order.acceptUpsell(selectorId)` →
binding navigates to `nextUrl(acceptUrl)` with `ref_id`; error or unsupported → after 1 s to the
same URL; skip → `order.skipUpsell()` and navigate.

**Receipt.** `order.load(ref)` → `order.*` paths read `state.order`.

## 5. Files

`src/engine/`: `engine.ts`, `types.ts`, `cart.ts`, `selectors.ts` (core); `checkout.ts`,
`order.ts`, `rules.ts` (loaded by their chunks); shared `api.ts` (with the order error mapping), `storage.ts`,
`events.ts`, `values.ts`, `condition.ts`, `attribution.ts`, `params.ts`, `scope.ts`. See
[structure.md](structure.md).

## 6. Migration

One commit per step, tests green, size checked each time:

1. `update()` + `subscribe()` + slices; cart actions to `cart.ts`; line `isUpsell` /
   `properties` and the new merge key; `ref_id` one-shot.
2. Bindings render on `subscribe`; `cart.updated` stops firing for the calculating flag.
3. `selectors` slice + `quote`; bindings register cards; `CardLookup` and
   `BindContext.selectors` go away.
4. `start()` takes restore → load out of `core.ts`; `visit.exitIntentShown` replaces
   `readSession` / `writeSession`.
5. Checkout chunk on top (with `checkout/legacy.ts`: the shop-three-step guard key, the
   `next:prospect-cart-created` event, old field and payment names), then the order chunk.

## 7. Decisions

1. Checkout fields (email, name, address) stay in sessionStorage for the tab, as in 0.4.x, so a
   3-step checkout and a reload keep them; cleared after the order.
2. The shop-three-step guard key `sessionStorage['next-checkout-store']` is written in its old
   shape by `checkout/legacy.ts` (templates are copied into live campaigns and cannot all be
   updated).
3. The receipt reads `order.*`; `cart.*` on a receipt is empty after a paid order, as before.
