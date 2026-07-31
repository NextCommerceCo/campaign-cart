import { defineStore } from '@/core/docs/state-manifest';

export default defineStore({
  id: 'cart',
  storeHook: 'useCartStore',
  stateInterface: 'CartState',
  interfaceFile: 'types/global.ts',
  // `persist()` lives in the store file, not with the type.
  storeFile: 'state/cart/cart.state.ts',
  summary:
    'Holds what the shopper has chosen to buy and what it costs — lines, coupons, shipping choice, and the totals the API priced them at.',

  persistence: {
    mechanism: 'zustand-persist',
    key: 'next-cart-state',
    newFieldRule:
      'a new field is **not** persisted unless you add it to the `partialize` list in `state/cart/cart.state.ts`. That list is an allow-list of six keys (`items`, `vouchers`, `shippingMethod`, `totalQuantity`, `isEmpty`, and a hardcoded empty `enrichedItems`) — everything else is dropped on write and starts from `initialCartState` on the next page. Adding a field and expecting it back after a refresh is the single most common mistake with this store.',
  },

  fields: [
    {
      name: 'items',
      kind: 'persisted',
      description:
        'The lines the shopper has chosen: one entry per package, with the quantity and the package pricing captured when it was added. This is the list checkout submits, so it is the field to trust over any display copy.',
      notes:
        'A line `id` is `Date.now()` at add time, not a server id — two lines added in the same millisecond can collide. Match lines by `packageId`, never by `id`.',
    },
    {
      name: 'enrichedItems',
      kind: 'transient',
      description:
        'Intended to hold display-ready lines with a full price breakdown, but nothing populates it — it is `[]` on a fresh store, `[]` in storage, and `[]` after every recalculation.',
      notes:
        'Rendering from `enrichedItems` shows an empty cart even when items exist (the analytics layer hit this and switched to `items`). Read `items` for what was bought and `summary.lines` for priced, product-enriched rows.',
    },
    {
      name: 'totalQuantity',
      kind: 'persisted',
      description:
        'How many units are in the cart in total, counting quantity across every line. This is the number a cart badge shows.',
      notes:
        'It is stored *and* recalculated: `onRehydrateStorage` runs `calculateTotals()`, so the restored value is replaced roughly 150 ms later by the API count. Never write it by hand — the next recalculation overwrites it.',
    },
    {
      name: 'isEmpty',
      kind: 'persisted',
      description:
        'Whether the shopper has nothing in the cart — the flag empty-cart states and disabled checkout buttons read.',
      notes:
        'Derived from `items.length`, so it is redundant with `items`. If the two ever disagree, `items` is right; call `sdk.cart.calculateTotals()` to resettle the flag.',
    },
    {
      name: 'vouchers',
      kind: 'persisted',
      description:
        'The coupon codes currently applied, as the shopper typed them (upper-cased and trimmed). Read it to render "applied coupons" chips.',
      notes:
        'This is a **mirror**, not the source of truth: coupons live on `useCheckoutStore().vouchers`, and the cart copy is only refreshed when a recalculation succeeds. Writing to `cart.vouchers` changes no price — apply and remove through `sdk.cart.applyCoupon()` / `sdk.cart.removeCoupon()`.',
    },
    {
      name: 'swapInProgress',
      kind: 'transient',
      description:
        'True while a whole-cart swap is mid-flight, between clearing the old lines and writing the new ones. Use it to block a second click during that window, since two overlapping swaps interleave lines.',
    },
    {
      name: 'currency',
      kind: 'transient',
      description:
        'The currency the prices on `items` were captured in. `undefined` means no campaign load has stamped one yet.',
      notes:
        'It is not persisted, so after a refresh the campaign load sees no previous currency and stamps the new one without refreshing item prices. A cart carried across a currency switch can keep the old per-item prices until the next recalculation; call `sdk.cart.refreshItemPrices()` if the page changes currency.',
    },
    {
      name: 'offerDiscounts',
      kind: 'computed',
      description:
        'The campaign offers the API applied to this cart (buy-2-get-1, tiered pricing), each with its amount and description — what to list when explaining a discount the shopper did not type in.',
    },
    {
      name: 'voucherDiscounts',
      kind: 'computed',
      description:
        'The discounts the applied coupon codes produced, each with its amount. Kept apart from `offerDiscounts` so a page can show "your coupon saved X" without counting automatic offers.',
    },
    {
      name: 'subtotal',
      kind: 'computed',
      description:
        'The price of the lines before shipping and before discounts, as the API calculated it.',
      notes:
        'A `Decimal`, not a number. `subtotal + 5` concatenates or yields nonsense — use `subtotal.plus(5)`, and `.toNumber()` / `.toFixed(2)` to hand it to formatting code.',
    },
    {
      name: 'shippingMethod',
      kind: 'persisted',
      description:
        'The shipping option in effect, with its price, its pre-discount price, and any shipping discount. `undefined` means none has been chosen, in which case pricing falls back to shipping method `1`.',
      notes:
        'Its money fields are `Decimal`s that do not survive JSON. Rehydration rebuilds them from the stored strings; anything that reads sessionStorage directly gets strings and will throw on `.plus()`.',
    },
    {
      name: 'hasDiscounts',
      kind: 'computed',
      description:
        'Whether the shopper is saving anything at all, from a coupon or an offer. The flag a "you saved" block should gate on rather than testing amounts itself.',
    },
    {
      name: 'totalDiscount',
      kind: 'computed',
      description:
        'How much the shopper is saving in total, coupons and offers combined, as a `Decimal`.',
    },
    {
      name: 'totalDiscountPercentage',
      kind: 'computed',
      description:
        'The same saving expressed as a percentage of the subtotal — what a "35% off" badge renders. `0` when the subtotal is zero, so a badge does not divide by nothing.',
    },
    {
      name: 'total',
      kind: 'computed',
      description:
        'The amount the shopper will be charged: lines plus shipping, less every discount. This is the figure to display next to a checkout button.',
      notes:
        'Between an add and the API answering, this holds an optimistic local sum with **no** discounts and **no** shipping, so it can briefly read high or low. Render it from the `cart:updated` event rather than immediately after an `await sdk.cart.addItem()`.',
    },
    {
      name: 'summary',
      kind: 'computed',
      description:
        "The pricing API's own answer, kept whole: per-line totals and discounts, with each line enriched with its package name, image, and product details. This is the priced, renderable view of the cart. `undefined` until the first recalculation returns.",
      notes:
        'Its `lines` are not one-to-one with `items`: lines can be split or merged to match per-line `properties` (personalised slots). Do not index one against the other — match on `package_id`.',
    },
    {
      name: 'isCalculating',
      kind: 'transient',
      description:
        'True while the pricing call is in flight. Show a placeholder on price fields instead of the previous total, so the shopper does not read a stale figure as final.',
    },
  ],

  operations: [
    {
      name: 'sdk.cart.addItem({ packageId, quantity, isUpsell })',
      effect:
        'Adds a package, or increases the quantity of the line that already has it, using pricing from the campaign store. Updates totals locally at once, then recalculates against the API. Throws if the package is not in the loaded campaign.',
      deprecated:
        'the `useCartStore.getState().addItem()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.removeItem(packageId)',
      effect:
        'Removes the line for that package entirely and recalculates. Does nothing visible if the package is not in the cart.',
      deprecated:
        'the `useCartStore.getState().removeItem()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.updateQuantity(packageId, quantity)',
      effect:
        'Sets the line to an exact quantity and recalculates. A quantity of `0` or less removes the line instead.',
      deprecated:
        'the `useCartStore.getState().updateQuantity()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.swapPackage(removePackageId, addItem)',
      effect:
        'Exchanges one package for another in a single write, carrying the removed line\'s `properties` over, and reports the price difference on the swap event. This is what an upgrade or downgrade selector calls.',
      deprecated:
        'the `useCartStore.getState().swapPackage()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.swapCart(items)',
      effect:
        'Replaces the whole cart with the given packages in one write, then recalculates. Packages missing from the campaign are skipped with a warning rather than failing the swap.',
      deprecated:
        'the `useCartStore.getState().swapCart()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.clear()',
      effect:
        'Empties the lines and recalculates. Applied coupons stay on the checkout store, so they re-apply to whatever is added next.',
      deprecated:
        'the `useCartStore.getState().clear()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.calculateTotals()',
      effect:
        'Reprices the cart against the API and writes every computed field. Debounced by 150 ms and self-cancelling, so rapid calls collapse into one request. Every other operation already calls it — call it directly only after changing something it cannot see.',
      deprecated:
        'the `useCartStore.getState().calculateTotals()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.refreshItemPrices()',
      effect:
        'Re-reads every line\'s price, and the shipping price, from the currently loaded campaign, then recalculates. This is how a currency switch repriced an existing cart. Logs a warning and returns without changing anything if no campaign is loaded.',
      deprecated:
        'the `useCartStore.getState().refreshItemPrices()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.setShippingMethod(methodId)',
      effect:
        "Selects a shipping option from the campaign's list, mirrors it onto the checkout store, and recalculates. Throws if the campaign has no shipping methods or no method with that id.",
      deprecated:
        'the `useCartStore.getState().setShippingMethod()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.applyCoupon(code)',
      effect:
        'Adds a coupon (upper-cased and trimmed) to the checkout store and recalculates. Returns `{ success, message }` — `success: false` with "Coupon already applied" when it is already on. Note that a code the API rejects still returns `success: true` — the discount comes back as zero instead.',
      deprecated:
        'the `useCartStore.getState().applyCoupon()` delegator is legacy — it forwards here.',
    },
    {
      name: 'sdk.cart.removeCoupon(code)',
      effect:
        'Takes the coupon off the checkout store and recalculates. The code must match what was stored, which is the upper-cased form.',
      deprecated:
        'the `useCartStore.getState().removeCoupon()` delegator is legacy — it forwards here.',
    },
  ],

  setters: [
    {
      name: 'setItemProperties(packageId, properties)',
      effect:
        'Attaches or replaces the custom key-value properties on a line (a monogram, an engraving). Does not reprice — follow it with `sdk.cart.calculateTotals()` if the properties affect how lines are split.',
    },
    {
      name: 'setLastCurrency(currency)',
      effect:
        'Stamps the currency the current item prices belong to. The campaign load calls this; a page has no reason to.',
    },
    {
      name: 'setSwapInProgress(value)',
      effect:
        'Raises or lowers the swap guard by hand, for a feature that swaps lines outside `swapCart`.',
    },
    {
      name: 'reset()',
      effect:
        'Returns the store to its empty state. Unlike `sdk.cart.clear()` it does not reprice, so nothing calls the API afterwards.',
    },
  ],

  selectors: [
    {
      name: 'hasItem(packageId)',
      effect: 'Whether that package is in the cart — the check an "in cart" badge uses.',
    },
    {
      name: 'getItem(packageId)',
      effect:
        'The line for that package, or `undefined` if it is not in the cart. Returns the first match, so a package split across property groups gives you only the first line.',
    },
    {
      name: 'getItemQuantity(packageId)',
      effect: 'The quantity on that line, or `0` when it is absent — no null check needed.',
    },
    {
      name: 'getTotalItemCount()',
      effect: 'Units across every line, counted from `items` rather than from the API answer.',
    },
    {
      name: 'getTotalWeight()',
      effect:
        'Returns the same unit count as `getTotalItemCount()`.',
      deprecated:
        'it does not compute weight — no weight data reaches the cart. Use `getTotalItemCount()` and do not build shipping rules on it.',
    },
    {
      name: 'getCoupons()',
      effect: 'The applied coupon codes, `[]` when none — the mirror described under `vouchers`.',
    },
  ],

  emits: [
    'cart:updated',
    'cart:item-added',
    'cart:item-removed',
    'cart:quantity-changed',
    'cart:package-swapped',
    'shipping:method-changed',
  ],

  example: `{
  "items": [
    {
      "id": 1769800012345,
      "packageId": 2,
      "quantity": 2,
      "price": 39.98,
      "title": "6 Bottle Pack",
      "sku": "NX-6PK",
      "qty": 6,
      "price_per_unit": "6.66",
      "price_total": "39.98",
      "price_retail_total": "59.94",
      "is_upsell": false,
      "is_recurring": false
    }
  ],
  "enrichedItems": [],
  "totalQuantity": 2,
  "isEmpty": false,
  "vouchers": ["SAVE10"],
  "currency": "USD",
  "subtotal": "79.96",
  "totalDiscount": "8.00",
  "totalDiscountPercentage": "10.01",
  "total": "76.91",
  "hasDiscounts": true,
  "voucherDiscounts": [
    { "amount": "8.00", "name": "SAVE10", "percentage": "10", "description": "10% off" }
  ],
  "offerDiscounts": [],
  "shippingMethod": {
    "id": 1,
    "name": "standard",
    "code": "standard",
    "price": "4.95",
    "originalPrice": "4.95",
    "discountAmount": "0",
    "discountPercentage": "0",
    "hasDiscounts": false
  },
  "summary": {
    "currency": "USD",
    "subtotal": "79.96",
    "total": "76.91",
    "total_discount": "8.00",
    "lines": [
      {
        "package_id": 2,
        "quantity": 2,
        "unit_price": "6.66",
        "package_price": "39.98",
        "total": "79.96",
        "total_discount": "8.00",
        "name": "6 Bottle Pack",
        "image": "https://cdn.example.com/6pk.jpg"
      }
    ]
  },
  "swapInProgress": false,
  "isCalculating": false
}`,

  cautions: [
    '**A new state field is dropped on reload unless it is in `partialize`.** The symptom is a field that works all session and resets to its initial value on the next page of the funnel, with no error anywhere. Add the field to the `partialize` allow-list in `state/cart/cart.state.ts` (and remember it is written raw — a `Decimal` comes back as a string unless `onRehydrateStorage` revives it, the way `shippingMethod` is revived).',
    '**Never rename the `next-cart-state` key.** Every shopper mid-funnel is holding a cart under the old key; a rename orphans it and their cart silently empties between pages. Add fields, change the shape, but leave the key alone.',
    '**Totals are asynchronous, debounced by 150 ms, and cancellable.** `await sdk.cart.addItem({ packageId: 2, quantity: 1, isUpsell: false })` resolves before the API has priced anything, so reading `total` on the next line gives an optimistic sum with no discounts and no shipping — a page that submits or displays it shows the wrong money. Read totals from the `cart:updated` event, or gate rendering on `isCalculating`.',
    '**Money fields are `decimal.js` instances, not numbers.** `subtotal`, `total`, `totalDiscount`, `totalDiscountPercentage`, and the prices on `shippingMethod` all throw or concatenate under `+`. Use `.plus()`/`.minus()` for arithmetic and `.toNumber()` or `.toFixed(2)` at the display boundary.',
    '**`enrichedItems` is always empty.** Anything rendering from it shows a cart with no lines even though `items` is full, because both the initial state and `partialize` hardcode `[]` and nothing ever writes to it. Read `items`, or `summary.lines` when you need priced, product-enriched rows.',
    '**Coupons do not live on the cart.** `vouchers` is a copy refreshed only when a recalculation succeeds; the store of record is `useCheckoutStore().vouchers`. Pushing a code onto `cart.vouchers` changes no price and disappears at the next recalculation — call `sdk.cart.applyCoupon(code)`.',
    "**`addItem` merges by `packageId` alone.** Adding the same package twice with different `properties` folds it into one line and throws the new properties away, so a second personalised slot loses its engraving. Build the lines yourself and call `sdk.cart.swapCart(items)` when each slot needs its own properties.",
    '**Async cart logic belongs in `operations/`, not in the store.** The store is a state container; the methods it still exposes are legacy delegators kept for older pages. New code calls `sdk.cart.*` / `cartOperations`, and new business logic goes in a file under `state/cart/operations/`.',
  ],
});
