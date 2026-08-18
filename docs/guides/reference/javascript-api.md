---
title: "Reference/JavaScript API"
group: "Reference"
category: "Reference"
---

# JavaScript API

Reach for `window.next` when the markup cannot express what you need: a coupon applied from your own code, a shipping picker you render yourself, a popup that reacts to the cart. The attributes cover everything else, so most pages never open this page at all.

## Initialization

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

`window.nextReady` is a queue the loader creates: callbacks pushed before boot run when boot completes, callbacks pushed after boot run immediately. `next:initialized` fires on `window` once, when the cart is restored, the campaign is loaded, and `window.next` is live.

Do not use `next:ready`. It only means the SDK file arrived, and the cart still looks empty.

## The SDK instance

The SDK creates one instance of itself during boot and assigns it to `window.next`. You do not construct it. Because boot is asynchronous, code that runs early has to wait — that is what `window.nextReady` is for (see the window surface).

| Method | Description |
|---|---|
| [`next.getInstance`](#nextgetinstance) | Returns the one shared SDK instance, creating it if boot has not reached that point yet. |

## Reading the cart

Snapshots of the cart as it stands right now. None of these change anything, and none of them wait for anything — if you call them before the campaign has loaded you get an empty cart, not an error. Subscribe to `cart:updated` instead of polling.

| Method | Description |
|---|---|
| [`next.hasItemInCart`](#nexthasitemincart) | Whether a given package is currently in the cart, at any quantity. |
| [`next.getCartData`](#nextgetcartdata) | One snapshot carrying everything about the cart: priced line items, totals, the loaded campaign, and applied coupon codes. |
| [`next.getCartTotals`](#nextgetcarttotals) | The money only: subtotal, total, discount amount and percentage, and the chosen shipping method. |
| [`next.getCartCount`](#nextgetcartcount) | How many units are in the cart in total — quantities summed, not the number of lines. |

## Changing the cart

Every one of these recalculates totals and emits a cart event when it settles. `next.cart` is the fuller API — the shortcuts below it cover the common cases with less to type.

| Method | Description |
|---|---|
| [`next.cart`](#nextcart) | The full programmatic cart API — the supported way to drive the cart from code. |
| [`next.addItem`](#nextadditem) | Adds a package to the cart, defaulting to one unit, merging with an existing line for the same package. |
| [`next.removeItem`](#nextremoveitem) | Removes a package from the cart completely, whatever its quantity. |
| [`next.updateQuantity`](#nextupdatequantity) | Sets a package to an exact quantity, rather than adding to what is already there. |
| [`next.clearCart`](#nextclearcart) | Empties the cart. |
| [`next.swapCart`](#nextswapcart) | Replaces the whole cart with the list you pass, in one step — anything already in the cart and not in the list is removed. |

## Coupons

Discount codes applied to the whole cart. Applying one is validated against the campaign, so it can fail for a reason worth showing the visitor.

| Method | Description |
|---|---|
| [`next.applyCoupon`](#nextapplycoupon) | Validates a discount code against the campaign and applies it to the cart if it holds. |
| [`next.removeCoupon`](#nextremovecoupon) | Takes a previously applied discount code off the cart and recalculates totals. |
| [`next.getCoupons`](#nextgetcoupons) | The discount codes currently applied to the cart. |

## Shipping

The shipping methods the campaign offers, and which one the visitor has chosen. Choosing one changes the cart total, so it belongs to the cart, not to the form.

| Method | Description |
|---|---|
| [`next.getShippingMethods`](#nextgetshippingmethods) | Every shipping method the loaded campaign offers, with its id, code, and price. |
| [`next.getSelectedShippingMethod`](#nextgetselectedshippingmethod) | The shipping method the visitor has chosen, or `null` when they have not chosen one yet. |
| [`next.setShippingMethod`](#nextsetshippingmethod) | Chooses a shipping method by id and recalculates the cart total with its price. |

## Catalog

Read-only lookups into the loaded campaign. A *package* is the sellable unit — a quantity of a product at a price — and its `ref_id` is the number every cart call takes. The variant lookups exist so you can build your own size/colour picker instead of using the built-in one.

| Method | Description |
|---|---|
| [`next.getCampaignData`](#nextgetcampaigndata) | The loaded campaign — its packages, currency, and shipping methods — or `null` if it has not arrived yet. |
| [`next.getPackage`](#nextgetpackage) | Looks up one package by its `ref_id` — the number every cart call and every `data-next-package-id` uses. |
| [`next.getVariantsByProductId`](#nextgetvariantsbyproductid) | Every package that is a variant of one product — each size, colour, or flavour of it. |
| [`next.getAvailableVariantAttributes`](#nextgetavailablevariantattributes) | The distinct values one variant attribute takes for a product — every size it comes in, say — for building a picker. |
| [`next.getPackageByVariantSelection`](#nextgetpackagebyvariantselection) | Resolves the one package matching a complete set of chosen variant attributes, so you can add it to the cart. |
| [`next.createVariantKey`](#nextcreatevariantkey) | Turns a set of chosen variant attributes into one stable string, for use as a lookup key in your own code. |

## Events

Two mechanisms, and they are not interchangeable. `on`/`off` subscribe to the typed SDK event bus and are what you want. `registerCallback` is the older lifecycle-hook channel, kept for pages that already use it.

| Method | Description |
|---|---|
| [`next.on`](#nexton) | Subscribes to an SDK event. |
| [`next.off`](#nextoff) | Unsubscribes a handler that was registered with `next. |
| [`next.registerCallback`](#nextregistercallback) | Registers a handler for a callback type, which receives whatever snapshot the caller of `next. |
| [`next.unregisterCallback`](#nextunregistercallback) | Removes a callback registered with `next. |
| [`next.triggerCallback`](#nexttriggercallback) | Fires every callback registered for a type, with a snapshot you supply. |

## Analytics

The SDK already tracks the standard ecommerce funnel on its own. Call these only for something it cannot see — a custom step, a view of a list you rendered yourself, a sign-up outside the checkout form. Every one of them is fire-and-forget: it queues the work and resolves immediately, and a failure is logged rather than thrown, so analytics can never break a page.

| Method | Description |
|---|---|
| [`next.trackViewItemList`](#nexttrackviewitemlist) | Reports that a list of packages was shown — a product grid or a recommendation rail you rendered yourself. |
| [`next.trackViewItem`](#nexttrackviewitem) | Reports that one package was viewed in detail. |
| [`next.trackAddToCart`](#nexttrackaddtocart) | Reports an add-to-cart that happened outside the SDK's own cart calls. |
| [`next.trackRemoveFromCart`](#nexttrackremovefromcart) | Reports a removal that happened outside the SDK's own cart calls. |
| [`next.trackBeginCheckout`](#nexttrackbegincheckout) | Reports that the visitor started checkout, using the current cart contents. |
| [`next.trackPurchase`](#nexttrackpurchase) | Reports a completed order, with the order payload as the event's source of truth. |
| [`next.trackCustomEvent`](#nexttrackcustomevent) | Sends an event of your own naming, with any payload you choose. |
| [`next.trackSignUp`](#nexttracksignup) | Reports a newsletter or account sign-up, identified by email address. |
| [`next.trackLogin`](#nexttracklogin) | Reports a returning visitor signing in, identified by email address. |
| [`next.setDebugMode`](#nextsetdebugmode) | Turns verbose analytics logging on or off at runtime, so you can see every event as it is built and dispatched. |
| [`next.invalidateAnalyticsContext`](#nextinvalidateanalyticscontext) | Tells analytics the page changed, so the next event is built with fresh page context instead of the previous route's. |

## Attribution and metadata

Attribution is the record of where the visitor came from; metadata is the free-form bag of extra values attached to the order. Both are collected automatically and sent with the order — these calls are for adding your own values on top.

| Method | Description |
|---|---|
| [`next.addMetadata`](#nextaddmetadata) | Attaches one extra named value to the order's metadata. |
| [`next.setMetadata`](#nextsetmetadata) | Attaches several named values to the order's metadata in one call. |
| [`next.clearMetadata`](#nextclearmetadata) | Drops the metadata you added, keeping the fields the SDK collects on its own. |
| [`next.getMetadata`](#nextgetmetadata) | The metadata that will be sent with the order, automatic fields included. |
| [`next.setAttribution`](#nextsetattribution) | Overrides the attribution the SDK collected — the funnel, affiliate, and campaign fields recorded against the order. |
| [`next.getAttribution`](#nextgetattribution) | The attribution exactly as it will be sent to the order API. |
| [`next.debugAttribution`](#nextdebugattribution) | Prints the whole attribution state to the console, formatted for reading. |

## URL parameters

The SDK captures every URL parameter on the first page view and keeps them for the whole session, so a value from the ad click is still available three pages later. These read and edit that captured set; they do not rewrite the address bar.

| Method | Description |
|---|---|
| [`next.setParam`](#nextsetparam) | Sets one captured URL parameter for the rest of the session. |
| [`next.setParams`](#nextsetparams) | Sets several captured URL parameters at once. |
| [`next.getParam`](#nextgetparam) | Reads one captured URL parameter, or `null` when it was never present. |
| [`next.getAllParams`](#nextgetallparams) | Every URL parameter captured for this session. |
| [`next.hasParam`](#nexthasparam) | Whether a parameter was captured, regardless of its value. |
| [`next.clearParam`](#nextclearparam) | Forgets one captured URL parameter. |
| [`next.clearAllParams`](#nextclearallparams) | Forgets every captured URL parameter for this session. |
| [`next.mergeParams`](#nextmergeparams) | Adds parameters to the captured set without disturbing keys you did not name. |

## Post-purchase upsells

Offers added to an order that has already been paid for. They only work on a page reached after checkout, while the order is still in session — see the caution on `addUpsell`.

| Method | Description |
|---|---|
| [`next.addUpsell`](#nextaddupsell) | Adds one or more packages to the order the visitor has already paid for, charging their saved payment method. |
| [`next.canAddUpsells`](#nextcanaddupsells) | Whether the order in session can still take a post-purchase upsell right now. |
| [`next.getCompletedUpsells`](#nextgetcompletedupsells) | The package ids of upsells this order has already accepted. |
| [`next.isUpsellAlreadyAdded`](#nextisupsellalreadyadded) | Whether a package has already been accepted on this order, so a repeat offer can be skipped. |

## On-page popups

One behaviour with no `data-next-*` attribute of its own: you turn it on by calling it. It has a full guide of its own, linked from its row.

| Method | Description |
|---|---|
| [`next.exitIntent`](#nextexitintent) | Shows an image or template popup when the visitor looks like they are about to leave. |
| [`next.disableExitIntent`](#nextdisableexitintent) | Stops the exit-intent popup from appearing again on this page. |

## Utilities

Small helpers that do not belong to any one part of the flow.

| Method | Description |
|---|---|
| [`next.getVersion`](#nextgetversion) | The SDK version running on the page — the loader-reported value if there is one, otherwise the version baked in at build. |
| [`next.formatPrice`](#nextformatprice) | Formats a number as money in the campaign's currency, so your own markup matches the SDK's. |
| [`next.validateCheckout`](#nextvalidatecheckout) | A pre-flight check before sending the visitor to checkout, returning the reasons it would fail. |

## Cart operations

`next.cart` is the supported programmatic cart surface. Every operation is async and shared with everything the attributes do.

| Operation | Description |
|---|---|
| `next.cart.addItem` | Adds a package, merging with an existing line for the same package. |
| `next.cart.removeItem` | Removes a package entirely, whatever its quantity. |
| `next.cart.updateQuantity` | Sets an exact quantity. |
| `next.cart.swapPackage` | Removes one package and adds another in the same step, so the cart is never briefly empty. |
| `next.cart.swapCart` | Replaces the entire contents with the list given. |
| `next.cart.clear` | Empties the cart. |
| `next.cart.calculateTotals` | Recalculates totals from the current lines. |
| `next.cart.refreshItemPrices` | Re-reads every line's price from the loaded campaign. |
| `next.cart.setShippingMethod` | Chooses a shipping method by id, validates it against the campaign, and recalculates the total. |
| `next.cart.applyCoupon` | Validates and applies a discount code. |
| `next.cart.removeCoupon` | Removes an applied discount code and recalculates. |

## Method reference

One section per member, with its signature, a runnable example, and what to watch out for. Signatures are read from `core/next-commerce/next-commerce.ts` so they cannot drift from the class.

### next.getInstance

Returns the one shared SDK instance, creating it if boot has not reached that point yet.

```ts
getInstance(): NextCommerce
```

```ts
import { NextCommerce } from '@next-commerce/campaign-cart';

const sdk = NextCommerce.getInstance();
console.log(sdk === window.next); // true
```

> **Watch out:** Reached off the class, not off `next` — `next.getInstance()` also works but reads as though it made a second SDK. On a page that loads the SDK from the loader script, prefer `window.next`; there is nothing to import.

### next.hasItemInCart

Whether a given package is currently in the cart, at any quantity.

```ts
hasItemInCart(options: { packageId?: number }): boolean
```

```ts
if (next.hasItemInCart({ packageId: 2 })) {
  document.querySelector('#upsell-banner')?.remove();
}
```

> **Watch out:** Called with no `packageId` it returns `false` rather than "is the cart non-empty" — use `next.getCartCount() > 0` for that.

### next.getCartData

One snapshot carrying everything about the cart: priced line items, totals, the loaded campaign, and applied coupon codes.

```ts
getCartData(): CallbackData
```

```ts
const { cartLines, cartTotals, vouchers } = next.getCartData();
console.log(`${cartLines.length} lines, ${cartTotals.total} total`);
console.log('coupons:', vouchers);
```

> **Watch out:** This is the same shape your `registerCallback` handlers receive, so it is the one to reach for when you are reproducing a callback outside its trigger. The amounts inside `cartTotals` are `Decimal` objects — see [`next.getCartTotals()`](#nextgetcarttotals).

### next.getCartTotals

The money only: subtotal, total, discount amount and percentage, and the chosen shipping method.

```ts
getCartTotals()
```

**Returns:** An object with `subtotal`, `total`, `totalDiscount` and `totalDiscountPercentage` as **`Decimal`** values (decimal.js instances, not plain numbers), plus a boolean `hasDiscounts` and `shippingMethod`, which is `undefined` until the visitor has chosen one.

```ts
const { subtotal, total, hasDiscounts } = next.getCartTotals();
if (hasDiscounts) {
  // Decimal arithmetic, then convert once at the end.
  console.log('saving', subtotal.minus(total).toFixed(2));
}
next.formatPrice(total.toNumber()); // '$59.98'
```

> **Watch out:** The amounts are `Decimal` objects, so `subtotal - total` is `NaN` and `total > 50` is a string comparison. Use `.minus()`, `.gt()` and friends, and call `.toNumber()` only when handing the value to something that wants a number — `formatPrice` is one.

### next.getCartCount

How many units are in the cart in total — quantities summed, not the number of lines.

```ts
getCartCount(): number
```

```ts
document.querySelector('#cart-badge')!.textContent =
  String(next.getCartCount());
```

> **Watch out:** Two of one package and one of another is `3`, not `2`. For the number of rows use `next.getCartData().cartLines.length`.

### next.cart

The full programmatic cart API — the supported way to drive the cart from code.

```ts
cart
```

**Returns:** The cart operations object. Its members are listed under [Cart operations](#cart-operations) below.

```ts
await next.cart.addItem({ packageId: 2, quantity: 1, isUpsell: false });
await next.cart.updateQuantity(2, 3);
await next.cart.swapPackage(2, { packageId: 7, quantity: 1, isUpsell: false });
```

> **Watch out:** Do not write to the cart store directly. The operations here carry the pricing, validation and event-emission logic; a raw `useCartStore.setState()` skips all three and leaves totals and analytics disagreeing with the visible cart.

### next.addItem

Adds a package to the cart, defaulting to one unit, merging with an existing line for the same package.

```ts
addItem(options: { packageId?: number; quantity?: number; }): Promise<void>
```

```ts
await next.addItem({ packageId: 2 });          // one unit
await next.addItem({ packageId: 7, quantity: 3 }); // three units
```

> **Watch out:** Omitting `packageId` does nothing at all — no throw, no log at warn level. If an add silently fails, check that the id actually reached the call. For upsell adds use `next.cart.addItem({ …, isUpsell: true })`, which is what marks the line for revenue reporting.

### next.removeItem

Removes a package from the cart completely, whatever its quantity.

```ts
removeItem(options: { packageId?: number }): Promise<void>
```

```ts
await next.removeItem({ packageId: 2 });
```

> **Watch out:** A `packageId` that is not in the cart is not an error; nothing happens.

### next.updateQuantity

Sets a package to an exact quantity, rather than adding to what is already there.

```ts
updateQuantity(options: { packageId?: number; quantity: number; }): Promise<void>
```

```ts
await next.updateQuantity({ packageId: 2, quantity: 3 }); // now exactly 3
await next.updateQuantity({ packageId: 2, quantity: 0 }); // removes the line
```

> **Watch out:** Quantity `0` removes the line. If you meant "leave it alone", do not call this — there is no no-op quantity.

### next.clearCart

Empties the cart.

```ts
clearCart(): Promise<void>
```

```ts
await next.clearCart();
console.log(next.getCartCount()); // 0
```

> **Watch out:** Declared `async` but the underlying clear is synchronous, so awaiting it buys you nothing beyond a tidy call site.

### next.swapCart

Replaces the whole cart with the list you pass, in one step — anything already in the cart and not in the list is removed.

```ts
swapCart(items: Array<{ packageId: number; quantity: number }>): Promise<void>
```

```ts
// The visitor picked the 3-pack bundle: it replaces whatever they had.
await next.swapCart([
  { packageId: 7, quantity: 1 },
  { packageId: 9, quantity: 2 },
]);
```

> **Watch out:** This is a replace, not a merge. Passing `[]` empties the cart. It is what bundle and swap-mode selectors use, which is also why pairing a swap-mode `package-selector` with `add-to-cart` on the same selector double-writes the cart — pick one.

### next.applyCoupon

Validates a discount code against the campaign and applies it to the cart if it holds.

```ts
applyCoupon(code: string): Promise<{ success: boolean; message: string }>
```

```ts
const { success, message } = await next.applyCoupon('SAVE10');
if (!success) {
  showError(message); // e.g. "Coupon already applied"
}
```

> **Watch out:** It resolves with `success: false` instead of throwing, so a bare `await` looks like it worked. Always read `success`, and show `message` — it is written for the visitor.

### next.removeCoupon

Takes a previously applied discount code off the cart and recalculates totals.

```ts
removeCoupon(code: string): void
```

```ts
next.removeCoupon('SAVE10');
```

> **Watch out:** Returns `void` even though the work behind it is asynchronous, so there is nothing to await. To act once the totals have settled, listen for `cart:updated`.

### next.getCoupons

The discount codes currently applied to the cart.

```ts
getCoupons(): string[]
```

```ts
for (const code of next.getCoupons()) {
  renderCouponChip(code);
}
```

### next.getShippingMethods

Every shipping method the loaded campaign offers, with its id, code, and price.

```ts
getShippingMethods(): ShippingMethodInfo[]
```

```ts
for (const method of next.getShippingMethods()) {
  addOption(method.ref_id, `${method.code} — ${method.price}`);
}
```

> **Watch out:** Empty before the campaign has loaded, which is indistinguishable from "this campaign has no shipping methods". Populate your selector on `campaign:loaded`, not on `DOMContentLoaded`.

### next.getSelectedShippingMethod

The shipping method the visitor has chosen, or `null` when they have not chosen one yet.

```ts
getSelectedShippingMethod(): SelectedShippingMethod | null
```

```ts
const method = next.getSelectedShippingMethod();
console.log(method ? method.name : 'not chosen yet');
```

### next.setShippingMethod

Chooses a shipping method by id and recalculates the cart total with its price.

```ts
setShippingMethod(methodId: number): Promise<void>
```

```ts
await next.setShippingMethod(1);
console.log(next.getCartTotals().total); // now includes shipping
```

> **Watch out:** Throws when the id is not one of the campaign's methods, so pass a `ref_id` from `getShippingMethods()` rather than a hard-coded number that was valid in a different campaign.

### next.getCampaignData

The loaded campaign — its packages, currency, and shipping methods — or `null` if it has not arrived yet.

```ts
getCampaignData(): Campaign | null
```

```ts
const campaign = next.getCampaignData();
if (campaign) {
  console.log(campaign.name, campaign.currency, campaign.packages.length);
}
```

> **Watch out:** `null` means "still loading", not "no campaign". Guard on it, or subscribe to `campaign:loaded` and read it there.

### next.getPackage

Looks up one package by its `ref_id` — the number every cart call and every `data-next-package-id` uses.

```ts
getPackage(id: number): any | null
```

```ts
const pkg = next.getPackage(2);
console.log(pkg?.name, pkg?.price);
```

> **Watch out:** Returns `null` both for an unknown id and for "campaign not loaded yet". Check `getCampaignData()` first when you need to tell those apart.

### next.getVariantsByProductId

Every package that is a variant of one product — each size, colour, or flavour of it.

```ts
getVariantsByProductId(productId: number): any | null
```

```ts
const variants = next.getVariantsByProductId(42);
console.log(variants?.map((v: { ref_id: number }) => v.ref_id));
```

> **Watch out:** Grouped by product id, which is not the package `ref_id`. A product with no variants returns `null`, not an empty list.

### next.getAvailableVariantAttributes

The distinct values one variant attribute takes for a product — every size it comes in, say — for building a picker.

```ts
getAvailableVariantAttributes(productId: number, attributeCode: string): string[]
```

```ts
const sizes = next.getAvailableVariantAttributes(42, 'size');
// ['S', 'M', 'L']
```

> **Watch out:** The attribute code is the campaign's own string (`size`, `color`), not a display label. An unknown code returns `[]`, so an empty picker usually means a misspelled code rather than a product with one variant.

### next.getPackageByVariantSelection

Resolves the one package matching a complete set of chosen variant attributes, so you can add it to the cart.

```ts
getPackageByVariantSelection(productId: number, selectedAttributes: Record<string, string>): any | null
```

```ts
const pkg = next.getPackageByVariantSelection(42, { size: 'L', color: 'red' });
if (pkg) await next.addItem({ packageId: pkg.ref_id });
```

> **Watch out:** The selection has to be complete. A partial set — size chosen, colour not — matches nothing and returns `null`; keep the add-to-cart button disabled until every attribute has a value.

### next.createVariantKey

Turns a set of chosen variant attributes into one stable string, for use as a lookup key in your own code.

```ts
createVariantKey(attributes: Record<string, string>): string
```

```ts
next.createVariantKey({ size: 'L', color: 'red' }); // 'color:red|size:L'
next.createVariantKey({ color: 'red', size: 'L' }); // 'color:red|size:L' — same
```

> **Watch out:** The key is sorted, so property order never changes it. It is an identifier for your own maps — nothing in the SDK or the API accepts it as an argument.

### next.on

Subscribes to an SDK event. Event names and their payloads are typed, so a misspelled name fails type-check.

```ts
on(event: K, handler: (data: EventMap[K]) => void): void
```

```ts
next.on('cart:item-added', ({ packageId, quantity }) => {
  console.log(`added ${quantity} × ${packageId}`);
});
```

> **Watch out:** There is no automatic teardown. On a page that swaps views, keep the handler in a variable and pass it to `next.off()` when the view goes away, or handlers accumulate and fire several times per event.

### next.off

Unsubscribes a handler that was registered with `next.on()`.

```ts
off(event: K, handler: Function): void
```

```ts
const onAdd = () => refreshBadge();
next.on('cart:item-added', onAdd);
// later
next.off('cart:item-added', onAdd);
```

> **Watch out:** Matched by function identity. An inline arrow passed to `on` can never be removed — name the handler.

### next.registerCallback

Registers a handler for a callback type, which receives whatever snapshot the caller of `next.triggerCallback()` passes it.

```ts
registerCallback(type: CallbackType, callback: (data: CallbackData) => void): void
```

```ts
next.registerCallback('cartUpdated', ({ cartTotals }) => {
  document.querySelector('#total')!.textContent = String(cartTotals.total);
});

// Nothing in the SDK fires it — your own code has to:
next.triggerCallback('cartUpdated', next.getCartData());
```

> **Watch out:** **The SDK never fires these.** `triggerCallback` has no caller anywhere in the SDK (`core/next-commerce/next-commerce.ts › NextCommerce.triggerCallback` is its only definition and nothing invokes it), so a handler registered here stays silent until your own code triggers it. It is a page-driven notification channel, not a lifecycle hook. For events the SDK really does emit, use `next.on()`.

### next.unregisterCallback

Removes a callback registered with `next.registerCallback()`.

```ts
unregisterCallback(type: CallbackType, callback: Function): void
```

```ts
const onCart = (data: unknown) => console.log(data);
next.registerCallback('cartUpdated', onCart);
next.unregisterCallback('cartUpdated', onCart);
```

> **Watch out:** Matched by function identity, same as `off`. Registering an inline function makes it permanent.

### next.triggerCallback

Fires every callback registered for a type, with a snapshot you supply. This is the only thing that fires them.

```ts
triggerCallback(type: CallbackType, data: CallbackData): void
```

```ts
next.registerCallback('cartUpdated', data => console.log(data));

// Without this line the handler above never runs.
next.triggerCallback('cartUpdated', next.getCartData());
```

> **Watch out:** It reads as an internal method and is not one in practice: **nothing in the SDK calls it**, so `registerCallback` handlers only run when your code calls this. Triggering changes no state — it only notifies handlers — so passing a stale or invented snapshot makes the page render a cart that does not exist. A handler that throws is caught and logged at error level rather than stopping the rest.

### next.trackViewItemList

Reports that a list of packages was shown — a product grid or a recommendation rail you rendered yourself.

```ts
trackViewItemList(packageIds: (string | number)[], _listId?: string, listName?: string): Promise<void>
```

```ts
next.trackViewItemList([2, 7, 9], undefined, 'Best sellers');
```

> **Watch out:** The second parameter (`_listId`) is accepted and ignored; the list name is the third. Passing the name in second position loses it silently.

### next.trackViewItem

Reports that one package was viewed in detail.

```ts
trackViewItem(packageId: string | number): Promise<void>
```

```ts
next.trackViewItem(2);
```

> **Watch out:** The package has to be in the loaded campaign. If it is not, the call logs a warning and sends nothing — so a tracked view going missing usually means the campaign had not loaded yet.

### next.trackAddToCart

Reports an add-to-cart that happened outside the SDK's own cart calls.

```ts
trackAddToCart(packageId: string | number, quantity?: number): Promise<void>
```

```ts
next.trackAddToCart(2, 3);
```

> **Watch out:** The SDK already tracks its own adds. Calling this after `next.addItem()` reports the same add twice and inflates the funnel.

### next.trackRemoveFromCart

Reports a removal that happened outside the SDK's own cart calls.

```ts
trackRemoveFromCart(packageId: string | number, quantity?: number): Promise<void>
```

```ts
next.trackRemoveFromCart(2, 1);
```

> **Watch out:** Double-counts for the same reason as `trackAddToCart` — do not pair it with `next.removeItem()`.

### next.trackBeginCheckout

Reports that the visitor started checkout, using the current cart contents.

```ts
trackBeginCheckout(): Promise<void>
```

```ts
document.querySelector('#to-checkout')!.addEventListener('click', () => {
  next.trackBeginCheckout();
});
```

> **Watch out:** The built-in checkout form fires this already. Call it only for a checkout flow you built yourself.

### next.trackPurchase

Reports a completed order, with the order payload as the event's source of truth.

```ts
trackPurchase(orderData: any): Promise<void>
```

```ts
next.trackPurchase({ ref_id: 'ORD-1042', total_incl_tax: '59.98', lines: [] });
```

> **Watch out:** The receipt page reports the purchase on its own. Calling this as well is the classic cause of doubled revenue in a analytics property — reconcile before you add it.

### next.trackCustomEvent

Sends an event of your own naming, with any payload you choose.

```ts
trackCustomEvent(eventName: string, data?: Record<string, any>): Promise<void>
```

```ts
next.trackCustomEvent('size_guide_opened', { productId: 42 });
```

> **Watch out:** Nothing validates the name or the payload, so a typo becomes a new event name in your analytics property rather than an error. Keep the names in one constant.

### next.trackSignUp

Reports a newsletter or account sign-up, identified by email address.

```ts
trackSignUp(email: string): Promise<void>
```

```ts
next.trackSignUp('shopper@example.com');
```

> **Watch out:** The address is placed in the event payload as `customer_email` **in the clear** — nothing in the SDK hashes it. It therefore reaches every configured provider, and the browser data layer, as plain text. Pass it only where your privacy policy and your provider agreements allow, and call `next.trackSignUp()` with no argument when you only need the event.

### next.trackLogin

Reports a returning visitor signing in, identified by email address.

```ts
trackLogin(email: string): Promise<void>
```

```ts
next.trackLogin('shopper@example.com');
```

> **Watch out:** Carries the address in the clear exactly as `trackSignUp` does — read that caution before passing one.

### next.setDebugMode

Turns verbose analytics logging on or off at runtime, so you can see every event as it is built and dispatched.

```ts
setDebugMode(enabled: boolean): Promise<void>
```

```ts
next.setDebugMode(true);   // watch events in the console
next.setDebugMode(false);  // quiet again
```

> **Watch out:** Affects analytics logging only — it does not enable the debug overlay, which is `?debugger=true` or `window.nextConfig.debugger`. Leave it off in production; it is noisy, not harmful.

### next.invalidateAnalyticsContext

Tells analytics the page changed, so the next event is built with fresh page context instead of the previous route's.

```ts
invalidateAnalyticsContext(): Promise<void>
```

```ts
// Single-page app: after your router settles on a new route
router.afterEach(() => next.invalidateAnalyticsContext());
```

> **Watch out:** Needed only in a single-page app, where no full page load resets the context. Forget it and every event after the first route reports the first route's URL and page type.

### next.addMetadata

Attaches one extra named value to the order's metadata.

```ts
addMetadata(key: string, value: any): void
```

```ts
next.addMetadata('quiz_result', 'sensitive-skin');
```

> **Watch out:** Merges, so it will not disturb the values the SDK collects automatically. Errors are caught and logged at error level rather than thrown — check the console if a value never reaches the order.

### next.setMetadata

Attaches several named values to the order's metadata in one call.

```ts
setMetadata(metadata: Record<string, any>): void
```

```ts
next.setMetadata({ quiz_result: 'sensitive-skin', quiz_version: '3' });
```

> **Watch out:** Despite the name it merges rather than replaces, which is deliberate: a true replace would wipe the automatic fields (`landing_page`, `referrer`, `device`). To clear your own values use `clearMetadata()`.

### next.clearMetadata

Drops the metadata you added, keeping the fields the SDK collects on its own.

```ts
clearMetadata(): void
```

```ts
next.clearMetadata();
console.log(next.getMetadata()); // automatic fields only
```

> **Watch out:** Not a full reset: `landing_page`, `referrer`, `device`, `device_type`, `domain` and `timestamp` are preserved on purpose, because the order needs them.

### next.getMetadata

The metadata that will be sent with the order, automatic fields included.

```ts
getMetadata(): Record<string, any> | undefined
```

```ts
console.log(next.getMetadata()?.landing_page);
```

> **Watch out:** `undefined` means the read failed, not that the bag is empty — an empty bag is `{}`.

### next.setAttribution

Overrides the attribution the SDK collected — the funnel, affiliate, and campaign fields recorded against the order.

```ts
setAttribution(attribution: Record<string, any>): void
```

```ts
next.setAttribution({ funnel: 'summer-quiz-v2', utm_source: 'newsletter' });
```

> **Watch out:** Overwrites what was captured from the URL. Attribution decides who gets paid for the sale, so setting it from page code is a reporting decision, not a cosmetic one — see the attribution store reference.

### next.getAttribution

The attribution exactly as it will be sent to the order API.

```ts
getAttribution(): Record<string, any> | undefined
```

```ts
console.log(next.getAttribution()?.funnel);
```

> **Watch out:** This is the API-shaped view, not the raw store — field names match the order payload, so it is the right thing to log when an order arrives attributed wrongly.

### next.debugAttribution

Prints the whole attribution state to the console, formatted for reading.

```ts
debugAttribution(): void
```

```ts
next.debugAttribution(); // then read the console
```

> **Watch out:** A console tool: it returns nothing, so there is no value to assert on in a test. Use `getAttribution()` for that.

### next.setParam

Sets one captured URL parameter for the rest of the session.

```ts
setParam(key: string, value: string): void
```

```ts
next.setParam('promo', 'spring24');
```

> **Watch out:** Does not touch the address bar. The value lives in the session store, so a reader looking for it in `location.search` will not find it.

### next.setParams

Sets several captured URL parameters at once.

```ts
setParams(params: Record<string, string>): void
```

```ts
next.setParams({ promo: 'spring24', variant: 'b' });
```

> **Watch out:** Replaces the value of each key it names and leaves the rest alone. To add without risking an overwrite, use `mergeParams`.

### next.getParam

Reads one captured URL parameter, or `null` when it was never present.

```ts
getParam(key: string): string | null
```

```ts
const variant = next.getParam('variant') ?? 'a';
```

### next.getAllParams

Every URL parameter captured for this session.

```ts
getAllParams(): Record<string, string>
```

```ts
console.log(Object.keys(next.getAllParams()));
```

### next.hasParam

Whether a parameter was captured, regardless of its value.

```ts
hasParam(key: string): boolean
```

```ts
if (next.hasParam('debug_offer')) showOfferDebugPanel();
```

> **Watch out:** True for a parameter present with an empty value (`?promo=`), which `getParam` returns as `''`. Use this when presence is the signal.

### next.clearParam

Forgets one captured URL parameter.

```ts
clearParam(key: string): void
```

```ts
next.clearParam('promo');
```

### next.clearAllParams

Forgets every captured URL parameter for this session.

```ts
clearAllParams(): void
```

```ts
next.clearAllParams();
console.log(next.getAllParams()); // {}
```

> **Watch out:** This also drops the `utm_*` values the campaign was entered with, which attribution reads. Clear individual keys unless you mean to lose the whole entry context.

### next.mergeParams

Adds parameters to the captured set without disturbing keys you did not name.

```ts
mergeParams(params: Record<string, string>): void
```

```ts
next.mergeParams({ quiz_step: '3' });
```

### next.addUpsell

Adds one or more packages to the order the visitor has already paid for, charging their saved payment method.

```ts
addUpsell(options: AddUpsellOptions): Promise<any>
```

```ts
const { order, addedLines, totalValue } = await next.addUpsell({
  items: [
    { packageId: 12, quantity: 1 },
    { packageId: 13, quantity: 2 },
  ],
});
console.log(`added ${addedLines.length} lines worth ${totalValue}`);
```

> **Watch out:** Throws — it does not resolve with an error — in four cases: no order in session, the order does not support post-purchase upsells or is mid-processing, and neither `packageId` nor `items` was given. Wrap it in `try`/`catch` and check `canAddUpsells()` first. This charges money; it is not a cart call.

### next.canAddUpsells

Whether the order in session can still take a post-purchase upsell right now.

```ts
canAddUpsells(): boolean
```

```ts
if (next.canAddUpsells()) {
  showUpsellOffer();
}
```

> **Watch out:** Also `false` while an upsell is being processed, so it is the right guard against double-submitting an offer button.

### next.getCompletedUpsells

The package ids of upsells this order has already accepted.

```ts
getCompletedUpsells(): string[]
```

```ts
console.log(next.getCompletedUpsells()); // ['12']
```

> **Watch out:** Strings, not numbers — compare with `String(packageId)`.

### next.isUpsellAlreadyAdded

Whether a package has already been accepted on this order, so a repeat offer can be skipped.

```ts
isUpsellAlreadyAdded(packageId: number): boolean
```

```ts
if (!next.isUpsellAlreadyAdded(12)) {
  showUpsellOffer(12);
}
```

> **Watch out:** Checks both the completed list and the accepted entries in the upsell journey, so it stays true across a page reload of the upsell funnel.

### next.exitIntent

Shows an image or template popup when the visitor looks like they are about to leave.

```ts
exitIntent(options: ExitIntentOptions): Promise<void>
```

```ts
await next.exitIntent({
  image: 'https://cdn.example.com/wait-10-off.png',
  maxTriggers: 1,
  useSessionStorage: true,
  disableOnMobile: true,
});
```

> **Watch out:** Loads its code on demand, so the first call is asynchronous and it rethrows if that load fails. Full options and behaviour: simple-exit-intent guide.

### next.disableExitIntent

Stops the exit-intent popup from appearing again on this page.

```ts
disableExitIntent(): void
```

```ts
next.disableExitIntent();
```

> **Watch out:** Does nothing if `exitIntent()` was never called — there is nothing to disable, and no warning either.

### next.getVersion

The SDK version running on the page — the loader-reported value if there is one, otherwise the version baked in at build.

```ts
getVersion(): string
```

```ts
console.log(next.getVersion()); // "0.4.30"
```

> **Watch out:** This is the value to trust. The `next:initialized` DOM event carries a hard-coded `version` that has not tracked releases — read it from here instead.

### next.formatPrice

Formats a number as money in the campaign's currency, so your own markup matches the SDK's.

```ts
formatPrice(amount: number, currency?: string): string
```

```ts
next.formatPrice(19.99);        // '$19.99' in a USD campaign
next.formatPrice(19.99, 'EUR'); // '€19.99'
```

> **Watch out:** Falls back to USD when the campaign has not loaded, so a price formatted too early can carry the wrong symbol. Format after `campaign:loaded`.

### next.validateCheckout

A pre-flight check before sending the visitor to checkout, returning the reasons it would fail.

```ts
validateCheckout(): { valid: boolean; errors: string[] }
```

```ts
const { valid, errors } = next.validateCheckout();
if (!valid) showErrors(errors); // e.g. ['Cart is empty']
```

> **Watch out:** Only checks that the cart is not empty today. It is not a substitute for the checkout form's own field validation, and passing it does not mean an order will succeed.
