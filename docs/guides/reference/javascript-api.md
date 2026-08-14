---
title: "Reference/JavaScript API"
group: "Reference"
category: "Reference"
---

# JavaScript API

Most pages never call the SDK from JavaScript: the attributes do the work. `window.next` exists for the rest: popups, coupons applied from your own code, shipping pickers you render yourself, and reading cart or campaign data in a callback. This page is every public method, grouped by task, with the calls real funnels make shown as they appear in the starter templates.

## Accessing the SDK

`window.next` does not exist until boot finishes. Two safe patterns, both usable before or after boot:

```html
<script>
  window.nextReady = window.nextReady || [];
  window.nextReady.push(function (next) {
    console.log('cart total', next.getCartTotals().total.toNumber());
  });
  window.addEventListener('next:initialized', function () {
    initMyPageLogic();
  });
</script>
```

`window.nextReady` is a queue the loader creates: callbacks pushed before boot run when boot completes, callbacks pushed after boot run immediately. `next:initialized` fires on `window` once, when the cart is restored, the campaign is loaded, and `window.next` is live. Do not use `next:ready`: it only means the SDK file arrived, and the cart still looks empty.

## Cart

The supported programmatic cart surface is `next.cart.*`, one async function per operation, shared with everything the attributes do (`state/cart/operations`): `addItem`, `removeItem`, `updateQuantity`, `swapPackage`, `swapCart`, `clear`, `calculateTotals`, `refreshItemPrices`, `setShippingMethod`, `applyCoupon`, `removeCoupon`. The facade also carries direct helpers:

