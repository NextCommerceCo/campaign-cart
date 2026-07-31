---
title: "State/Cart/Overview"
group: "State"
category: "Cart Store"
---

# useCartStore

> Last reviewed: 2026-07-30
> Owner: platform

The cart store holds what the shopper has decided to buy and what it costs: the
lines they picked, the coupon codes applied, the shipping option chosen, and the
totals the pricing API returned for that combination. Every "add to cart" button,
cart badge, order summary, and checkout submission on a campaign page reads from
this one place, which is why it survives a page change inside the funnel — a
shopper who picks a bundle on the landing page arrives at checkout with the same
cart. Field-by-field detail lives in
[reference/state-reference.md](./reference/state-reference.md).

## Concept

The mental model is **thin state**. The store is a state container and nothing
more: it holds fields, sync setters, and read helpers. Everything that awaits
something — talking to the pricing API, reading the campaign, coordinating a swap
— lives in `state/cart/operations/` as one plain function per operation, and is
exposed to pages as `sdk.cart.*`. The store still carries the same method names
(`useCartStore.getState().addItem()`), but those are deprecated delegators that
forward straight to the operation, kept because live landing pages call them.

The second half of the model is that **the cart is priced twice for every
change**. An operation writes the shopper's intent and an optimistic local sum
immediately, so the price on screen moves on the click, then asks the API for the
real figure:

```
sdk.cart.addItem({ packageId: 2, quantity: 1 })
        │
        ├─► write items + optimistic totals   (instant, no discounts, no shipping)
        │        └─► emit cart:item-added
        │
        └─► calculateTotals()
                 │  debounced 150 ms, previous request aborted
                 ▼
            POST cart totals  ──►  writes subtotal, total, discounts,
                                   summary, totalQuantity, vouchers mirror
                                          └─► emit cart:updated
```

So there is always a short window in which `total` is a local sum that knows
nothing about offers or shipping. Read money from the `cart:updated` event, or
gate rendering on `isCalculating`, rather than reading it on the line after an
`await`.

Persistence follows the same "intent only" idea: an allow-list of six keys goes
to sessionStorage under `next-cart-state`, and everything the API computes is
recalculated on rehydration instead of being restored.

## Business logic

- **Every mutation ends in a recalculation.** `addItem`, `removeItem`,
  `updateQuantity`, `swapPackage`, `swapCart`, `clear`, `setShippingMethod`,
  `applyCoupon`, and `removeCoupon` all call `calculateTotals()` as their last
  step, so no operation leaves the totals disagreeing with the lines for longer
  than one API round trip.
- **A line can only exist for a package the loaded campaign knows.** `addItem`
  looks the package up in the campaign store and throws
  `Package {id} not found in campaign data` when it is missing; `swapCart` is
  more forgiving and skips unknown packages with a warning rather than failing
  the whole swap.
- **Lines merge by `packageId` alone.** Adding a package that is already in the
  cart increases that line's quantity instead of appending a second line, and
  any `properties` on the second add are discarded.
- **Recalculation is debounced by 150 ms and self-cancelling.** A newer call
  aborts the in-flight request, so three bundle selectors initialising on one
  page produce one priced answer rather than three.
- **The API answer, not the store, decides money.** A successful recalculation
  overwrites the per-line pricing on `items`, all the computed fields
  (`subtotal`, `total`, `totalDiscount`, `totalDiscountPercentage`,
  `hasDiscounts`, `offerDiscounts`, `voucherDiscounts`), `totalQuantity` counted
  from the returned lines, `isEmpty`, and `summary`.
- **`summary.lines` are re-enriched, not copied.** Each returned line is joined
  to its campaign package for name, image, and product fields, and matched
  against the cart's `properties` groups — a package the API merged into one
  line is expanded back into one row per personalised slot, with the amounts
  split by quantity ratio. Lines are therefore not positionally aligned with
  `items`; match on `package_id`.
- **Coupons are borrowed, not owned.** `applyCoupon` upper-cases and trims the
  code, refuses a duplicate, and writes it to the **checkout** store; each
  successful recalculation then overwrites `cart.vouchers` from that store. The
  cart copy exists so a page can render applied-coupon chips without reaching
  into checkout.
- **Shipping is chosen from the campaign.** `setShippingMethod(id)` matches a
  campaign shipping method by `ref_id`, writes it to the cart as `Decimal`
  prices, mirrors a plain-number copy onto the checkout store, and throws when
  the campaign has no methods or no method with that id. With no method chosen,
  pricing falls back to shipping method `1`.
