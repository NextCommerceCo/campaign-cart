---
title: "Core/Reference/JavaScript API"
group: "Core"
category: "Core Reference"
---

# JavaScript API — `window.next`

<!-- Generated. Do not edit by hand: edit src/docs/content/next-methods.ts
     for the prose, or src/core/next-commerce.ts for what is inventoried, then run
     `UPDATE_DOCS=1 npx vitest run src/tests/docs/nextMethods.test.ts`. -->

Everything a page can ask the SDK to do from JavaScript. The SDK builds one instance of itself during boot and assigns it to `window.next`, so there is nothing to construct and nothing to import — on a page that loads the SDK from the loader script, `next` is the whole entry point.

This page is the scriptable counterpart to the `data-next-*` attributes: anything you can turn on with markup, you can also drive from code here. For the attributes themselves see the [attribute index](../../../../docs/attribute-index.md); for the shape of the objects these calls return, see the SDK reference generated from the source types.

> **Wait for boot before your first call.** `window.next` does not exist until the SDK has initialised, so a script that runs earlier will throw on `next.anything`. Push your code onto `window.nextReady` instead — it runs immediately once the SDK is up, and queues if it is not:

```ts
window.nextReady = window.nextReady || [];
window.nextReady.push(sdk => {
  console.log('SDK', sdk.getVersion(), 'ready with', sdk.getCartCount(), 'items');
});
```

Details in [the window surface](./window-surface.md).

## What you can do

13 jobs, and the calls that do them. Follow a row to its section for the signature, a runnable example, and what to watch out for.