| Method | What it does |
|---|---|
| `addItem({ packageId, quantity })` | Adds a package to the cart. Quantity defaults to 1. For post-purchase adds use `addUpsell` instead. |
| `removeItem({ packageId })` | Removes a package's line entirely. |
| `updateQuantity({ packageId, quantity })` | Sets the exact quantity; 0 removes the line. |
| `clearCart()` | Empties the cart. |
| `swapCart(items)` | Replaces the whole cart with the given lines in one atomic write. This is what bundle selectors use. |
| `hasItemInCart({ packageId })` | Whether the package currently has a cart line. |
| `getCartData()` | A snapshot of the full cart: totals (under `cartTotals`), campaign data, applied vouchers. Known bug [#36](https://github.com/NextCommerceCo/campaign-cart/issues/36): its `cartLines` array is always empty. Don't gate on it; use `getCartCount()` or `hasItemInCart()` instead. |
| `getCartTotals()` | The current totals (subtotal, total, discounts, shipping) as `Decimal`s. Call `.toNumber()` for a plain number. |
| `getCartCount()` | Total units in the cart (sum of line quantities). |

## Campaign lookups

| Method | What it does |
|---|---|
| `getCampaignData()` | The loaded campaign (packages, currency, shipping methods), or `null` before it loads. |
| `getPackage(refId)` | One package by its `ref_id`, or `null`. |
| `getVariantsByProductId(productId)` | All variant packages for a product. |
| `getAvailableVariantAttributes(productId, code)` | The distinct values of one variant attribute (all sizes, all colours) for building pickers. |
| `getPackageByVariantSelection(productId, attrs)` | The concrete package for a full attribute selection, e.g. `{ color: 'red', size: 'L' }`. |
| `createVariantKey(attrs)` | A stable, order-independent key from an attribute set, e.g. `color:red|size:L`. |

## Events and callbacks

`next.on(event, handler)` subscribes to a typed SDK event and `next.off(event, handler)` unsubscribes. Names and payloads are typed by {@link EventMap}. `registerCallback` / `unregisterCallback` / `triggerCallback` are the older lifecycle-callback channel; prefer `on`.

From the apollo template's `checkout.js`, reacting when the social-proof popup shows:

```js
next.on('fomo:shown', () => {
  // available: data.customer, data.product, data.image
});
```

## Coupons

`applyCoupon(code)` applies a code and recalculates totals, resolving to `{ success, message }`. `success: false` only when the code is already applied. It does **not** validate the code against the campaign's coupons: an unknown code still resolves `success: true` and simply discounts nothing. `removeCoupon(code)` removes it; `getCoupons()` lists the codes currently applied. From the apollo template's `checkout-apollo.js`, wiring a discount to the exit-intent popup:

```js
window.addEventListener('next:initialized', function() {
  initExitIntentImage('https://example.com/exit-offer.png', async () => {
    await next.applyCoupon('EXIT10');
  });
});
```

## Shipping

`getShippingMethods()` lists the campaign's shipping methods, `getSelectedShippingMethod()` returns the current one or `null`, and `setShippingMethod(refId)` selects one and recalculates totals. It throws for an id the campaign does not offer. The shop-three-step template builds its shipping radios from exactly these calls (`checkout-shop-three-shipping.js`):

```js
var methods = sdk.getShippingMethods();
if (methods[0]) sdk.setShippingMethod(methods[0].ref_id);
```

## Post-purchase upsells

| Method | What it does |
|---|---|
| `addUpsell({ packageId }` or `{ items })` | Adds packages to the already-paid order, charging the saved payment method. Throws when no order is in session, the order cannot take upsells, or one is mid-processing. |
| `canAddUpsells()` | Whether the order can take an upsell right now. Also `false` while one processes, so it guards a double submit. |
| `getCompletedUpsells()` | Package ids already accepted on this order, as strings. |
| `isUpsellAlreadyAdded(packageId)` | Whether a package was already accepted. Survives a reload. |

## Popups

`exitIntent(options)` arms the exit-intent popup (lazy-loads it on first call) and `disableExitIntent()` stops it. `fomo(config)` starts the rotating social-proof popup, using its defaults when called with no config; `stopFomo()` stops it. Every starter checkout calls `next.fomo({})` once on `next:initialized`.

## Analytics

The automatic events are covered in [Analytics Events](./analytics-events.md). The methods exist for what the SDK cannot see:

| Method | What it does |
|---|---|
| `trackViewItemList(packageIds, _listId, listName)` | Reports a product list impression. |
| `trackViewItem(packageId)` | Reports one package viewed. Dropped with a warning if the package is not in the loaded campaign. |
| `trackAddToCart(packageId, quantity)` | Reports an add that happened outside the SDK's own cart calls. Pairing it with `addItem` reports the add twice. |
| `trackRemoveFromCart(packageId, quantity)` | Same, for removals, with the same double-report risk. |
| `trackBeginCheckout()` | Reports checkout starting. The built-in checkout form already fires this; call it only for a hand-built flow. |
| `trackPurchase(orderData)` | Reports a completed order. The receipt page already fires this; a second call doubles reported revenue. |
| `trackCustomEvent(name, data)` | Sends an event of your own naming. Nothing validates the name; a typo becomes a new event. |
| `trackSignUp(email)` / `trackLogin(email)` | Reports a sign-up / login. The address goes into the payload as plain text; nothing hashes it. |
| `setDebugMode(enabled)` | Verbose analytics logging at runtime. Unrelated to the `?debugger=true` overlay. |
| `invalidateAnalyticsContext()` | Discards the cached page context so the next event is built from the current route. Needed in a single-page app. |

## Attribution and metadata

`setAttribution(attribution)` overwrites the collected attribution (funnel, affiliate, `utm_*`), which decides who is credited for the sale. `getAttribution()` returns it as it will be sent to the order API, and `debugAttribution()` prints the whole state to the console. `addMetadata(key, value)` and `setMetadata(object)` merge keys into the metadata sent with the order (both merge, neither replaces, so the automatic fields survive); `clearMetadata()` drops your keys while keeping the automatic ones; `getMetadata()` reads the bag.

## URL parameters

Boot captures every URL parameter for the session; these read and edit that captured set without touching the address bar: `getParam(key)`, `getAllParams()`, `hasParam(key)`, `setParam(key, value)`, `setParams(object)`, `mergeParams(object)`, `clearParam(key)`, `clearAllParams()`.

## Utility

`getVersion()` returns the running SDK version. `formatPrice(amount, currency?)` formats an amount in the campaign currency, e.g. `$19.99`. `validateCheckout()` returns `{ valid, errors }` (currently: the cart must not be empty).

## Cautions

- **Calling anything before `next:initialized` fails.** `window.next` is `undefined` and the cart reads empty. The symptom is code that works pasted into the console but not on page load. Use the `nextReady` queue.
- **The `track*` cart methods are for external carts only.** `trackAddToCart` next to `addItem`, or `trackPurchase` on a page the SDK already reports, double-counts. If the SDK performed the action, it already reported it.
- **`clearAllParams()` also clears captured `utm_*` values**, which attribution reads. Call it and the order may lose its traffic source.
- **Old store methods still exist but are legacy.** `useCartStore.getState().addItem()` forwards to the same operation as `next.cart.addItem` and survives only because live pages call it. Write new code against `window.next`.
