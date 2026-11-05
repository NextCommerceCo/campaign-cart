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
| Checkout  | Form draft, same-as-shipping, payment method (page words → API codes), 3-step checkouts, country list and rules (states, required fields, postcode), remote postcode/phone checks, field errors, the Open Cart once, place order for card / redirect methods / express |
| Order     | `ref_id` from the URL, load the order, accept an offer once even after Back, skip, receipt values                                                                                                                                                                      |
| Visit     | URL params, attribution, first landing page                                                                                                                                                                                                                            |
| Analytics | `begin_checkout`, `add_shipping_info`, `add_payment_info` once per checkout, `purchase` once and only when paid, `upsell_purchase` once, viewed/skipped upsell                                                                                                         |

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
| P8  | Boot split between `boot.ts` and the Engine                                        | restore → load → ready ordered in two places                                                            |
| P9  | Lines have no `properties` / `isUpsell`; `mergeLines` keys on package id           | Personalised lines and upsell bumps (all 8 campaigns) cannot be sent; two lines of one package collapse |
| P10 | `ref_id` is kept as a session param                                                | A stale `ref_id` rides on every later same-site link                                                    |

## 3. Design

Kept: one write path (Action → State → Event), no DOM in the Engine, everything else
subscribes. Changed:

1. **One `update(slice, patch)` path.** It saves the slice if persisted and schedules one change
   notification. No action assigns state directly.
2. **State in slices** with declared persistence (3.1).
3. **Actions grouped by domain**, one file each. `cart` and `selectors` are in the boot chunk;
   `checkout` and `order` are attached by their lazy chunks, so landing pages do not download
   them (`engine.checkout = createCheckout(context)`).
4. **Two kinds of notification.** `subscribe(fn)` — state changed, once per tick, for
   rendering. `on(event)` — domain events, for analytics and page scripts.
5. **Errors live in state.** Field, decline and server errors go to `checkout.errors` /
   `order.status` and render like any state. `placeOrder` resolves to the order or
   `undefined`, and `accept` to its outcome. `sdk.error` and the `*.failed` events report them to
   analytics, debug and page scripts; nothing renders from them.
6. **The Engine returns data, the DOM layer navigates.** Pure `redirectFor(order, successUrl)`
   and `nextUrl(target, params)` build URLs (adding `ref_id` and session params); the binding
   owns timing (upsell moves on after 1 s on error, as today).

### 3.1 State

| Slice       | Holds                                                                                                                                                                                                                     | Stored                                                                                            | Lifetime                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `campaign`  | campaign JSON                                                                                                                                                                                                             | localStorage                                                                                      | 10 min snapshot                             |
| `cart`      | groups of lines `{packageId, quantity, isUpsell?, properties?}`, coupons, codes held until the cart's first price, dismissed bumps, shipping id, summary, calculating, `frozen`                                           | sessionStorage (not summary / calculating / frozen)                                               | the tab                                     |
| `selectors` | per selector: cards, picked card, mode `swap \| select \| offer`, offer quotes per card (stepper quantity lands with the order chunk)                                                                                     | not stored; registered by bindings; card quotes in localStorage, 10 min                           | the page                                    |
| `checkout`  | the checkout's `id`, fields, same-as-shipping, payment method, step, errors, status `idle \| placing \| placed`, countries, rules per country, whether the Open Cart is saved, the tracking events sent for this checkout | sessionStorage: `id`, fields, same-as-shipping, step, the tracking events sent. Never card data   | the tab; a paid order starts a new checkout |
| `order`     | ref id, order, status, accepted offers by order and page, the codes the checkout sent with it (the gateway ref waits in `checkout.pendingRef`)                                                                            | sessionStorage; reported ids (purchases, upsell lines, failed payments) in localStorage (last 50) | 15 min reuse; reported ids across tabs      |
| `visit`     | params (without `ref_id`), attribution, first landing page, exit-intent count                                                                                                                                             | sessionStorage                                                                                    | the tab                                     |

Lines are merged for the API by `packageId + isUpsell + properties`, not by package id alone.

### 3.2 Actions