| Job | Calls |
|---|---|
| **[Getting hold of the SDK](#getting-hold-of-the-sdk)** | [`NextCommerce.getInstance()`](#nextcommercegetinstance) |
| **[Reading the cart](#reading-the-cart)** | [`next.hasItemInCart()`](#nexthasitemincart), [`next.getCartData()`](#nextgetcartdata), [`next.getCartTotals()`](#nextgetcarttotals), [`next.getCartCount()`](#nextgetcartcount) |
| **[Changing the cart](#changing-the-cart)** | [`next.cart`](#nextcart), [`next.addItem()`](#nextadditem), [`next.removeItem()`](#nextremoveitem), [`next.updateQuantity()`](#nextupdatequantity), [`next.clearCart()`](#nextclearcart), [`next.swapCart()`](#nextswapcart) |
| **[Coupons](#coupons)** | [`next.applyCoupon()`](#nextapplycoupon), [`next.removeCoupon()`](#nextremovecoupon), [`next.getCoupons()`](#nextgetcoupons) |
| **[Shipping](#shipping)** | [`next.getShippingMethods()`](#nextgetshippingmethods), [`next.getSelectedShippingMethod()`](#nextgetselectedshippingmethod), [`next.setShippingMethod()`](#nextsetshippingmethod) |
| **[Products, packages, and variants](#products-packages-and-variants)** | [`next.getCampaignData()`](#nextgetcampaigndata), [`next.getPackage()`](#nextgetpackage), [`next.getVariantsByProductId()`](#nextgetvariantsbyproductid), [`next.getAvailableVariantAttributes()`](#nextgetavailablevariantattributes), [`next.getPackageByVariantSelection()`](#nextgetpackagebyvariantselection), [`next.createVariantKey()`](#nextcreatevariantkey) |
| **[Reacting to what happens](#reacting-to-what-happens)** | [`next.on()`](#nexton), [`next.off()`](#nextoff), [`next.registerCallback()`](#nextregistercallback), [`next.unregisterCallback()`](#nextunregistercallback), [`next.triggerCallback()`](#nexttriggercallback) |
| **[Sending analytics events yourself](#sending-analytics-events-yourself)** | [`next.trackViewItemList()`](#nexttrackviewitemlist), [`next.trackViewItem()`](#nexttrackviewitem), [`next.trackAddToCart()`](#nexttrackaddtocart), [`next.trackRemoveFromCart()`](#nexttrackremovefromcart), [`next.trackBeginCheckout()`](#nexttrackbegincheckout), [`next.trackPurchase()`](#nexttrackpurchase), [`next.trackCustomEvent()`](#nexttrackcustomevent), [`next.trackSignUp()`](#nexttracksignup), [`next.trackLogin()`](#nexttracklogin), [`next.setDebugMode()`](#nextsetdebugmode), [`next.invalidateAnalyticsContext()`](#nextinvalidateanalyticscontext) |
| **[Attribution and order metadata](#attribution-and-order-metadata)** | [`next.addMetadata()`](#nextaddmetadata), [`next.setMetadata()`](#nextsetmetadata), [`next.clearMetadata()`](#nextclearmetadata), [`next.getMetadata()`](#nextgetmetadata), [`next.setAttribution()`](#nextsetattribution), [`next.getAttribution()`](#nextgetattribution), [`next.debugAttribution()`](#nextdebugattribution) |
| **[URL parameters](#url-parameters)** | [`next.setParam()`](#nextsetparam), [`next.setParams()`](#nextsetparams), [`next.getParam()`](#nextgetparam), [`next.getAllParams()`](#nextgetallparams), [`next.hasParam()`](#nexthasparam), [`next.clearParam()`](#nextclearparam), [`next.clearAllParams()`](#nextclearallparams), [`next.mergeParams()`](#nextmergeparams) |
| **[Post-purchase upsells](#post-purchase-upsells)** | [`next.addUpsell()`](#nextaddupsell), [`next.canAddUpsells()`](#nextcanaddupsells), [`next.getCompletedUpsells()`](#nextgetcompletedupsells), [`next.isUpsellAlreadyAdded()`](#nextisupsellalreadyadded) |
| **[On-page popups](#on-page-popups)** | [`next.exitIntent()`](#nextexitintent), [`next.disableExitIntent()`](#nextdisableexitintent), [`next.fomo()`](#nextfomo), [`next.stopFomo()`](#nextstopfomo) |
| **[Formatting, version, and checks](#formatting-version-and-checks)** | [`next.getVersion()`](#nextgetversion), [`next.formatPrice()`](#nextformatprice), [`next.validateCheckout()`](#nextvalidatecheckout) |

## Getting hold of the SDK

The SDK creates one instance of itself during boot and assigns it to `window.next`. You do not construct it. Because boot is asynchronous, code that runs early has to wait — that is what `window.nextReady` is for (see the [window surface](./window-surface.md)).

### `NextCommerce.getInstance()`

```ts
getInstance(): NextCommerce
```

Returns the one shared SDK instance, creating it if boot has not reached that point yet.

```ts
import { NextCommerce } from '@next-commerce/campaign-cart';

const sdk = NextCommerce.getInstance();
console.log(sdk === window.next); // true
```

> ⚠️ Reached off the class, not off `next` — `next.getInstance()` also works but reads as though it made a second SDK. On a page that loads the SDK from the loader script, prefer `window.next`; there is nothing to import.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getInstance`</sub>

## Reading the cart

Snapshots of the cart as it stands right now. None of these change anything, and none of them wait for anything — if you call them before the campaign has loaded you get an empty cart, not an error. Subscribe to `cart:updated` instead of polling.

### `next.hasItemInCart()`

```ts
hasItemInCart(options: { packageId?: number }): boolean
```

Whether a given package is currently in the cart, at any quantity.

```ts
if (next.hasItemInCart({ packageId: 2 })) {
  document.querySelector('#upsell-banner')?.remove();
}
```

> ⚠️ Called with no `packageId` it returns `false` rather than "is the cart non-empty" — use `next.getCartCount() > 0` for that.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.hasItemInCart`</sub>

### `next.getCartData()`

```ts
getCartData(): CallbackData
```

One snapshot carrying everything about the cart: priced line items, totals, the loaded campaign, and applied coupon codes.

```ts
const { cartLines, cartTotals, vouchers } = next.getCartData();
console.log(`${cartLines.length} lines, ${cartTotals.total} total`);
console.log('coupons:', vouchers);
```

> ⚠️ This is the same shape your `registerCallback` handlers receive, so it is the one to reach for when you are reproducing a callback outside its trigger. The amounts inside `cartTotals` are `Decimal` objects — see [`next.getCartTotals()`](#nextgetcarttotals).

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getCartData`</sub>

### `next.getCartTotals()`

```ts
getCartTotals()
```

The money only: subtotal, total, discount amount and percentage, and the chosen shipping method.

**Returns:** An object with `subtotal`, `total`, `totalDiscount` and `totalDiscountPercentage` as **`Decimal`** values (decimal.js instances, not plain numbers), plus a boolean `hasDiscounts` and `shippingMethod`, which is `undefined` until the visitor has chosen one.

```ts
const { subtotal, total, hasDiscounts } = next.getCartTotals();
if (hasDiscounts) {
  // Decimal arithmetic, then convert once at the end.
  console.log('saving', subtotal.minus(total).toFixed(2));
}
next.formatPrice(total.toNumber()); // '$59.98'
```

> ⚠️ The amounts are `Decimal` objects, so `subtotal - total` is `NaN` and `total > 50` is a string comparison. Use `.minus()`, `.gt()` and friends, and call `.toNumber()` only when handing the value to something that wants a number — `formatPrice` is one.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getCartTotals`</sub>

### `next.getCartCount()`

```ts
getCartCount(): number
```

How many units are in the cart in total — quantities summed, not the number of lines.

```ts
document.querySelector('#cart-badge')!.textContent =
  String(next.getCartCount());
```

> ⚠️ Two of one package and one of another is `3`, not `2`. For the number of rows use `next.getCartData().cartLines.length`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getCartCount`</sub>

## Changing the cart

Every one of these recalculates totals and emits a cart event when it settles. `next.cart` is the fuller API — the shortcuts below it cover the common cases with less to type.

### `next.cart`

```ts
cart
```

The full programmatic cart API — the supported way to drive the cart from code.

**Returns:** The cart operations object. Its members are listed under [What `next.cart` can do](#what-nextcart-can-do) below.

```ts
await next.cart.addItem({ packageId: 2, quantity: 1, isUpsell: false });
await next.cart.updateQuantity(2, 3);
await next.cart.swapPackage(2, { packageId: 7, quantity: 1, isUpsell: false });
```

> ⚠️ Do not write to the cart store directly. The operations here carry the pricing, validation and event-emission logic; a raw `useCartStore.setState()` skips all three and leaves totals and analytics disagreeing with the visible cart.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.cart`</sub>

### `next.addItem()`

```ts
addItem(options: { packageId?: number; quantity?: number; }): Promise<void>
```

Adds a package to the cart, defaulting to one unit, merging with an existing line for the same package.

```ts
await next.addItem({ packageId: 2 });          // one unit
await next.addItem({ packageId: 7, quantity: 3 }); // three units
```

> ⚠️ Omitting `packageId` does nothing at all — no throw, no log at warn level. If an add silently fails, check that the id actually reached the call. For upsell adds use `next.cart.addItem({ …, isUpsell: true })`, which is what marks the line for revenue reporting.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.addItem`</sub>

### `next.removeItem()`

```ts
removeItem(options: { packageId?: number }): Promise<void>
```

Removes a package from the cart completely, whatever its quantity.

```ts
await next.removeItem({ packageId: 2 });
```

> ⚠️ A `packageId` that is not in the cart is not an error; nothing happens.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.removeItem`</sub>

### `next.updateQuantity()`

```ts
updateQuantity(options: { packageId?: number; quantity: number; }): Promise<void>
```

Sets a package to an exact quantity, rather than adding to what is already there.

```ts
await next.updateQuantity({ packageId: 2, quantity: 3 }); // now exactly 3
await next.updateQuantity({ packageId: 2, quantity: 0 }); // removes the line
```

> ⚠️ Quantity `0` removes the line. If you meant "leave it alone", do not call this — there is no no-op quantity.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.updateQuantity`</sub>

### `next.clearCart()`

```ts
clearCart(): Promise<void>
```

Empties the cart.

```ts
await next.clearCart();
console.log(next.getCartCount()); // 0
```

> ⚠️ Declared `async` but the underlying clear is synchronous, so awaiting it buys you nothing beyond a tidy call site.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.clearCart`</sub>

### `next.swapCart()`

```ts
swapCart(items: Array<{ packageId: number; quantity: number }>): Promise<void>
```

Replaces the whole cart with the list you pass, in one step — anything already in the cart and not in the list is removed.

```ts
// The visitor picked the 3-pack bundle: it replaces whatever they had.
await next.swapCart([
  { packageId: 7, quantity: 1 },
  { packageId: 9, quantity: 2 },
]);
```

> ⚠️ This is a replace, not a merge. Passing `[]` empties the cart. It is what bundle and swap-mode selectors use, which is also why pairing a swap-mode `package-selector` with `add-to-cart` on the same selector double-writes the cart — pick one.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.swapCart`</sub>

## Coupons

Discount codes applied to the whole cart. Applying one is validated against the campaign, so it can fail for a reason worth showing the visitor.

### `next.applyCoupon()`

```ts
applyCoupon(code: string): Promise<{ success: boolean; message: string }>
```

Validates a discount code against the campaign and applies it to the cart if it holds.

```ts
const { success, message } = await next.applyCoupon('SAVE10');
if (!success) {
  showError(message); // e.g. "Coupon already applied"
}
```

> ⚠️ It resolves with `success: false` instead of throwing, so a bare `await` looks like it worked. Always read `success`, and show `message` — it is written for the visitor.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.applyCoupon`</sub>

### `next.removeCoupon()`

```ts
removeCoupon(code: string): void
```

Takes a previously applied discount code off the cart and recalculates totals.

```ts
next.removeCoupon('SAVE10');
```

> ⚠️ Returns `void` even though the work behind it is asynchronous, so there is nothing to await. To act once the totals have settled, listen for `cart:updated`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.removeCoupon`</sub>

### `next.getCoupons()`

```ts
getCoupons(): string[]
```

The discount codes currently applied to the cart.

```ts
for (const code of next.getCoupons()) {
  renderCouponChip(code);
}
```

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getCoupons`</sub>

## Shipping

The shipping methods the campaign offers, and which one the visitor has chosen. Choosing one changes the cart total, so it belongs to the cart, not to the form.

### `next.getShippingMethods()`

```ts
getShippingMethods(): ShippingMethodInfo[]
```

Every shipping method the loaded campaign offers, with its id, code, and price.

```ts
for (const method of next.getShippingMethods()) {
  addOption(method.ref_id, `${method.code} — ${method.price}`);
}
```

> ⚠️ Empty before the campaign has loaded, which is indistinguishable from "this campaign has no shipping methods". Populate your selector on `campaign:loaded`, not on `DOMContentLoaded`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getShippingMethods`</sub>

### `next.getSelectedShippingMethod()`

```ts
getSelectedShippingMethod(): SelectedShippingMethod | null
```

The shipping method the visitor has chosen, or `null` when they have not chosen one yet.

```ts
const method = next.getSelectedShippingMethod();
console.log(method ? method.name : 'not chosen yet');
```

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getSelectedShippingMethod`</sub>

### `next.setShippingMethod()`

```ts
setShippingMethod(methodId: number): Promise<void>
```

Chooses a shipping method by id and recalculates the cart total with its price.

```ts
await next.setShippingMethod(1);
console.log(next.getCartTotals().total); // now includes shipping
```

> ⚠️ Throws when the id is not one of the campaign's methods, so pass a `ref_id` from `getShippingMethods()` rather than a hard-coded number that was valid in a different campaign.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.setShippingMethod`</sub>

## Products, packages, and variants

Read-only lookups into the loaded campaign. A *package* is the sellable unit — a quantity of a product at a price — and its `ref_id` is the number every cart call takes. The variant lookups exist so you can build your own size/colour picker instead of using the built-in one.

### `next.getCampaignData()`

```ts
getCampaignData(): Campaign | null
```

The loaded campaign — its packages, currency, and shipping methods — or `null` if it has not arrived yet.

```ts
const campaign = next.getCampaignData();
if (campaign) {
  console.log(campaign.name, campaign.currency, campaign.packages.length);
}
```

> ⚠️ `null` means "still loading", not "no campaign". Guard on it, or subscribe to `campaign:loaded` and read it there.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getCampaignData`</sub>

### `next.getPackage()`

```ts
getPackage(id: number): any | null
```

Looks up one package by its `ref_id` — the number every cart call and every `data-next-package-id` uses.

```ts
const pkg = next.getPackage(2);
console.log(pkg?.name, pkg?.price);
```

> ⚠️ Returns `null` both for an unknown id and for "campaign not loaded yet". Check `getCampaignData()` first when you need to tell those apart.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getPackage`</sub>

### `next.getVariantsByProductId()`

```ts
getVariantsByProductId(productId: number): any | null
```

Every package that is a variant of one product — each size, colour, or flavour of it.

```ts
const variants = next.getVariantsByProductId(42);
console.log(variants?.map((v: { ref_id: number }) => v.ref_id));
```

> ⚠️ Grouped by product id, which is not the package `ref_id`. A product with no variants returns `null`, not an empty list.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getVariantsByProductId`</sub>

### `next.getAvailableVariantAttributes()`

```ts
getAvailableVariantAttributes(productId: number, attributeCode: string): string[]
```

The distinct values one variant attribute takes for a product — every size it comes in, say — for building a picker.

```ts
const sizes = next.getAvailableVariantAttributes(42, 'size');
// ['S', 'M', 'L']
```

> ⚠️ The attribute code is the campaign's own string (`size`, `color`), not a display label. An unknown code returns `[]`, so an empty picker usually means a misspelled code rather than a product with one variant.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getAvailableVariantAttributes`</sub>

### `next.getPackageByVariantSelection()`

```ts
getPackageByVariantSelection(productId: number, selectedAttributes: Record<string, string>): any | null
```

Resolves the one package matching a complete set of chosen variant attributes, so you can add it to the cart.

```ts
const pkg = next.getPackageByVariantSelection(42, { size: 'L', color: 'red' });
if (pkg) await next.addItem({ packageId: pkg.ref_id });
```

> ⚠️ The selection has to be complete. A partial set — size chosen, colour not — matches nothing and returns `null`; keep the add-to-cart button disabled until every attribute has a value.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getPackageByVariantSelection`</sub>

### `next.createVariantKey()`

```ts
createVariantKey(attributes: Record<string, string>): string
```

Turns a set of chosen variant attributes into one stable string, for use as a lookup key in your own code.

```ts
next.createVariantKey({ size: 'L', color: 'red' }); // 'color:red|size:L'
next.createVariantKey({ color: 'red', size: 'L' }); // 'color:red|size:L' — same
```

> ⚠️ The key is sorted, so property order never changes it. It is an identifier for your own maps — nothing in the SDK or the API accepts it as an argument.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.createVariantKey`</sub>

## Reacting to what happens

Two mechanisms, and they are not interchangeable. `on`/`off` subscribe to the typed SDK event bus and are what you want. `registerCallback` is the older lifecycle-hook channel, kept for pages that already use it.

### `next.on()`

```ts
on(event: K, handler: (data: EventMap[K]) => void): void
```

Subscribes to an SDK event. Event names and their payloads are typed, so a misspelled name fails type-check.

```ts
next.on('cart:item-added', ({ packageId, quantity }) => {
  console.log(`added ${quantity} × ${packageId}`);
});
```

> ⚠️ There is no automatic teardown. On a page that swaps views, keep the handler in a variable and pass it to `next.off()` when the view goes away, or handlers accumulate and fire several times per event.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.on`</sub>

### `next.off()`

```ts
off(event: K, handler: Function): void
```

Unsubscribes a handler that was registered with `next.on()`.

```ts
const onAdd = () => refreshBadge();
next.on('cart:item-added', onAdd);
// later
next.off('cart:item-added', onAdd);
```

> ⚠️ Matched by function identity. An inline arrow passed to `on` can never be removed — name the handler.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.off`</sub>

### `next.registerCallback()`

```ts
registerCallback(type: CallbackType, callback: (data: CallbackData) => void): void
```

Registers a handler for a callback type, which receives whatever snapshot the caller of `next.triggerCallback()` passes it.

```ts
next.registerCallback('cartUpdated', ({ cartTotals }) => {
  document.querySelector('#total')!.textContent = String(cartTotals.total);
});

// Nothing in the SDK fires it — your own code has to:
next.triggerCallback('cartUpdated', next.getCartData());
```

> ⚠️ **The SDK never fires these.** `triggerCallback` has no caller anywhere in the SDK (`core/next-commerce.ts › NextCommerce.triggerCallback` is its only definition and nothing invokes it), so a handler registered here stays silent until your own code triggers it. It is a page-driven notification channel, not a lifecycle hook. For events the SDK really does emit, use `next.on()`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.registerCallback`</sub>

### `next.unregisterCallback()`

```ts
unregisterCallback(type: CallbackType, callback: Function): void
```

Removes a callback registered with `next.registerCallback()`.

```ts
const onCart = (data: unknown) => console.log(data);
next.registerCallback('cartUpdated', onCart);
next.unregisterCallback('cartUpdated', onCart);
```

> ⚠️ Matched by function identity, same as `off`. Registering an inline function makes it permanent.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.unregisterCallback`</sub>

### `next.triggerCallback()`

```ts
triggerCallback(type: CallbackType, data: CallbackData): void
```

Fires every callback registered for a type, with a snapshot you supply. This is the only thing that fires them.

```ts
next.registerCallback('cartUpdated', data => console.log(data));

// Without this line the handler above never runs.
next.triggerCallback('cartUpdated', next.getCartData());
```

> ⚠️ It reads as an internal method and is not one in practice: **nothing in the SDK calls it**, so `registerCallback` handlers only run when your code calls this. Triggering changes no state — it only notifies handlers — so passing a stale or invented snapshot makes the page render a cart that does not exist. A handler that throws is caught and logged at error level rather than stopping the rest.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.triggerCallback`</sub>

## Sending analytics events yourself

The SDK already tracks the standard ecommerce funnel on its own. Call these only for something it cannot see — a custom step, a view of a list you rendered yourself, a sign-up outside the checkout form. Every one of them is fire-and-forget: it queues the work and resolves immediately, and a failure is logged rather than thrown, so analytics can never break a page.

### `next.trackViewItemList()`

```ts
trackViewItemList(packageIds: (string | number)[], _listId?: string, listName?: string): Promise<void>
```

Reports that a list of packages was shown — a product grid or a recommendation rail you rendered yourself.

```ts
next.trackViewItemList([2, 7, 9], undefined, 'Best sellers');
```

> ⚠️ The second parameter (`_listId`) is accepted and ignored; the list name is the third. Passing the name in second position loses it silently.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.trackViewItemList`</sub>

### `next.trackViewItem()`

```ts
trackViewItem(packageId: string | number): Promise<void>
```

Reports that one package was viewed in detail.

```ts
next.trackViewItem(2);
```

> ⚠️ The package has to be in the loaded campaign. If it is not, the call logs a warning and sends nothing — so a tracked view going missing usually means the campaign had not loaded yet.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.trackViewItem`</sub>

### `next.trackAddToCart()`

```ts
trackAddToCart(packageId: string | number, quantity?: number): Promise<void>
```

Reports an add-to-cart that happened outside the SDK's own cart calls.

```ts
next.trackAddToCart(2, 3);
```

> ⚠️ The SDK already tracks its own adds. Calling this after `next.addItem()` reports the same add twice and inflates the funnel.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.trackAddToCart`</sub>

### `next.trackRemoveFromCart()`

```ts
trackRemoveFromCart(packageId: string | number, quantity?: number): Promise<void>
```

Reports a removal that happened outside the SDK's own cart calls.

```ts
next.trackRemoveFromCart(2, 1);
```

> ⚠️ Double-counts for the same reason as `trackAddToCart` — do not pair it with `next.removeItem()`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.trackRemoveFromCart`</sub>

### `next.trackBeginCheckout()`

```ts
trackBeginCheckout(): Promise<void>
```

Reports that the visitor started checkout, using the current cart contents.

```ts
document.querySelector('#to-checkout')!.addEventListener('click', () => {
  next.trackBeginCheckout();
});
```

> ⚠️ The built-in checkout form fires this already. Call it only for a checkout flow you built yourself.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.trackBeginCheckout`</sub>

### `next.trackPurchase()`

```ts
trackPurchase(orderData: any): Promise<void>
```

Reports a completed order, with the order payload as the event's source of truth.

```ts
next.trackPurchase({ ref_id: 'ORD-1042', total_incl_tax: '59.98', lines: [] });
```

> ⚠️ The receipt page reports the purchase on its own. Calling this as well is the classic cause of doubled revenue in a analytics property — reconcile before you add it.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.trackPurchase`</sub>

### `next.trackCustomEvent()`

```ts
trackCustomEvent(eventName: string, data?: Record<string, any>): Promise<void>
```

Sends an event of your own naming, with any payload you choose.

```ts
next.trackCustomEvent('size_guide_opened', { productId: 42 });
```

> ⚠️ Nothing validates the name or the payload, so a typo becomes a new event name in your analytics property rather than an error. Keep the names in one constant.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.trackCustomEvent`</sub>

### `next.trackSignUp()`

```ts
trackSignUp(email: string): Promise<void>
```

Reports a newsletter or account sign-up, identified by email address.

```ts
next.trackSignUp('shopper@example.com');
```

> ⚠️ The address is placed in the event payload as `customer_email` **in the clear** — nothing in the SDK hashes it. It therefore reaches every configured provider, and the browser data layer, as plain text. Pass it only where your privacy policy and your provider agreements allow, and call `next.trackSignUp()` with no argument when you only need the event.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.trackSignUp`</sub>

### `next.trackLogin()`

```ts
trackLogin(email: string): Promise<void>
```

Reports a returning visitor signing in, identified by email address.

```ts
next.trackLogin('shopper@example.com');
```

> ⚠️ Carries the address in the clear exactly as `trackSignUp` does — read that caution before passing one.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.trackLogin`</sub>

### `next.setDebugMode()`

```ts
setDebugMode(enabled: boolean): Promise<void>
```

Turns verbose analytics logging on or off at runtime, so you can see every event as it is built and dispatched.

```ts
next.setDebugMode(true);   // watch events in the console
next.setDebugMode(false);  // quiet again
```

> ⚠️ Affects analytics logging only — it does not enable the debug overlay, which is `?debugger=true` or `window.nextConfig.debugger`. Leave it off in production; it is noisy, not harmful.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.setDebugMode`</sub>

### `next.invalidateAnalyticsContext()`

```ts
invalidateAnalyticsContext(): Promise<void>
```

Tells analytics the page changed, so the next event is built with fresh page context instead of the previous route's.

```ts
// Single-page app: after your router settles on a new route
router.afterEach(() => next.invalidateAnalyticsContext());
```

> ⚠️ Needed only in a single-page app, where no full page load resets the context. Forget it and every event after the first route reports the first route's URL and page type.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.invalidateAnalyticsContext`</sub>

## Attribution and order metadata

Attribution is the record of where the visitor came from; metadata is the free-form bag of extra values attached to the order. Both are collected automatically and sent with the order — these calls are for adding your own values on top.

### `next.addMetadata()`

```ts
addMetadata(key: string, value: any): void
```

Attaches one extra named value to the order's metadata.

```ts
next.addMetadata('quiz_result', 'sensitive-skin');
```

> ⚠️ Merges, so it will not disturb the values the SDK collects automatically. Errors are caught and logged at error level rather than thrown — check the console if a value never reaches the order.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.addMetadata`</sub>

### `next.setMetadata()`

```ts
setMetadata(metadata: Record<string, any>): void
```

Attaches several named values to the order's metadata in one call.

```ts
next.setMetadata({ quiz_result: 'sensitive-skin', quiz_version: '3' });
```

> ⚠️ Despite the name it merges rather than replaces, which is deliberate: a true replace would wipe the automatic fields (`landing_page`, `referrer`, `device`). To clear your own values use `clearMetadata()`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.setMetadata`</sub>

### `next.clearMetadata()`

```ts
clearMetadata(): void
```

Drops the metadata you added, keeping the fields the SDK collects on its own.

```ts
next.clearMetadata();
console.log(next.getMetadata()); // automatic fields only
```

> ⚠️ Not a full reset: `landing_page`, `referrer`, `device`, `device_type`, `domain` and `timestamp` are preserved on purpose, because the order needs them.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.clearMetadata`</sub>

### `next.getMetadata()`

```ts
getMetadata(): Record<string, any> | undefined
```

The metadata that will be sent with the order, automatic fields included.

```ts
console.log(next.getMetadata()?.landing_page);
```

> ⚠️ `undefined` means the read failed, not that the bag is empty — an empty bag is `{}`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getMetadata`</sub>

### `next.setAttribution()`

```ts
setAttribution(attribution: Record<string, any>): void
```

Overrides the attribution the SDK collected — the funnel, affiliate, and campaign fields recorded against the order.

```ts
next.setAttribution({ funnel: 'summer-quiz-v2', utm_source: 'newsletter' });
```

> ⚠️ Overwrites what was captured from the URL. Attribution decides who gets paid for the sale, so setting it from page code is a reporting decision, not a cosmetic one — see the [attribution store reference](../../../state/attribution/guide/reference/state-reference.md).

<sub>Source: `src/core/next-commerce.ts › NextCommerce.setAttribution`</sub>

### `next.getAttribution()`

```ts
getAttribution(): Record<string, any> | undefined
```

The attribution exactly as it will be sent to the order API.

```ts
console.log(next.getAttribution()?.funnel);
```

> ⚠️ This is the API-shaped view, not the raw store — field names match the order payload, so it is the right thing to log when an order arrives attributed wrongly.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getAttribution`</sub>

### `next.debugAttribution()`

```ts
debugAttribution(): void
```

Prints the whole attribution state to the console, formatted for reading.

```ts
next.debugAttribution(); // then read the console
```

> ⚠️ A console tool: it returns nothing, so there is no value to assert on in a test. Use `getAttribution()` for that.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.debugAttribution`</sub>

## URL parameters

The SDK captures every URL parameter on the first page view and keeps them for the whole session, so a value from the ad click is still available three pages later. These read and edit that captured set; they do not rewrite the address bar.

### `next.setParam()`

```ts
setParam(key: string, value: string): void
```

Sets one captured URL parameter for the rest of the session.

```ts
next.setParam('promo', 'spring24');
```

> ⚠️ Does not touch the address bar. The value lives in the session store, so a reader looking for it in `location.search` will not find it.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.setParam`</sub>

### `next.setParams()`

```ts
setParams(params: Record<string, string>): void
```

Sets several captured URL parameters at once.

```ts
next.setParams({ promo: 'spring24', variant: 'b' });
```

> ⚠️ Replaces the value of each key it names and leaves the rest alone. To add without risking an overwrite, use `mergeParams`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.setParams`</sub>

### `next.getParam()`

```ts
getParam(key: string): string | null
```

Reads one captured URL parameter, or `null` when it was never present.

```ts
const variant = next.getParam('variant') ?? 'a';
```

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getParam`</sub>

### `next.getAllParams()`

```ts
getAllParams(): Record<string, string>
```

Every URL parameter captured for this session.

```ts
console.log(Object.keys(next.getAllParams()));
```

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getAllParams`</sub>

### `next.hasParam()`

```ts
hasParam(key: string): boolean
```

Whether a parameter was captured, regardless of its value.

```ts
if (next.hasParam('debug_offer')) showOfferDebugPanel();
```

> ⚠️ True for a parameter present with an empty value (`?promo=`), which `getParam` returns as `''`. Use this when presence is the signal.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.hasParam`</sub>

### `next.clearParam()`

```ts
clearParam(key: string): void
```

Forgets one captured URL parameter.

```ts
next.clearParam('promo');
```

<sub>Source: `src/core/next-commerce.ts › NextCommerce.clearParam`</sub>

### `next.clearAllParams()`

```ts
clearAllParams(): void
```

Forgets every captured URL parameter for this session.

```ts
next.clearAllParams();
console.log(next.getAllParams()); // {}
```

> ⚠️ This also drops the `utm_*` values the campaign was entered with, which attribution reads. Clear individual keys unless you mean to lose the whole entry context.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.clearAllParams`</sub>

### `next.mergeParams()`

```ts
mergeParams(params: Record<string, string>): void
```

Adds parameters to the captured set without disturbing keys you did not name.

```ts
next.mergeParams({ quiz_step: '3' });
```

<sub>Source: `src/core/next-commerce.ts › NextCommerce.mergeParams`</sub>

## Post-purchase upsells

Offers added to an order that has already been paid for. They only work on a page reached after checkout, while the order is still in session — see the caution on `addUpsell`.

### `next.addUpsell()`

```ts
addUpsell(options: AddUpsellOptions): Promise<any>
```

Adds one or more packages to the order the visitor has already paid for, charging their saved payment method.

```ts
const { order, addedLines, totalValue } = await next.addUpsell({
  items: [
    { packageId: 12, quantity: 1 },
    { packageId: 13, quantity: 2 },
  ],
});
console.log(`added ${addedLines.length} lines worth ${totalValue}`);
```

> ⚠️ Throws — it does not resolve with an error — in four cases: no order in session, the order does not support post-purchase upsells or is mid-processing, and neither `packageId` nor `items` was given. Wrap it in `try`/`catch` and check `canAddUpsells()` first. This charges money; it is not a cart call.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.addUpsell`</sub>

### `next.canAddUpsells()`

```ts
canAddUpsells(): boolean
```

Whether the order in session can still take a post-purchase upsell right now.

```ts
if (next.canAddUpsells()) {
  showUpsellOffer();
}
```

> ⚠️ Also `false` while an upsell is being processed, so it is the right guard against double-submitting an offer button.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.canAddUpsells`</sub>

### `next.getCompletedUpsells()`

```ts
getCompletedUpsells(): string[]
```

The package ids of upsells this order has already accepted.

```ts
console.log(next.getCompletedUpsells()); // ['12']
```

> ⚠️ Strings, not numbers — compare with `String(packageId)`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getCompletedUpsells`</sub>

### `next.isUpsellAlreadyAdded()`

```ts
isUpsellAlreadyAdded(packageId: number): boolean
```

Whether a package has already been accepted on this order, so a repeat offer can be skipped.

```ts
if (!next.isUpsellAlreadyAdded(12)) {
  showUpsellOffer(12);
}
```

> ⚠️ Checks both the completed list and the accepted entries in the upsell journey, so it stays true across a page reload of the upsell funnel.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.isUpsellAlreadyAdded`</sub>

## On-page popups

Two behaviours with no `data-next-*` attribute of their own: you turn them on by calling them. Each has a full guide of its own, linked from its row.

### `next.exitIntent()`

```ts
exitIntent(options: ExitIntentOptions): Promise<void>
```

Shows an image or template popup when the visitor looks like they are about to leave.

```ts
await next.exitIntent({
  image: 'https://cdn.example.com/wait-10-off.png',
  maxTriggers: 1,
  useSessionStorage: true,
  disableOnMobile: true,
});
```

> ⚠️ Loads its code on demand, so the first call is asynchronous and it rethrows if that load fails. Full options and behaviour: [simple-exit-intent guide](../../../features/behavior/simple-exit-intent/guide/overview.md).

<sub>Source: `src/core/next-commerce.ts › NextCommerce.exitIntent`</sub>

### `next.disableExitIntent()`

```ts
disableExitIntent(): void
```

Stops the exit-intent popup from appearing again on this page.

```ts
next.disableExitIntent();
```

> ⚠️ Does nothing if `exitIntent()` was never called — there is nothing to disable, and no warning either.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.disableExitIntent`</sub>

### `next.fomo()`

```ts
fomo(config?: FomoConfig): Promise<void>
```

Starts the rotating social-proof popup — "someone in Denver bought this a moment ago" — from a list you supply.

```ts
await next.fomo({
  items: [
    { text: 'bought the 3-pack', image: 'https://cdn.example.com/p3.png' },
  ],
  customers: { 'United States': ['Ava from Denver', 'Noah from Austin'] },
  displayDuration: 5000,
  delayBetween: 12000,
});
```

> ⚠️ Called with no argument it starts with its built-in defaults rather than doing nothing. Full options: [fomo-popup guide](../../../features/behavior/fomo-popup/guide/overview.md).

<sub>Source: `src/core/next-commerce.ts › NextCommerce.fomo`</sub>

### `next.stopFomo()`

```ts
stopFomo(): void
```

Stops the social-proof popup rotation.

```ts
next.stopFomo();
```

> ⚠️ A no-op when `fomo()` was never called.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.stopFomo`</sub>

## Formatting, version, and checks

Small helpers that do not belong to any one part of the flow.

### `next.getVersion()`

```ts
getVersion(): string
```

The SDK version running on the page — the loader-reported value if there is one, otherwise the version baked in at build.

```ts
console.log(next.getVersion()); // "0.4.30"
```

> ⚠️ This is the value to trust. The `next:initialized` DOM event carries a hard-coded `version` that has not tracked releases — read it from here instead.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.getVersion`</sub>

### `next.formatPrice()`

```ts
formatPrice(amount: number, currency?: string): string
```

Formats a number as money in the campaign's currency, so your own markup matches the SDK's.

```ts
next.formatPrice(19.99);        // '$19.99' in a USD campaign
next.formatPrice(19.99, 'EUR'); // '€19.99'
```

> ⚠️ Falls back to USD when the campaign has not loaded, so a price formatted too early can carry the wrong symbol. Format after `campaign:loaded`.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.formatPrice`</sub>

### `next.validateCheckout()`

```ts
validateCheckout(): { valid: boolean; errors: string[] }
```

A pre-flight check before sending the visitor to checkout, returning the reasons it would fail.

```ts
const { valid, errors } = next.validateCheckout();
if (!valid) showErrors(errors); // e.g. ['Cart is empty']
```

> ⚠️ Only checks that the cart is not empty today. It is not a substitute for the checkout form's own field validation, and passing it does not mean an order will succeed.

<sub>Source: `src/core/next-commerce.ts › NextCommerce.validateCheckout`</sub>

## What `next.cart` can do

The object [`next.cart`](#nextcart) returns. `swapPackage`, `calculateTotals` and `refreshItemPrices` have no shortcut on `next` itself, so this is their only route.

| Call | Effect |
|---|---|
| `addItem(item: Partial<CartItem> & { isUpsell: boolean \| undefined }): Promise<void>` | Adds a package, merging with an existing line for the same package. `isUpsell` is required and decides whether the line counts as post-purchase revenue. |
| `removeItem(packageId: number): Promise<void>` | Removes a package entirely, whatever its quantity. |
| `updateQuantity(packageId: number, quantity: number): Promise<void>` | Sets an exact quantity. `0` removes the line. |
| `swapPackage(removePackageId: number, addItem: Partial<CartItem> & { isUpsell: boolean \| undefined }): Promise<void>` | Removes one package and adds another in the same step, so the cart is never briefly empty. What a variant or upgrade switch should use. |
| `swapCart(items: Array<{ packageId: number; quantity: number; properties?: Record<string, string>; }>): Promise<void>` | Replaces the entire contents with the list given. Unlike `next.swapCart`, this form also accepts per-line `properties`. |
| `clear(): void` | Empties the cart. Synchronous. |
| `calculateTotals(): void` | Recalculates totals from the current lines. Called for you by every operation above; you need it only after changing the store by hand, which you should not be doing. |
| `refreshItemPrices(): Promise<void>` | Re-reads every line's price from the loaded campaign. For when the campaign reloaded under a different currency and the cart still holds the old prices. |
| `setShippingMethod(methodId: number): Promise<void>` | Chooses a shipping method by id, validates it against the campaign, and recalculates the total. |
| `applyCoupon(code: string): Promise<{ success: boolean; message: string }>` | Validates and applies a discount code. Resolves with `{ success, message }` rather than throwing. |
| `removeCoupon(code: string): Promise<void>` | Removes an applied discount code and recalculates. |

These carry the pricing, validation and event logic. Writing to the cart store directly skips all of it — see the [cart store reference](../../../state/cart/guide/reference/state-reference.md).

## Cautions

- **`window.next` is late.** It is assigned near the end of boot. Any call from a script that runs earlier throws `Cannot read properties of undefined` — use `window.nextReady.push()`.
- **A `null` from a campaign lookup is ambiguous.** `getCampaignData()`, `getPackage()` and the variant lookups all return `null` both for "not found" and for "the campaign has not loaded yet". Do your reads inside a `campaign:loaded` handler, or check `getCampaignData()` first.
- **Some calls report failure, others throw.** `applyCoupon()` resolves with `{ success: false }`; `setShippingMethod()` and `addUpsell()` throw. A bare `await` on the first looks like success.
- **`addItem()` with no `packageId` does nothing** — no throw, no warning. If an add never lands, log the id you passed.
- **The `track*` calls double-count.** The SDK already tracks the standard funnel. Adding your own call for the same step reports it twice.
- **Handlers are never cleaned up for you.** `on()` and `registerCallback()` need a matching `off()` / `unregisterCallback()` with the *same function reference*, or handlers accumulate across view changes.
- **Cart money is `Decimal`, not `number`.** `subtotal`, `total`, `totalDiscount` and `totalDiscountPercentage` are decimal.js instances, so `-`, `+` and `>` on them give `NaN` or a string comparison. Use `.minus()`, `.plus()`, `.gt()`, and `.toNumber()` at the boundary.
- **`trackSignUp()` and `trackLogin()` send the email address in the clear.** Nothing hashes it before it reaches your providers.
