---
title: "State/Order/Overview"
group: "State"
category: "Order Store"
---

# useOrderStore

> Last reviewed: 2026-07-30
> Owner: platform

The order store holds the purchase the visitor has already paid for — its lines,
totals, addresses and status URL — so every page that comes after checkout can
work with it. A receipt page reads it to show what was bought; a post-purchase
upsell page adds a line to that same order without asking for card details
again. It also keeps the record of which offers this visitor has already seen and
accepted, which is what stops a funnel re-offering something after a
back-button. Field-by-field detail lives in
[reference/state-reference.md](./reference/state-reference.md).

## Concept

Two ideas carry the whole store.

**The order comes from the URL, not from the cart.** A receipt or upsell page is
a fresh page load; the cart that produced the purchase may be gone. What ties the
page to the purchase is the `?ref_id` (or `?order_ref_id`) the checkout redirect
put in the address bar. The SDK reads it during boot and fetches the order, so a
page normally finds `order` already populated by the time enhancers run. That
fetch announces itself as
[`order:loaded`](./reference/events.md) — the event conversion tracking belongs
on, because it is the first point at which a gateway payment is known to have
gone through.

**Writes go one way.** Accepting an upsell charges the customer's stored payment
method through the order API. There is no local undo and no "remove upsell" —
the store's job is to make sure each offer is written at most once.

```
receipt / upsell page  ?ref_id=ord_9fT2xK
        │
        ▼
SDK boot ── loadOrder(refId) ──► GET order ──► order, orderLoadedAt = now
                                                  │
                                    upsell page renders from `order`
                                                  │
                    visitor accepts ── addUpsell() ──► POST upsell line
                                                  │
                                   order replaced by the API response,
                                   orderLoadedAt re-stamped,
                                   window.location.pathname recorded in
                                   completedUpsellPages,
                                   'accepted' appended to upsellJourney

15 minutes after orderLoadedAt ──► isOrderExpired() === true
```

The 15-minute window is measured from `orderLoadedAt`, which is stamped when the
order is fetched and re-stamped when an upsell is accepted — reading the page does
not extend it. So a visitor who spends twenty minutes on a long upsell page and
then clicks accept is working from an order the store already considers expired.
Check `isOrderExpired()` before offering.

The bookkeeping is deliberately **per page path**, not per package:
`completedUpsellPages` and `viewedUpsellPages` record `window.location.pathname`,
so a funnel that offers the same package on two pages treats those as two
distinct offers.

Everything is persisted per tab, under `next-order` in sessionStorage — a second
tab opened on the same receipt URL fetches the order again rather than sharing
this one.

## Business logic

- **The SDK loads the order, a page does not.** During boot the initializer looks
  for `?ref_id` or `?order_ref_id` and calls `loadOrder(refId, apiClient)`. A
  failure there is logged and swallowed so it cannot break SDK startup, which
  means a receipt page with a bad reference renders empty rather than throwing.
- **`loadOrder` is cache-first and single-flight.** It returns immediately when
  the same `refId` is already loaded and not expired, and refuses to start a
  second fetch while `isLoading` is true. An expired copy of the same order is
  re-fetched rather than reused.
- **A failed load clears the order.** The catch branch sets `error`, sets
  `order: null`, and leaves `refId` in place, so the page ends up in the same
  empty state as a page opened with no reference — read `error` to tell those two
  apart.
- **Loading an order resets the offer history.** A successful `loadOrder` blanks
  `upsellJourney`, `viewedUpsells` and `viewedUpsellPages`, and re-derives
  `completedUpsells` from the order's own lines: every line flagged `is_upsell`
  contributes the first run of digits in its `product_sku` (falling back to the
  whole SKU). That is a heuristic on the SKU string, not a package id the API
  returned.
- **`addUpsell` refuses without a reference and while one is in flight.** No
  `refId` sets `upsellError` and returns `null`; an in-flight add returns `null`
  and logs a warning. That single `isProcessingUpsell` flag is the only guard
  against a double charge, which is why every accept control must be disabled
  while it is true.
- **A successful add rewrites the order from the API response.** It replaces
  `order`, re-stamps `orderLoadedAt`, appends the accepted package ids to
  `completedUpsells`, adds the current path to `completedUpsellPages` if it is not
  already there, and appends one `accepted` entry per package to `upsellJourney`.