| Action                                                                                                       | Chunk    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | API                                              | Domain events                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cart.addItem / setQuantity / removeItem / setGroup / clear / applyCoupon / removeCoupon / setShipping`      | boot     | no-ops while `cart.frozen`; recalculation latest-wins; `clear` also cancels a running calculation; `applyCoupon` checks the code against a fresh price, and holds a code entered before the cart can be priced until its first price                                                                                                                                                                                                                                               | `POST /carts/calculate/`                         | `cart.updated`, then `cart.removed` / `cart.added` for that change; `cart.calculating`, `cart.calculated`; `shipping.selected` once priced with the new method; `coupon.applied / removed / denied`; `selector.selected / deselected` when a toggle's line comes or goes |
| `selectors.register(id, cards, mode, preferred?) / pick(id, cardId) / setQuantity / setSlot / addToCart(id)` | boot     | first pick: `?forceBundleId`, else the card already in the cart, else the page's pre-selected one, else the first; `pick` in `swap` mode and `addToCart` set the cart group and shipping, skipped when the cart already has it                                                                                                                                                                                                                                                     | —                                                | `selector.viewed` once per selector a page, `selector.selected`, `selector.updated` (quantity or slot)                                                                                                                                                                   |
| card quotes (internal)                                                                                       | boot     | every card of an `offer` selector (`?upsell=true`), or of a selector whose cards show `[data-next-discounts]`; on register, quantity or slot change, coupon change and when the campaign arrives; latest-wins; a quote counts only while it matches the card's lines, otherwise package prices show. Each quote is kept in localStorage by what was sent (lines, vouchers, currency, upsell, campaign) for 10 minutes; a kept quote shows at once and is checked again once a page | `POST /carts/calculate/`                         | `selector.calculating / calculated`                                                                                                                                                                                                                                      |
| `checkout.begin()`                                                                                           | checkout | binds the checkout; it starts once the cart has lines. A new `id` and `checkout.started` once per checkout: steps, reloads and a return from a gateway keep it, a paid order ends it                                                                                                                                                                                                                                                                                               | —                                                | `checkout.started`                                                                                                                                                                                                                                                       |
| `checkout.setField / setSameAsShipping / setPaymentMethod / setStep / nextStep`                              | checkout | payment words → API codes (`credit` → `card_token`); `setField` saves the Open Cart once what `data-next-lead` asks for is valid; addresses are announced once the checkout has started; `nextStep` checks the step's fields                                                                                                                                                                                                                                                       | `POST /carts/` once                              | `user.created` once, `user.updated`; `address.entered` once per type, then `address.updated`; `payment.selected`; `checkout.continued`                                                                                                                                   |
| `checkout.loadCountries() / loadCountry(code)`                                                               | checkout | list filtered by `campaign.available_shipping_countries`; rules cached 1 h                                                                                                                                                                                                                                                                                                                                                                                                         | i18n-rules `/v1/countries`, `/v1/countries/{cc}` | — (`sdk.error` `address.load_rules`)                                                                                                                                                                                                                                     |
| `checkout.suggestAddresses(query, country)`                                                                  | checkout | with `addressConfig.enableAutocomplete`                                                                                                                                                                                                                                                                                                                                                                                                                                            | `GET /addresses/autocomplete/`                   | — (`sdk.error` `address.suggest`)                                                                                                                                                                                                                                        |
| `checkout.paymentReady()`                                                                                    | checkout | reported by the DOM layer once the card fields are complete; sets `cardReady`                                                                                                                                                                                                                                                                                                                                                                                                      | —                                                | —                                                                                                                                                                                                                                                                        |
| `checkout.placeOrder({ expressMethod?, expressChecks?, tokenize?, successUrl, failureUrl })`                 | checkout | see 3.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `POST /orders/`                                  | `checkout.submitted`, then `order.created`, `payment.redirected` or `checkout.failed`                                                                                                                                                                                    |
| `order.load(refId)`                                                                                          | order    | latest-wins; reuses the tab's copy for 15 minutes                                                                                                                                                                                                                                                                                                                                                                                                                                  | `GET /orders/{ref}/`                             | `order.loaded`, then `order.paid` once per order                                                                                                                                                                                                                         |
| `order.paymentFailed()`                                                                                      | order    | `?payment_failed=true` without a `ref_id`: the checkout's `pendingRef`, once per order                                                                                                                                                                                                                                                                                                                                                                                             | —                                                | `payment.failed`                                                                                                                                                                                                                                                         |
| `order.view(offer, page)` / `order.accept(offer, page)` / `order.skip(offer, page)`                          | order    | accept is single-flight and recorded per page, so Back cannot charge twice; after a network error, timeout or 5xx the order is loaded again, and a new upsell line on it counts as accepted                                                                                                                                                                                                                                                                                        | `POST /orders/{ref}/upsells/`                    | `upsell.viewed` once per offer, once it is priced; `upsell.accepted` then `order.updated`; `upsell.failed`; `upsell.skipped`                                                                                                                                             |
| `order.markReported(ids)`                                                                                    | order    | called by analytics after it sent `upsell_purchase`                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                | —                                                                                                                                                                                                                                                                        |

Validation is pure (`rules.ts`); remote checks (`/v1/validate`: postcode ↔ state, phone E.164)
run inside `placeOrder` and step advance, 4 s, and never block on failure. `checkout.problems()`
runs the same checks without showing them, for the debug panel.

### 3.3 Placing an order

1. `checkout.status = placing` and `cart.frozen = true` — the single-flight guard and a
   frozen cart, set **before** the card is tokenised.
2. Validate. A method picked in the form, PayPal and Klarna included, checks the whole form; an
   express button (`method`) checks only the fields `expressChecks` lists, none by default. On
   errors: write `checkout.errors`, send `checkout.invalid`, unfreeze, stop.
3. Wait for the running cart calculation.
4. `await tokenize()` for card payments (payment.js, 30 s, in the checkout chunk); a card that
   fails stops as in 2. Then `checkout.submitted`.
5. Post one body built by pure `orderBody(state, …)` — the form's method with the user and
   addresses, or an express button's without them.
6. Success with `payment_complete_url` (gateway, 3-D Secure): keep the cart, set
   `checkout.pendingRef`, send `order.created` (`paid: false`) and `payment.redirected`, return the
   order. The cart is cleared when that ref later loads as paid, with `order.paid` and
   `checkout.completed`. Success without it: send `order.created` (`paid: true`), put the order in
   the paid ledger and `order.paidOrder`, send `order.paid` and `checkout.completed`, clear cart and
   checkout **silently** (no `cart.updated`), return the order. A declined card: `payment.failed`
   (`declined`) without `sdk.error`. Other failures: `sdk.error` (`order.create`) and
   `checkout.failed`. Either way write `checkout.errors`, unfreeze, return `undefined`.

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
  Required: email, names, line1, country; city, state and postcode where the country's rules
  say (city everywhere while the rules have not loaded); phone only when the page marks it.
  An express button checks nothing unless 0.4.x `expressCheckout.requireValidation` asks. A
  city, state or postcode the country does not have (Singapore has no city, Hong Kong no
  postcode) is neither checked nor sent.
- **Remote checks** (`/v1/validate`) give the phone in E.164 for the order and show a
  postcode outside its state as a warning. They never block, and never on our failure.
  The phone (shipping and billing, each against its own address country) is read after a
  400 ms pause in typing, on leaving the field, when the address country changes, and before
  an order (waiting up to 2 s); one request per number and country. Its message shows only
  after the field is left. The loose check before that is the country's `format.pattern`,
  or 4–15 digits; digits from other scripts count as ASCII.
- **After a paid order** (no `payment_complete_url`) the cart and form are cleared from state
  and storage **without a re-render**, so the page does not flash an empty cart while it
  navigates. With a gateway URL the cart is kept for a retry after a failed payment. A gateway
  sends an unpaid shopper to the failure URL without a `ref_id`; the order chunk then sends
  `payment.failed` for the checkout's `pendingRef`, once per order.
- **Unchanged from 0.4.x on purpose:** `user.language: 'en'`, `accepts_marketing` is the
  checkbox as the page left it (true when the page has none), 400 `errors{}` are joined into
  the general message rather than mapped to fields.

### 3.4 Purchases (once, and only when paid)

`order.load` sends `order.paid` only when the order has no `payment_complete_url` and its id is
not in the reported list (localStorage, last 50), and adds the id as it sends it; analytics
replays it within the page as `purchase`. Upsell purchases are the order's `is_upsell` lines not
in the list: analytics sends `upsell_purchase` for each on `order.loaded`, then calls
`order.markReported(ids)`, so a late or missing analytics chunk never uses them up. Nothing is
queued across a redirect.

### 3.4.1 Order details

- The order chunk loads on pages with `[data-next-upsell]`, `[data-next-order-items]`, an
  `order.*` display or condition, `?ref_id`, `?order_ref_id` or `?payment_failed=true`. It loads
  `?ref_id` (or `?order_ref_id`), reusing the tab's copy for 15 minutes, and the page is revealed
  (`html[data-next-ready]`, 0.4.x's `next-display-ready`) only after that, so the receipt skeleton
  never lifts onto empty fields.
- An offer is accepted at most once per order and page (`order.accepted`, sessionStorage), so
  Back cannot charge twice; a repeat moves on as if accepted. Lines are the offer selector's
  picked card × its stepper quantity, with the card's vouchers.
- `order.loaded`, `order.paid` and `order.updated` carry the Order (`publicOrder` in
  `src/engine/order.ts`). Upsells are reported from the order on the page after the accept, so a
  redirect can never drop them, and nothing is queued. A paid order clears a cart that was
  kept for a payment gateway.
- `order.*` values resolve once the chunk registers them (`registerValues`); before that they
  read as not loaded, so `data-next-show="order.hasTax"` stays hidden rather than warning.

### 3.5 Domain events

Each event's payload and when it fires is in `EventMap` (`src/engine/events/`, one file per event group), which the Event
Reference is generated from; `docs/guides/events.md` explains the model. Names are
`namespace.action` with one dot; 0.4.x names are made from them in `src/compat/` (`legacy.ts`, and
`checkout.ts` / `order.ts` for their chunks' events).
`next.on` takes every event but `campaign.loaded` and `analytics`, and replays the page's
earlier ones from the last 100.

| Event                                                                                                                          | Emitted by                                                                 | Used by                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `sdk.ready` (the Snapshot), `sdk.error`                                                                                        | `start()`, `fail()` for every failed step, storage                         | boot (`html[data-next-ready]`, legacy announce), analytics, debug                                  |
| `campaign.loaded`                                                                                                              | `start()`, `load()`; internal, not public                                  | the 0.4.x `campaign:loaded` and `currency:fallback`                                                |
| `selector.viewed / selected / updated`                                                                                         | selectors `register`, `pick`, `setQuantity` / `setSlot`                    | 0.4.x selector names, page scripts                                                                 |
| `selector.selected / deselected` for a toggle                                                                                  | cart `commit()`, when a toggle group gains or loses its line               | page scripts                                                                                       |
| `selector.calculating / calculated`                                                                                            | card quotes                                                                | debug, page scripts                                                                                |
| `cart.updated`, `cart.removed`, `cart.added`                                                                                   | cart `commit()`, once per change                                           | analytics (`cart.updated` of an empty cart), 0.4.x cart names                                      |
| `cart.calculating`, `cart.calculated`                                                                                          | cart `calculate()`                                                         | analytics (`add_to_cart`, `remove_from_cart`, `update_cart`)                                       |
| `shipping.selected`                                                                                                            | cart `calculate()`, after `setShipping`                                    | analytics (`add_shipping_info`), debug                                                             |
| `coupon.applied / removed / denied`                                                                                            | cart `applyCoupon`, `removeCoupon`, `clear`, held codes at the first price | debug, 0.4.x coupon names                                                                          |
| `checkout.started / continued / submitted / failed`, `user.created / updated`, `address.entered / updated`, `payment.selected` | checkout                                                                   | analytics, debug, 0.4.x checkout names, the 0.4.x Open Cart DOM event (`user.created`)             |
| `payment.redirected`, `order.created`                                                                                          | checkout `placeOrder`                                                      | debug, 0.4.x express names                                                                         |
| `payment.failed`                                                                                                               | order `paymentFailed`                                                      | debug                                                                                              |
| `order.loaded`, `order.paid`, `order.updated`                                                                                  | order `settle`, `accept`                                                   | analytics (`purchase`, `upsell_purchase`), debug, 0.4.x `order:completed`                          |
| `upsell.viewed / accepted / skipped / failed`                                                                                  | order                                                                      | analytics, debug, 0.4.x upsell names                                                               |
| `promotion.viewed / clicked / closed`                                                                                          | `src/compat/exit-intent.ts`, `src/bindings/promotion.ts`                   | analytics (`view_promotion`, `select_promotion`), the 0.4.x `exit-intent:*` and `dl_exit_intent_*` |
| `analytics`                                                                                                                    | the analytics chunk; internal, not public                                  | `next.analytics.on`, debug                                                                         |

### 3.6 Engine core

```ts
class Engine {
  constructor(options); // restores saved state (cleared first with `reset`), applies ?forcePackageId
  start(): Promise<void>; // ready from the snapshot → load the campaign → ready if not yet
  getState(): State;
  snapshot(): Snapshot; // what the page shows, as the events carry it: next.snapshot(), sdk.ready
  subscribe(fn: () => void): () => void; // after any change, once per tick
  on(event, fn, { replay }): () => void; // domain events; replay: the page's last 100 first
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

**Boot.** `new Engine()` restores the tab's state → boot binds the page (selectors register and
put their pick in the cart, `selector.viewed`) → `engine.start()` → `sdk.ready` with the snapshot →
boot binds the checkout or order chunk, sets `html[data-next-ready]` and loads analytics on idle.