- **Rehydration repairs and reprices.** `onRehydrateStorage` rebuilds the
  `shippingMethod` money fields as `Decimal`s from their stored strings, then
  calls `calculateTotals()` — so the restored `totalQuantity` and totals are
  replaced by the API's about 150 ms into the page.

## Decisions

- We moved async cart logic into `state/cart/operations/` rather than growing
  store slices, because a store that awaits the API cannot be unit-tested
  without standing the whole SDK up, and because the operations need the
  campaign and checkout stores — which need the cart. The operations pull those
  in with dynamic `import()` at call time, which breaks the import cycle that
  store-level imports would create.
- We kept the store's `addItem`/`removeItem`/`calculateTotals` methods as
  deprecated delegators instead of deleting them, because published landing
  pages call `useCartStore.getState().addItem()` and would break on the next SDK
  release. New code calls `sdk.cart.*`; see
  [add-to-cart](../../../features/cart/add-to-cart/guide/overview.md).
- We chose optimistic local totals followed by an API recalculation over waiting
  for the API, because a price that does not move on the click reads as a broken
  button. The cost is a brief window where `total` has no discounts and no
  shipping, which is why totals are published through `cart:updated`.
- We debounce and abort `calculateTotals` rather than queueing every call,
  because several selectors settling their initial state fire several
  recalculations that describe the same cart, and only the last answer is
  correct.
- We persist an explicit allow-list of shopper intent (`items`, `vouchers`,
  `shippingMethod`, plus two derived counters) rather than the whole store,
  because JSON cannot carry `Decimal`s — a restored total would come back as a
  string that throws on `.plus()`, and would be stale anyway.
- We keep the authoritative coupon list on the checkout store and mirror it here
  because coupons are submitted with the order, so checkout owns them. See
  [the checkout store](../../checkout/guide/reference/state-reference.md).

## Limitations

- **It does not price anything itself.** Discounts, offers, shipping discounts,
  and the final total all come from the pricing API; the local sum is quantity
  times captured price. Never compute a displayed total from `items` — read
  `total` and `summary` after `cart:updated`.
- **`enrichedItems` is never populated, and it is exposed publicly as
  `cartLines`.** `sdk.getCartData().cartLines` returns `[]` for a full cart,
  because `next-commerce.ts` reads `cartStore.enrichedItems` and nothing writes
  to it — the initial state and `partialize` both hardcode `[]`. Read `items` for
  what was bought, or `summary.lines` for priced, product-enriched rows. This is
  a bug, not a design.
- **`getTotalWeight()` computes no weight.** It sums quantities and returns the
  same number as `getTotalItemCount()`, because no weight data reaches the cart.
  Do not build shipping or freight rules on it; take weight from the campaign
  product data if you need it.
- **It cannot hold two lines for the same package with different
  `properties`.** A second personalised slot for the same package folds into the
  first line and loses its engraving. Build the line list yourself and call
  `sdk.cart.swapCart(items)` when each slot needs its own properties.
- **`vouchers` is not writable.** Pushing a code onto it changes no price and is
  overwritten by the next recalculation. Call `sdk.cart.applyCoupon(code)` — see
  [the coupon feature](../../../features/cart/coupon/guide/overview.md).
- **A failed recalculation does not retry.** When the totals request fails the
  store logs `Failed to sync cart with API`, clears `isCalculating`, and leaves
  the previous figures in place, so the page keeps showing the last good total
  for a cart that has since changed. Call `sdk.cart.calculateTotals()` again, or
  gate the checkout button on a successful `cart:updated`.
- **`currency` is not persisted, so a currency switch can leave stale line
  prices.** After a reload the campaign load sees no previous currency and
  stamps the new one without repricing the lines. Call
  `sdk.cart.refreshItemPrices()` when the page changes currency.
- **Nothing empties the cart when an order completes.** `next-cart-state` has no
  expiry and the order path never calls `clear()`, so a tab that finishes a
  purchase starts the next one with the old lines. Put
  `<meta name="next-clear-cart" content="true">` on the page that must start
  empty, or call `sdk.cart.clear()` after the order is confirmed.
- **It has no concept of stock or availability.** A package removed in the
  backend stays in the cart until the campaign reload notices, and the failure
  surfaces at order submission rather than in the cart.