- **A failed add leaves the order untouched.** `isProcessingUpsell` clears,
  `upsellError` carries the message, and nothing is recorded as completed — so the
  page can offer a retry, with the duplicate risk described under Limitations.
- **`canAddUpsells()` does not consult the expiry.** It is true when an order is
  loaded, the order reports `supports_post_purchase_upsells`, and no add is in
  flight. An expired order still passes it, so pair it with `isOrderExpired()`.
- **Viewing and skipping are recorded, not just accepting.**
  `markUpsellPageViewed(path)` and `markUpsellSkipped(packageId, path)` both
  append to `upsellJourney` and clear `isProcessingUpsell` and `upsellError` — a
  new offer page therefore starts from a clean processing state even if the
  previous one was left mid-flight.

## Decisions

- We key the "already offered" record on the page path rather than the package id
  because a post-purchase funnel commonly offers the same package on two pages
  with different copy. Package ids cannot tell those apart, so the id-based
  `completedUpsells` / `viewedUpsells` marked the second page as already accepted
  and skipped it. Those fields are deprecated but still written; read the `*Pages`
  fields.
- We measure the 15-minute window from the fetch rather than from the last
  interaction because the window exists to bound how far this copy of the order
  can drift from the API — a snapshot that stays valid as long as someone keeps
  scrolling defeats that.
- We chose sessionStorage over localStorage because an order belongs to the tab
  that bought it. A stale `next-order` surviving in localStorage would let a later
  visit render someone else's receipt on a shared browser.
- We guard double adds with one flag on the store rather than by disabling a
  button in the DOM, because a page can carry several offer blocks and each of
  them subscribes to the same `isProcessingUpsell`. See
  [the upsell feature](../../../features/order/upsell/guide/overview.md).
- We let the order API's response replace `order` wholesale instead of patching
  the new line into the local copy, because the API recalculates totals and tax
  for the whole order and a locally patched copy would disagree with the receipt.

## Limitations

- **An accepted upsell cannot be undone from the page.** There is no
  `removeUpsell`, and if `addUpsell` fails after the API accepted the line, a
  retry adds it twice. Treat a failed add as "unknown" rather than "not applied":
  force a re-read before offering a retry — `clearOrder()` and then
  `loadOrder(refId, apiClient)`, since `loadOrder` on its own returns the cached
  copy — and compare the lines.
- **Nothing enforces the expiry except `loadOrder`.** The expired blob stays in
  sessionStorage, `canAddUpsells()` still returns true, and
  `next.addUpsell({ packageId: 2 })` will still post. Only `isOrderExpired()`
  reports it, so the guard has to be written into the page.
- **Persistence is not filtered.** With no `partialize`, the transient flags are
  written to storage too, so a reload during an add can restore
  `isProcessingUpsell: true` and leave every accept button disabled with no way
  back. Reset it on load — `markUpsellPageViewed(path)` clears it as a side
  effect, which is why a fresh offer page recovers on its own.
- **It holds exactly one order.** Loading a different `refId` replaces the
  current order and wipes the offer history, so a page cannot show a previous
  purchase alongside the current one.
- **The upsell package ids in `completedUpsells` are guessed from the SKU.** The
  digit-run match means a SKU like `PKG-2024-BUNDLE` contributes `2024`, which
  matches no package. This is another reason the page-path fields are the ones to
  read.
- **It does not track payment state itself.** The store keeps whatever the API
  returned; whether the money moved is a property of the `order` object. The
  signal is `payment_complete_url`: while it is present the order exists but is
  unpaid, and the shopper still owes the gateway a step. Read that, or the order's
  own status fields — see
  [order-display](../../../features/display/order-display/guide/overview.md) —
  rather than inferring success from the order being present. An order loaded
  through `?ref_id` after the gateway returned the shopper is paid, which is why
  [`order:loaded`](./reference/events.md) is a safe conversion signal and
  `order:completed` on the checkout page is not.
- **It has no connection to the cart.** Completing an order does not clear the
  cart, and clearing the cart does not clear the order. See
  [the cart store](../../cart/guide/overview.md) for how to start the next
  purchase empty.