**Landing → add to cart.** binding → `cart.addItem` → `update(cart)` → save + notify →
`cart.updated`, `cart.added` → latest-wins calculate → `cart.calculated` → re-render.

**Checkout.** `checkout.begin()` → `checkout.started` → fields → `checkout.setField` → submit →
binding calls `checkout.placeOrder({ expressMethod, tokenize, successUrl, failureUrl })` (3.3) → on an
order the binding navigates to `redirectFor(order, successUrl)`: the success URL with `ref_id`, or
the gateway after `payment.redirected`; on `undefined` the errors are already in state and
rendered.

**Upsell.** `order.load(ref)` → `order.loaded` (and `order.paid` once) → `order.view(offer, page)`
→ accept: `order.accept({ selectorId }, page)` → `upsell.accepted`, `order.updated` → binding
navigates to `nextUrl(acceptUrl)` with `ref_id`; error or unsupported → after 1 s to the same URL;
skip → `order.skip(offer, page)` and navigate.

**Receipt.** `order.load(ref)` → `order.*` paths read `state.order`.

## 5. Files

`src/engine/` (boot): `engine.ts`, `types.ts`, `api.ts` (with the order error mapping),
`storage.ts`, `events/` (one file per event group), `log.ts`, `order.ts` (the public Order), `id.ts`, `session.ts`,
`values.ts`, `condition.ts`, `attribution.ts`, `params.ts`, `scope.ts`, `format.ts`, `tokens.ts`,
and `cart/` (`cart.ts`, `selectors.ts`, `toggles.ts`, `types.ts`). Loaded by their chunks:
`checkout/state/` (`checkout.ts`, `order-body.ts`, `rules.ts`, `phone.ts`, `types.ts`) and
`order/state.ts`. See [structure.md](structure.md).

## 6. Migration

One commit per step, tests green, size checked each time:

1. `update()` + `subscribe()` + slices; cart actions to `cart.ts`; line `isUpsell` /
   `properties` and the new merge key; `ref_id` one-shot.
2. Bindings render on `subscribe`; `cart.updated` stops firing for the calculating flag.
3. `selectors` slice + `quote`; bindings register cards; `CardLookup` and
   `BindContext.selectors` go away.
4. `start()` takes restore → load out of `boot.ts`; `visit.exitIntentShown` replaces
   `readSession` / `writeSession`.
5. Checkout chunk on top (with `compat/checkout.ts`: the shop-three-step guard key, the 0.4.x
   Open Cart DOM event, old field and payment names), then the order chunk.

## 7. Decisions

1. Checkout fields (email, name, address) stay in sessionStorage for the tab, as in 0.4.x, so a
   3-step checkout and a reload keep them; cleared after the order.
2. The shop-three-step guard key `sessionStorage['next-checkout-store']` is written in its old
   shape by `compat/checkout.ts` (templates are copied into live campaigns and cannot all be
   updated).
3. The receipt reads `order.*`; `cart.*` on a receipt is empty after a paid order, as before.
