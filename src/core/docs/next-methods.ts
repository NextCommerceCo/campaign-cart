/**
 * The prose half of the scriptable-API reference: what every `next.*` call is for,
 * a runnable example of it, and what a reader plants on `window` by loading the SDK.
 *
 * The names, signatures and source lines are **not** here — they are read out of
 * `src/core/next-commerce.ts` by `src/tests/docs/extract-next-methods.ts`, and a
 * drift test compares the two in both directions. So a method added to the facade
 * cannot stay undocumented, and a row for a deleted method cannot survive.
 *
 * Why a hand-declared file at all, when the class already carries TSDoc: TSDoc on the
 * class publishes to the **class page** — `src/core` is a TypeDoc entry point since
 * 2026-07-31, so it does reach a reader, but that reader is a contributor browsing
 * symbols. Someone wiring up a page looks for a task-shaped reference with runnable
 * examples, and that has to live somewhere a generator can write markdown from — this
 * file. Same pattern as {@link SDK_ATTRIBUTES} in `sdk-attributes.ts`.
 *
 * Build-time only, like every manifest: nothing under `src/` may import this, or
 * every sentence below ships in the bundle a customer page downloads.
 */

/** A task-shaped section of the API reference. Order here is the page order. */
export interface NextMethodGroup {
  /** Referenced by {@link NextMethodDoc.group}. */
  id: string;
  /** Heading, phrased as the job a reader came to do. */
  title: string;
  /** One or two sentences orienting the reader before the table. */
  intro: string;
}

/** One `window.next` member, in reader terms. */
export interface NextMethodDoc {
  /** Must match a public member of `NextCommerce` exactly. */
  name: string;
  /** A {@link NextMethodGroup} id. */
  group: string;
  /** One sentence: what it does for the page, not what it wraps. */
  summary: string;
  /**
   * A runnable snippet. No `…` placeholders — real values, or `{TOKENS}` a reader
   * substitutes. Required on every method by `.claude/rules/documentation.md` §2.
   */
  example: string;
  /**
   * What comes back, in reader terms. Required when the source has no return
   * annotation, because then the signature cannot show it — the drift test enforces
   * that, so an unannotated method cannot ship without one.
   */
  returns?: string;
  /** The trap, the symptom, and the fix. Omit when there is nothing real to warn about. */
  caution?: string;
}

/** One operation on `next.cart`, the object the `cart` getter returns. */
export interface CartOperationDoc {
  /** Must match a member of the `CartOperations` interface exactly. */
  name: string;
  /** What calling it does to the cart. */
  effect: string;
}

/** Where a `window.*` global comes from and who is meant to touch it. */
export type WindowAudience =
  /** Part of the supported page API. Use it. */
  | 'page'
  /** For analytics/tag-manager integration. */
  | 'analytics'
  /** Present only in debug mode, or only for console use. Never build on it. */
  | 'debug'
  /** A QA/preview override, driven by a URL parameter. */
  | 'qa'
  /** Owned by a third party; the SDK creates or fills it on their behalf. */
  | 'third-party';

/** One name the SDK puts on, or reads off, `window`. */
export interface WindowGlobalDoc {
  /** The property name, or a `prefix_*` label when {@link covers} lists the real ones. */
  name: string;
  /**
   * The actual property names this row accounts for, when a family of globals shares
   * one description. Eleven `eventTimelinePanel_*` click handlers are one fact to a
   * reader and eleven rows of noise; the drift test still checks every name here, so
   * collapsing them costs no coverage.
   */
  covers?: string[];
  audience: WindowAudience;
  /** `install` — the SDK assigns it. `read` — the SDK only reads what you set. */
  direction: 'install' | 'read';
  /** One sentence: what it is and why it exists. */
  summary: string;
  /** A runnable snippet, for anything a reader is meant to use. */
  example?: string;
  /**
   * Fence language for {@link example}, when `ts` is wrong. `nextConfig` is set in a
   * `<script>` tag in the page's head, and showing that as TypeScript misleads about
   * where it goes.
   */
  language?: string;
  /** The trap, the symptom, and the fix. */
  caution?: string;
}

// ── Method groups ───────────────────────────────────────────────────────────

export const NEXT_METHOD_GROUPS: NextMethodGroup[] = [
  {
    id: 'boot',
    title: 'Getting hold of the SDK',
    intro:
      'The SDK creates one instance of itself during boot and assigns it to `window.next`. ' +
      'You do not construct it. Because boot is asynchronous, code that runs early has to ' +
      'wait — that is what `window.nextReady` is for (see the ' +
      '[window surface](./window-surface.md)).',
  },
  {
    id: 'cart-read',
    title: 'Reading the cart',
    intro:
      'Snapshots of the cart as it stands right now. None of these change anything, and ' +
      'none of them wait for anything — if you call them before the campaign has loaded ' +
      'you get an empty cart, not an error. Subscribe to `cart:updated` instead of polling.',
  },
  {
    id: 'cart-write',
    title: 'Changing the cart',
    intro:
      'Every one of these recalculates totals and emits a cart event when it settles. ' +
      '`next.cart` is the fuller API — the shortcuts below it cover the common cases with ' +
      'less to type.',
  },
  {
    id: 'coupons',
    title: 'Coupons',
    intro:
      'Discount codes applied to the whole cart. Applying one is validated against the ' +
      'campaign, so it can fail for a reason worth showing the visitor.',
  },
  {
    id: 'shipping',
    title: 'Shipping',
    intro:
      'The shipping methods the campaign offers, and which one the visitor has chosen. ' +
      'Choosing one changes the cart total, so it belongs to the cart, not to the form.',
  },
  {
    id: 'catalog',
    title: 'Products, packages, and variants',
    intro:
      'Read-only lookups into the loaded campaign. A *package* is the sellable unit — a ' +
      'quantity of a product at a price — and its `ref_id` is the number every cart call ' +
      'takes. The variant lookups exist so you can build your own size/colour picker ' +
      'instead of using the built-in one.',
  },
  {
    id: 'events',
    title: 'Reacting to what happens',
    intro:
      'Two mechanisms, and they are not interchangeable. `on`/`off` subscribe to the ' +
      'typed SDK event bus and are what you want. `registerCallback` is the older ' +
      'lifecycle-hook channel, kept for pages that already use it.',
  },
  {
    id: 'analytics',
    title: 'Sending analytics events yourself',
    intro:
      'The SDK already tracks the standard ecommerce funnel on its own. Call these only ' +
      'for something it cannot see — a custom step, a view of a list you rendered ' +
      'yourself, a sign-up outside the checkout form. Every one of them is fire-and-forget: ' +
      'it queues the work and resolves immediately, and a failure is logged rather than ' +
      'thrown, so analytics can never break a page.',
  },
  {
    id: 'attribution',
    title: 'Attribution and order metadata',
    intro:
      'Attribution is the record of where the visitor came from; metadata is the free-form ' +
      'bag of extra values attached to the order. Both are collected automatically and ' +
      'sent with the order — these calls are for adding your own values on top.',
  },
  {
    id: 'params',
    title: 'URL parameters',
    intro:
      'The SDK captures every URL parameter on the first page view and keeps them for the ' +
      'whole session, so a value from the ad click is still available three pages later. ' +
      'These read and edit that captured set; they do not rewrite the address bar.',
  },
  {
    id: 'upsells',
    title: 'Post-purchase upsells',
    intro:
      'Offers added to an order that has already been paid for. They only work on a page ' +
      'reached after checkout, while the order is still in session — see the caution on ' +
      '`addUpsell`.',
  },
  {
    id: 'popups',
    title: 'On-page popups',
    intro:
      'Two behaviours with no `data-next-*` attribute of their own: you turn them on by ' +
      'calling them. Each has a full guide of its own, linked from its row.',
  },
  {
    id: 'utility',
    title: 'Formatting, version, and checks',
    intro: 'Small helpers that do not belong to any one part of the flow.',
  },
];

// ── Methods ─────────────────────────────────────────────────────────────────

export const NEXT_METHODS: NextMethodDoc[] = [
  // ── boot ──
  {
    name: 'getInstance',
    group: 'boot',
    summary:
      'Returns the one shared SDK instance, creating it if boot has not reached that point yet.',
    example: `import { NextCommerce } from '@next-commerce/campaign-cart';

const sdk = NextCommerce.getInstance();
console.log(sdk === window.next); // true`,
    caution:
      'Reached off the class, not off `next` — `next.getInstance()` also works but reads as ' +
      'though it made a second SDK. On a page that loads the SDK from the loader script, ' +
      'prefer `window.next`; there is nothing to import.',
  },

  // ── cart-read ──
  {
    name: 'hasItemInCart',
    group: 'cart-read',
    summary:
      'Whether a given package is currently in the cart, at any quantity.',
    example: `if (next.hasItemInCart({ packageId: 2 })) {
  document.querySelector('#upsell-banner')?.remove();
}`,
    caution:
      'Called with no `packageId` it returns `false` rather than "is the cart non-empty" — ' +
      'use `next.getCartCount() > 0` for that.',
  },
  {
    name: 'getCartData',
    group: 'cart-read',
    summary:
      'One snapshot carrying everything about the cart: priced line items, totals, the loaded campaign, and applied coupon codes.',
    example: `const { cartLines, cartTotals, vouchers } = next.getCartData();
console.log(\`\${cartLines.length} lines, \${cartTotals.total} total\`);
console.log('coupons:', vouchers);`,
    caution:
      'This is the same shape your `registerCallback` handlers receive, so it is the one to ' +
      'reach for when you are reproducing a callback outside its trigger. The amounts inside ' +
      '`cartTotals` are `Decimal` objects — see ' +
      '[`next.getCartTotals()`](#nextgetcarttotals).',
  },
  {
    name: 'getCartTotals',
    group: 'cart-read',
    summary:
      'The money only: subtotal, total, discount amount and percentage, and the chosen shipping method.',
    returns:
      'An object with `subtotal`, `total`, `totalDiscount` and ' +
      '`totalDiscountPercentage` as **`Decimal`** values (decimal.js instances, not plain ' +
      'numbers), plus a boolean `hasDiscounts` and `shippingMethod`, which is `undefined` ' +
      'until the visitor has chosen one.',
    example: `const { subtotal, total, hasDiscounts } = next.getCartTotals();
if (hasDiscounts) {
  // Decimal arithmetic, then convert once at the end.
  console.log('saving', subtotal.minus(total).toFixed(2));
}
next.formatPrice(total.toNumber()); // '$59.98'`,
    caution:
      'The amounts are `Decimal` objects, so `subtotal - total` is `NaN` and ' +
      '`total > 50` is a string comparison. Use `.minus()`, `.gt()` and friends, and call ' +
      '`.toNumber()` only when handing the value to something that wants a number — ' +
      '`formatPrice` is one.',
  },
  {
    name: 'getCartCount',
    group: 'cart-read',
    summary:
      'How many units are in the cart in total — quantities summed, not the number of lines.',
    example: `document.querySelector('#cart-badge')!.textContent =
  String(next.getCartCount());`,
    caution:
      'Two of one package and one of another is `3`, not `2`. For the number of rows use ' +
      '`next.getCartData().cartLines.length`.',
  },

  // ── cart-write ──
  {
    name: 'cart',
    group: 'cart-write',
    summary:
      'The full programmatic cart API — the supported way to drive the cart from code.',
    returns:
      'The cart operations object. Its members are listed under [What `next.cart` can ' +
      'do](#what-nextcart-can-do) below.',
    example: `await next.cart.addItem({ packageId: 2, quantity: 1, isUpsell: false });
await next.cart.updateQuantity(2, 3);
await next.cart.swapPackage(2, { packageId: 7, quantity: 1, isUpsell: false });`,
    caution:
      'Do not write to the cart store directly. The operations here carry the pricing, ' +
      'validation and event-emission logic; a raw `useCartStore.setState()` skips all three ' +
      'and leaves totals and analytics disagreeing with the visible cart.',
  },
  {
    name: 'addItem',
    group: 'cart-write',
    summary:
      'Adds a package to the cart, defaulting to one unit, merging with an existing line for the same package.',
    example: `await next.addItem({ packageId: 2 });          // one unit
await next.addItem({ packageId: 7, quantity: 3 }); // three units`,
    caution:
      'Omitting `packageId` does nothing at all — no throw, no log at warn level. If an add ' +
      'silently fails, check that the id actually reached the call. For upsell adds use ' +
      '`next.cart.addItem({ …, isUpsell: true })`, which is what marks the line for revenue ' +
      'reporting.',
  },
  {
    name: 'removeItem',
    group: 'cart-write',
    summary:
      'Removes a package from the cart completely, whatever its quantity.',
    example: `await next.removeItem({ packageId: 2 });`,
    caution:
      'A `packageId` that is not in the cart is not an error; nothing happens.',
  },
  {
    name: 'updateQuantity',
    group: 'cart-write',
    summary:
      'Sets a package to an exact quantity, rather than adding to what is already there.',
    example: `await next.updateQuantity({ packageId: 2, quantity: 3 }); // now exactly 3
await next.updateQuantity({ packageId: 2, quantity: 0 }); // removes the line`,
    caution:
      'Quantity `0` removes the line. If you meant "leave it alone", do not call this — ' +
      'there is no no-op quantity.',
  },
  {
    name: 'clearCart',
    group: 'cart-write',
    summary: 'Empties the cart.',
    example: `await next.clearCart();
console.log(next.getCartCount()); // 0`,
    caution:
      'Declared `async` but the underlying clear is synchronous, so awaiting it buys you ' +
      'nothing beyond a tidy call site.',
  },
  {
    name: 'swapCart',
    group: 'cart-write',
    summary:
      'Replaces the whole cart with the list you pass, in one step — anything already in the cart and not in the list is removed.',
    example: `// The visitor picked the 3-pack bundle: it replaces whatever they had.
await next.swapCart([
  { packageId: 7, quantity: 1 },
  { packageId: 9, quantity: 2 },
]);`,
    caution:
      'This is a replace, not a merge. Passing `[]` empties the cart. It is what bundle and ' +
      'swap-mode selectors use, which is also why pairing a swap-mode `package-selector` ' +
      'with `add-to-cart` on the same selector double-writes the cart — pick one.',
  },

  // ── coupons ──
  {
    name: 'applyCoupon',
    group: 'coupons',
    summary:
      'Validates a discount code against the campaign and applies it to the cart if it holds.',
    example: `const { success, message } = await next.applyCoupon('SAVE10');
if (!success) {
  showError(message); // e.g. "Coupon already applied"
}`,
    caution:
      'It resolves with `success: false` instead of throwing, so a bare `await` looks like ' +
      'it worked. Always read `success`, and show `message` — it is written for the visitor.',
  },
  {
    name: 'removeCoupon',
    group: 'coupons',
    summary:
      'Takes a previously applied discount code off the cart and recalculates totals.',
    example: `next.removeCoupon('SAVE10');`,
    caution:
      'Returns `void` even though the work behind it is asynchronous, so there is nothing to ' +
      'await. To act once the totals have settled, listen for `cart:updated`.',
  },
  {
    name: 'getCoupons',
    group: 'coupons',
    summary: 'The discount codes currently applied to the cart.',
    example: `for (const code of next.getCoupons()) {
  renderCouponChip(code);
}`,
  },

  // ── shipping ──
  {
    name: 'getShippingMethods',
    group: 'shipping',
    summary:
      'Every shipping method the loaded campaign offers, with its id, code, and price.',
    example: `for (const method of next.getShippingMethods()) {
  addOption(method.ref_id, \`\${method.code} — \${method.price}\`);
}`,
    caution:
      'Empty before the campaign has loaded, which is indistinguishable from "this campaign ' +
      'has no shipping methods". Populate your selector on `campaign:loaded`, not on ' +
      '`DOMContentLoaded`.',
  },
  {
    name: 'getSelectedShippingMethod',
    group: 'shipping',
    summary:
      'The shipping method the visitor has chosen, or `null` when they have not chosen one yet.',
    example: `const method = next.getSelectedShippingMethod();
console.log(method ? method.name : 'not chosen yet');`,
  },
  {
    name: 'setShippingMethod',
    group: 'shipping',
    summary:
      'Chooses a shipping method by id and recalculates the cart total with its price.',
    example: `await next.setShippingMethod(1);
console.log(next.getCartTotals().total); // now includes shipping`,
    caution:
      "Throws when the id is not one of the campaign's methods, so pass a `ref_id` from " +
      '`getShippingMethods()` rather than a hard-coded number that was valid in a different ' +
      'campaign.',
  },

  // ── catalog ──
  {
    name: 'getCampaignData',
    group: 'catalog',
    summary:
      'The loaded campaign — its packages, currency, and shipping methods — or `null` if it has not arrived yet.',
    example: `const campaign = next.getCampaignData();
if (campaign) {
  console.log(campaign.name, campaign.currency, campaign.packages.length);
}`,
    caution:
      '`null` means "still loading", not "no campaign". Guard on it, or subscribe to ' +
      '`campaign:loaded` and read it there.',
  },
  {
    name: 'getPackage',
    group: 'catalog',
    summary:
      'Looks up one package by its `ref_id` — the number every cart call and every `data-next-package-id` uses.',
    example: `const pkg = next.getPackage(2);
console.log(pkg?.name, pkg?.price);`,
    caution:
      'Returns `null` both for an unknown id and for "campaign not loaded yet". Check ' +
      '`getCampaignData()` first when you need to tell those apart.',
  },
  {
    name: 'getVariantsByProductId',
    group: 'catalog',
    summary:
      'Every package that is a variant of one product — each size, colour, or flavour of it.',
    example: `const variants = next.getVariantsByProductId(42);
console.log(variants?.map((v: { ref_id: number }) => v.ref_id));`,
    caution:
      'Grouped by product id, which is not the package `ref_id`. A product with no variants ' +
      'returns `null`, not an empty list.',
  },
  {
    name: 'getAvailableVariantAttributes',
    group: 'catalog',
    summary:
      'The distinct values one variant attribute takes for a product — every size it comes in, say — for building a picker.',
    example: `const sizes = next.getAvailableVariantAttributes(42, 'size');
// ['S', 'M', 'L']`,
    caution:
      "The attribute code is the campaign's own string (`size`, `color`), not a display " +
      'label. An unknown code returns `[]`, so an empty picker usually means a misspelled ' +
      'code rather than a product with one variant.',
  },
  {
    name: 'getPackageByVariantSelection',
    group: 'catalog',
    summary:
      'Resolves the one package matching a complete set of chosen variant attributes, so you can add it to the cart.',
    example: `const pkg = next.getPackageByVariantSelection(42, { size: 'L', color: 'red' });
if (pkg) await next.addItem({ packageId: pkg.ref_id });`,
    caution:
      'The selection has to be complete. A partial set — size chosen, colour not — matches ' +
      'nothing and returns `null`; keep the add-to-cart button disabled until every attribute ' +
      'has a value.',
  },
  {
    name: 'createVariantKey',
    group: 'catalog',
    summary:
      'Turns a set of chosen variant attributes into one stable string, for use as a lookup key in your own code.',
    example: `next.createVariantKey({ size: 'L', color: 'red' }); // 'color:red|size:L'
next.createVariantKey({ color: 'red', size: 'L' }); // 'color:red|size:L' — same`,
    caution:
      'The key is sorted, so property order never changes it. It is an identifier for your ' +
      'own maps — nothing in the SDK or the API accepts it as an argument.',
  },

  // ── events ──
  {
    name: 'on',
    group: 'events',
    summary:
      'Subscribes to an SDK event. Event names and their payloads are typed, so a misspelled name fails type-check.',
    example: `next.on('cart:item-added', ({ packageId, quantity }) => {
  console.log(\`added \${quantity} × \${packageId}\`);
});`,
    caution:
      'There is no automatic teardown. On a page that swaps views, keep the handler in a ' +
      'variable and pass it to `next.off()` when the view goes away, or handlers accumulate ' +
      'and fire several times per event.',
  },
  {
    name: 'off',
    group: 'events',
    summary: 'Unsubscribes a handler that was registered with `next.on()`.',
    example: `const onAdd = () => refreshBadge();
next.on('cart:item-added', onAdd);
// later
next.off('cart:item-added', onAdd);`,
    caution:
      'Matched by function identity. An inline arrow passed to `on` can never be removed — ' +
      'name the handler.',
  },
  {
    name: 'registerCallback',
    group: 'events',
    summary:
      'Registers a handler for a callback type, which receives whatever snapshot the caller of `next.triggerCallback()` passes it.',
    example: `next.registerCallback('cartUpdated', ({ cartTotals }) => {
  document.querySelector('#total')!.textContent = String(cartTotals.total);
});

// Nothing in the SDK fires it — your own code has to:
next.triggerCallback('cartUpdated', next.getCartData());`,
    caution:
      '**The SDK never fires these.** `triggerCallback` has no caller anywhere in the SDK ' +
      '(`core/next-commerce.ts:354` is its only definition and nothing invokes it), so a ' +
      'handler registered here stays silent until your own code triggers it. It is a ' +
      'page-driven notification channel, not a lifecycle hook. For events the SDK really ' +
      'does emit, use `next.on()`.',
  },
  {
    name: 'unregisterCallback',
    group: 'events',
    summary: 'Removes a callback registered with `next.registerCallback()`.',
    example: `const onCart = (data: unknown) => console.log(data);
next.registerCallback('cartUpdated', onCart);
next.unregisterCallback('cartUpdated', onCart);`,
    caution:
      'Matched by function identity, same as `off`. Registering an inline function makes it ' +
      'permanent.',
  },
  {
    name: 'triggerCallback',
    group: 'events',
    summary:
      'Fires every callback registered for a type, with a snapshot you supply. This is the only thing that fires them.',
    example: `next.registerCallback('cartUpdated', data => console.log(data));

// Without this line the handler above never runs.
next.triggerCallback('cartUpdated', next.getCartData());`,
    caution:
      'It reads as an internal method and is not one in practice: **nothing in the SDK calls ' +
      'it**, so `registerCallback` handlers only run when your code calls this. Triggering ' +
      'changes no state — it only notifies handlers — so passing a stale or invented ' +
      'snapshot makes the page render a cart that does not exist. A handler that throws is ' +
      'caught and logged at error level rather than stopping the rest.',
  },

  // ── analytics ──
  {
    name: 'trackViewItemList',
    group: 'analytics',
    summary:
      'Reports that a list of packages was shown — a product grid or a recommendation rail you rendered yourself.',
    example: `next.trackViewItemList([2, 7, 9], undefined, 'Best sellers');`,
    caution:
      'The second parameter (`_listId`) is accepted and ignored; the list name is the third. ' +
      'Passing the name in second position loses it silently.',
  },
  {
    name: 'trackViewItem',
    group: 'analytics',
    summary: 'Reports that one package was viewed in detail.',
    example: `next.trackViewItem(2);`,
    caution:
      'The package has to be in the loaded campaign. If it is not, the call logs a warning ' +
      'and sends nothing — so a tracked view going missing usually means the campaign had ' +
      'not loaded yet.',
  },
  {
    name: 'trackAddToCart',
    group: 'analytics',
    summary:
      "Reports an add-to-cart that happened outside the SDK's own cart calls.",
    example: `next.trackAddToCart(2, 3);`,
    caution:
      'The SDK already tracks its own adds. Calling this after `next.addItem()` reports the ' +
      'same add twice and inflates the funnel.',
  },
  {
    name: 'trackRemoveFromCart',
    group: 'analytics',
    summary:
      "Reports a removal that happened outside the SDK's own cart calls.",
    example: `next.trackRemoveFromCart(2, 1);`,
    caution:
      'Double-counts for the same reason as `trackAddToCart` — do not pair it with `next.removeItem()`.',
  },
  {
    name: 'trackBeginCheckout',
    group: 'analytics',
    summary:
      'Reports that the visitor started checkout, using the current cart contents.',
    example: `document.querySelector('#to-checkout')!.addEventListener('click', () => {
  next.trackBeginCheckout();
});`,
    caution:
      'The built-in checkout form fires this already. Call it only for a checkout flow you ' +
      'built yourself.',
  },
  {
    name: 'trackPurchase',
    group: 'analytics',
    summary:
      "Reports a completed order, with the order payload as the event's source of truth.",
    example: `next.trackPurchase({ ref_id: 'ORD-1042', total_incl_tax: '59.98', lines: [] });`,
    caution:
      'The receipt page reports the purchase on its own. Calling this as well is the classic ' +
      'cause of doubled revenue in a analytics property — reconcile before you add it.',
  },
  {
    name: 'trackCustomEvent',
    group: 'analytics',
    summary: 'Sends an event of your own naming, with any payload you choose.',
    example: `next.trackCustomEvent('size_guide_opened', { productId: 42 });`,
    caution:
      'Nothing validates the name or the payload, so a typo becomes a new event name in your ' +
      'analytics property rather than an error. Keep the names in one constant.',
  },
  {
    name: 'trackSignUp',
    group: 'analytics',
    summary:
      'Reports a newsletter or account sign-up, identified by email address.',
    example: `next.trackSignUp('shopper@example.com');`,
    caution:
      'The address is placed in the event payload as `customer_email` **in the clear** — ' +
      'nothing in the SDK hashes it. It therefore reaches every configured provider, and ' +
      'the browser data layer, as plain text. Pass it only where your privacy policy and ' +
      'your provider agreements allow, and call `next.trackSignUp()` with no argument when ' +
      'you only need the event.',
  },
  {
    name: 'trackLogin',
    group: 'analytics',
    summary:
      'Reports a returning visitor signing in, identified by email address.',
    example: `next.trackLogin('shopper@example.com');`,
    caution:
      'Carries the address in the clear exactly as `trackSignUp` does — read that caution ' +
      'before passing one.',
  },
  {
    name: 'setDebugMode',
    group: 'analytics',
    summary:
      'Turns verbose analytics logging on or off at runtime, so you can see every event as it is built and dispatched.',
    example: `next.setDebugMode(true);   // watch events in the console
next.setDebugMode(false);  // quiet again`,
    caution:
      'Affects analytics logging only — it does not enable the debug overlay, which is ' +
      '`?debugger=true` or `window.nextConfig.debugger`. Leave it off in production; it is ' +
      'noisy, not harmful.',
  },
  {
    name: 'invalidateAnalyticsContext',
    group: 'analytics',
    summary:
      "Tells analytics the page changed, so the next event is built with fresh page context instead of the previous route's.",
    example: `// Single-page app: after your router settles on a new route
router.afterEach(() => next.invalidateAnalyticsContext());`,
    caution:
      'Needed only in a single-page app, where no full page load resets the context. Forget ' +
      "it and every event after the first route reports the first route's URL and page type.",
  },

  // ── attribution ──
  {
    name: 'addMetadata',
    group: 'attribution',
    summary: "Attaches one extra named value to the order's metadata.",
    example: `next.addMetadata('quiz_result', 'sensitive-skin');`,
    caution:
      'Merges, so it will not disturb the values the SDK collects automatically. Errors are ' +
      'caught and logged at error level rather than thrown — check the console if a value ' +
      'never reaches the order.',
  },
  {
    name: 'setMetadata',
    group: 'attribution',
    summary:
      "Attaches several named values to the order's metadata in one call.",
    example: `next.setMetadata({ quiz_result: 'sensitive-skin', quiz_version: '3' });`,
    caution:
      'Despite the name it merges rather than replaces, which is deliberate: a true replace ' +
      'would wipe the automatic fields (`landing_page`, `referrer`, `device`). To clear your ' +
      'own values use `clearMetadata()`.',
  },
  {
    name: 'clearMetadata',
    group: 'attribution',
    summary:
      'Drops the metadata you added, keeping the fields the SDK collects on its own.',
    example: `next.clearMetadata();
console.log(next.getMetadata()); // automatic fields only`,
    caution:
      'Not a full reset: `landing_page`, `referrer`, `device`, `device_type`, `domain` and ' +
      '`timestamp` are preserved on purpose, because the order needs them.',
  },
  {
    name: 'getMetadata',
    group: 'attribution',
    summary:
      'The metadata that will be sent with the order, automatic fields included.',
    example: `console.log(next.getMetadata()?.landing_page);`,
    caution:
      '`undefined` means the read failed, not that the bag is empty — an empty bag is `{}`.',
  },
  {
    name: 'setAttribution',
    group: 'attribution',
    summary:
      'Overrides the attribution the SDK collected — the funnel, affiliate, and campaign fields recorded against the order.',
    example: `next.setAttribution({ funnel: 'summer-quiz-v2', utm_source: 'newsletter' });`,
    caution:
      'Overwrites what was captured from the URL. Attribution decides who gets paid for the ' +
      'sale, so setting it from page code is a reporting decision, not a cosmetic one — see ' +
      'the [attribution store reference](../../../state/attribution/guide/reference/state-reference.md).',
  },
  {
    name: 'getAttribution',
    group: 'attribution',
    summary: 'The attribution exactly as it will be sent to the order API.',
    example: `console.log(next.getAttribution()?.funnel);`,
    caution:
      'This is the API-shaped view, not the raw store — field names match the order payload, ' +
      'so it is the right thing to log when an order arrives attributed wrongly.',
  },
  {
    name: 'debugAttribution',
    group: 'attribution',
    summary:
      'Prints the whole attribution state to the console, formatted for reading.',
    example: `next.debugAttribution(); // then read the console`,
    caution:
      'A console tool: it returns nothing, so there is no value to assert on in a test. Use ' +
      '`getAttribution()` for that.',
  },

  // ── params ──
  {
    name: 'setParam',
    group: 'params',
    summary: 'Sets one captured URL parameter for the rest of the session.',
    example: `next.setParam('promo', 'spring24');`,
    caution:
      'Does not touch the address bar. The value lives in the session store, so a reader ' +
      'looking for it in `location.search` will not find it.',
  },
  {
    name: 'setParams',
    group: 'params',
    summary: 'Sets several captured URL parameters at once.',
    example: `next.setParams({ promo: 'spring24', variant: 'b' });`,
    caution:
      'Replaces the value of each key it names and leaves the rest alone. To add without ' +
      'risking an overwrite, use `mergeParams`.',
  },
  {
    name: 'getParam',
    group: 'params',
    summary:
      'Reads one captured URL parameter, or `null` when it was never present.',
    example: `const variant = next.getParam('variant') ?? 'a';`,
  },
  {
    name: 'getAllParams',
    group: 'params',
    summary: 'Every URL parameter captured for this session.',
    example: `console.log(Object.keys(next.getAllParams()));`,
  },
  {
    name: 'hasParam',
    group: 'params',
    summary: 'Whether a parameter was captured, regardless of its value.',
    example: `if (next.hasParam('debug_offer')) showOfferDebugPanel();`,
    caution:
      'True for a parameter present with an empty value (`?promo=`), which `getParam` returns ' +
      "as `''`. Use this when presence is the signal.",
  },
  {
    name: 'clearParam',
    group: 'params',
    summary: 'Forgets one captured URL parameter.',
    example: `next.clearParam('promo');`,
  },
  {
    name: 'clearAllParams',
    group: 'params',
    summary: 'Forgets every captured URL parameter for this session.',
    example: `next.clearAllParams();
console.log(next.getAllParams()); // {}`,
    caution:
      'This also drops the `utm_*` values the campaign was entered with, which attribution ' +
      'reads. Clear individual keys unless you mean to lose the whole entry context.',
  },
  {
    name: 'mergeParams',
    group: 'params',
    summary:
      'Adds parameters to the captured set without disturbing keys you did not name.',
    example: `next.mergeParams({ quiz_step: '3' });`,
  },

  // ── upsells ──
  {
    name: 'addUpsell',
    group: 'upsells',
    summary:
      'Adds one or more packages to the order the visitor has already paid for, charging their saved payment method.',
    example: `const { order, addedLines, totalValue } = await next.addUpsell({
  items: [
    { packageId: 12, quantity: 1 },
    { packageId: 13, quantity: 2 },
  ],
});
console.log(\`added \${addedLines.length} lines worth \${totalValue}\`);`,
    caution:
      'Throws — it does not resolve with an error — in four cases: no order in session, the ' +
      'order does not support post-purchase upsells or is mid-processing, and neither ' +
      '`packageId` nor `items` was given. Wrap it in `try`/`catch` and check ' +
      '`canAddUpsells()` first. This charges money; it is not a cart call.',
  },
  {
    name: 'canAddUpsells',
    group: 'upsells',
    summary:
      'Whether the order in session can still take a post-purchase upsell right now.',
    example: `if (next.canAddUpsells()) {
  showUpsellOffer();
}`,
    caution:
      'Also `false` while an upsell is being processed, so it is the right guard against ' +
      'double-submitting an offer button.',
  },
  {
    name: 'getCompletedUpsells',
    group: 'upsells',
    summary: 'The package ids of upsells this order has already accepted.',
    example: `console.log(next.getCompletedUpsells()); // ['12']`,
    caution: 'Strings, not numbers — compare with `String(packageId)`.',
  },
  {
    name: 'isUpsellAlreadyAdded',
    group: 'upsells',
    summary:
      'Whether a package has already been accepted on this order, so a repeat offer can be skipped.',
    example: `if (!next.isUpsellAlreadyAdded(12)) {
  showUpsellOffer(12);
}`,
    caution:
      'Checks both the completed list and the accepted entries in the upsell journey, so it ' +
      'stays true across a page reload of the upsell funnel.',
  },

  // ── popups ──
  {
    name: 'exitIntent',
    group: 'popups',
    summary:
      'Shows an image or template popup when the visitor looks like they are about to leave.',
    example: `await next.exitIntent({
  image: 'https://cdn.example.com/wait-10-off.png',
  maxTriggers: 1,
  useSessionStorage: true,
  disableOnMobile: true,
});`,
    caution:
      'Loads its code on demand, so the first call is asynchronous and it rethrows if that ' +
      'load fails. Full options and behaviour: ' +
      '[simple-exit-intent guide](../../../features/behavior/simple-exit-intent/guide/overview.md).',
  },
  {
    name: 'disableExitIntent',
    group: 'popups',
    summary: 'Stops the exit-intent popup from appearing again on this page.',
    example: `next.disableExitIntent();`,
    caution:
      'Does nothing if `exitIntent()` was never called — there is nothing to disable, and no ' +
      'warning either.',
  },
  {
    name: 'fomo',
    group: 'popups',
    summary:
      'Starts the rotating social-proof popup — "someone in Denver bought this a moment ago" — from a list you supply.',
    example: `await next.fomo({
  items: [
    { text: 'bought the 3-pack', image: 'https://cdn.example.com/p3.png' },
  ],
  customers: { 'United States': ['Ava from Denver', 'Noah from Austin'] },
  displayDuration: 5000,
  delayBetween: 12000,
});`,
    caution:
      'Called with no argument it starts with its built-in defaults rather than doing ' +
      'nothing. Full options: ' +
      '[fomo-popup guide](../../../features/behavior/fomo-popup/guide/overview.md).',
  },
  {
    name: 'stopFomo',
    group: 'popups',
    summary: 'Stops the social-proof popup rotation.',
    example: `next.stopFomo();`,
    caution: 'A no-op when `fomo()` was never called.',
  },

  // ── utility ──
  {
    name: 'getVersion',
    group: 'utility',
    summary:
      'The SDK version running on the page — the loader-reported value if there is one, otherwise the version baked in at build.',
    example: `console.log(next.getVersion()); // "0.4.30"`,
    caution:
      'This is the value to trust. The `next:initialized` DOM event carries a hard-coded ' +
      '`version` that has not tracked releases — read it from here instead.',
  },
  {
    name: 'formatPrice',
    group: 'utility',
    summary:
      "Formats a number as money in the campaign's currency, so your own markup matches the SDK's.",
    example: `next.formatPrice(19.99);        // '$19.99' in a USD campaign
next.formatPrice(19.99, 'EUR'); // '€19.99'`,
    caution:
      'Falls back to USD when the campaign has not loaded, so a price formatted too early ' +
      'can carry the wrong symbol. Format after `campaign:loaded`.',
  },
  {
    name: 'validateCheckout',
    group: 'utility',
    summary:
      'A pre-flight check before sending the visitor to checkout, returning the reasons it would fail.',
    example: `const { valid, errors } = next.validateCheckout();
if (!valid) showErrors(errors); // e.g. ['Cart is empty']`,
    caution:
      'Only checks that the cart is not empty today. It is not a substitute for the checkout ' +
      "form's own field validation, and passing it does not mean an order will succeed.",
  },
];

// ── next.cart operations ────────────────────────────────────────────────────

/**
 * The members of the object `next.cart` returns.
 *
 * Documented here rather than left to the cart store's own reference because
 * `next.cart.swapPackage` and `next.cart.refreshItemPrices` have no other route into
 * the reader-facing docs: they are not members of `NextCommerce`, and the store
 * reference documents state, not this object.
 */
export const NEXT_CART_OPERATIONS: CartOperationDoc[] = [
  {
    name: 'addItem',
    effect:
      'Adds a package, merging with an existing line for the same package. `isUpsell` is required and decides whether the line counts as post-purchase revenue.',
  },
  {
    name: 'removeItem',
    effect: 'Removes a package entirely, whatever its quantity.',
  },
  {
    name: 'updateQuantity',
    effect: 'Sets an exact quantity. `0` removes the line.',
  },
  {
    name: 'swapPackage',
    effect:
      'Removes one package and adds another in the same step, so the cart is never briefly empty. What a variant or upgrade switch should use.',
  },
  {
    name: 'swapCart',
    effect:
      'Replaces the entire contents with the list given. Unlike `next.swapCart`, this form also accepts per-line `properties`.',
  },
  { name: 'clear', effect: 'Empties the cart. Synchronous.' },
  {
    name: 'calculateTotals',
    effect:
      'Recalculates totals from the current lines. Called for you by every operation above; you need it only after changing the store by hand, which you should not be doing.',
  },
  {
    name: 'refreshItemPrices',
    effect:
      "Re-reads every line's price from the loaded campaign. For when the campaign reloaded under a different currency and the cart still holds the old prices.",
  },
  {
    name: 'setShippingMethod',
    effect:
      'Chooses a shipping method by id, validates it against the campaign, and recalculates the total.',
  },
  {
    name: 'applyCoupon',
    effect:
      'Validates and applies a discount code. Resolves with `{ success, message }` rather than throwing.',
  },
  {
    name: 'removeCoupon',
    effect: 'Removes an applied discount code and recalculates.',
  },
];

// ── window surface ──────────────────────────────────────────────────────────

/** Sections of the window-surface page, in page order. */
export const WINDOW_GROUPS: Array<{
  audience: WindowAudience;
  title: string;
  intro: string;
}> = [
  {
    audience: 'page',
    title: 'What your page should use',
    intro:
      'Two globals the SDK installs for you to call, and two it reads from what you set. ' +
      'These are supported: build on them.',
  },
  {
    audience: 'analytics',
    title: 'Analytics and tag-manager hooks',
    intro:
      'Installed so a tag manager, or your own reporting code, can see and reshape events ' +
      'without importing anything. Stable enough to integrate against, but they are an ' +
      'integration seam rather than the page API — reach for `next.track*` first.',
  },
  {
    audience: 'third-party',
    title: 'Third-party arrays the SDK fills',
    intro:
      "Not the SDK's namespace. It creates these if the vendor script has not, so that " +
      'events queued before the vendor loads are not lost.',
  },
  {
    audience: 'qa',
    title: 'Preview and QA overrides',
    intro:
      'Set from URL parameters during boot and consumed once the campaign has loaded, so a ' +
      'tester can force a selection without editing the page. They are not part of the API — ' +
      'the URL parameter is the interface.',
  },
  {
    audience: 'debug',
    title: 'Debug-only globals',
    intro:
      'Present only in debug mode, or only for typing into a console. Every one of them can ' +
      'change or vanish in a patch release, so nothing on a customer page may depend on ' +
      'them. Turn debug mode on with `?debugger=true` or `window.nextConfig.debugger`.',
  },
];

export const WINDOW_GLOBALS: WindowGlobalDoc[] = [
  // ── page ──
  {
    name: 'next',
    audience: 'page',
    direction: 'install',
    summary:
      'The SDK itself — every call in the [JavaScript API](./javascript-api.md) hangs off this.',
    example: `await window.next.addItem({ packageId: 2 });`,
    caution:
      'Assigned late in boot, so it is `undefined` for any script that runs before the SDK ' +
      'is ready. Reading `next.getCartCount()` at the top of a page script throws — use ' +
      '`nextReady.push()`.',
  },
  {
    name: 'nextReady',
    audience: 'page',
    direction: 'install',
    summary:
      'The queue for code that needs the SDK before you know whether it has loaded — push a function and it runs with the SDK as its argument.',
    example: `// Works whether the SDK has loaded yet or not.
window.nextReady = window.nextReady || [];
window.nextReady.push(sdk => {
  console.log('cart count at boot:', sdk.getCartCount());
});`,
    caution:
      'It changes shape during boot: an array you create, replaced by an object with a ' +
      '`push` method that runs callbacks immediately. Only ever call `push` on it — treating ' +
      'it as an array afterwards (`nextReady.length`, `nextReady.map`) fails.',
  },
  {
    name: 'nextConfig',
    audience: 'page',
    direction: 'read',
    summary:
      'The configuration object your page sets before the SDK loads — API key, debug flag, page type, and analytics settings.',
    language: 'html',
    example: `<script>
  window.nextConfig = {
    apiKey: '{YOUR_CAMPAIGN_API_KEY}',
    debugger: false,
    pageType: 'product',
  };
</script>
<script src="{SDK_LOADER_URL}"></script>`,
    caution:
      'Read during boot, so it has to be set before the SDK script runs; assigning it ' +
      'afterwards changes nothing. Meta tags override it where both are present.',
  },
  {
    name: '__NEXT_SDK_VERSION__',
    audience: 'page',
    direction: 'read',
    summary:
      'The version the loader script reports, which `next.getVersion()` prefers over the build-time value.',
    example: `console.log(window.__NEXT_SDK_VERSION__ ?? 'set by the loader only');`,
    caution:
      'Only the loader sets it. On a page that imports the bundle directly it is `undefined`, ' +
      'and `next.getVersion()` falls back to the build-time version — which is the accurate ' +
      'one in that case.',
  },

  // ── analytics ──
  {
    name: 'NextDataLayer',
    audience: 'analytics',
    direction: 'install',
    summary:
      "The SDK's own event array — every analytics event it emits is pushed here, in order, whether or not any provider is configured.",
    example: `console.table(window.NextDataLayer);`,
    caution:
      'Emptied when the data layer reinitialises, so it is a live view rather than a ' +
      'complete session log. Do not read a length from it and assume it only grows.',
  },
  {
    name: 'NextDataLayerTransformFn',
    audience: 'analytics',
    direction: 'install',
    summary:
      'A hook for rewriting every event before it is dispatched — rename fields, add your own, or drop the event.',
    example: `window.NextDataLayerTransformFn = event => ({
  ...event,
  store_id: '{YOUR_STORE_ID}',
});`,
    caution:
      'Assign it **after** the SDK is up — from inside `window.nextReady.push()`. The ' +
      "analytics engine's constructor sets this slot to `null` unconditionally, so a " +
      'transform assigned in a `<script>` tag before the SDK loads is discarded and every ' +
      'event goes out untransformed. It also runs on every event, so a throw inside it ' +
      'costs you analytics across the whole page — keep it free of anything that can fail.',
  },
  {
    name: 'NextAnalytics',
    audience: 'analytics',
    direction: 'install',
    summary:
      'The analytics engine, for reading its status and provider list from a console.',
    example: `console.log(window.NextAnalytics.getStatus());`,
    caution:
      'An internal object exposed for inspection. Prefer `next.track*` and ' +
      '`next.setDebugMode()`; methods here are free to change.',
  },
  {
    name: 'NextDataLayerManager',
    audience: 'analytics',
    direction: 'install',
    summary:
      'The data-layer manager behind `NextDataLayer`, for setting a transform function or inspecting configuration at runtime.',
    example: `window.NextDataLayerManager.setTransformFunction(event => event);`,
    caution:
      'Internal, same as `NextAnalytics`. The supported seam is `NextDataLayerTransformFn`.',
  },
  {
    name: 'NextMetaTagController',
    audience: 'analytics',
    direction: 'install',
    summary:
      'Reads the analytics configuration the page declares in `<meta>` tags, for checking what the SDK picked up.',
    example: `console.log(window.NextMetaTagController.getConfig?.());`,
    caution:
      'Internal. Meta tags are the interface; this object is how the SDK reads them.',
  },
  {
    name: 'NextInvalidateContext',
    audience: 'analytics',
    direction: 'install',
    summary:
      'Tells analytics the route changed, for a single-page app that cannot import from the SDK.',
    example: `window.NextInvalidateContext();`,
    caution:
      'The same thing as `next.invalidateAnalyticsContext()`. Two doors to one behaviour; ' +
      'prefer the method, and use this only from code that has no reference to `next`.',
  },
  {
    name: 'NextAnalyticsClearIgnore',
    audience: 'analytics',
    direction: 'install',
    summary:
      'Clears the flag that suppresses analytics for a session — the escape hatch after a page was marked as internal traffic.',
    example: `window.NextAnalyticsClearIgnore();`,
    caution:
      'If events stopped arriving from one browser and nothing else explains it, the ignore ' +
      'flag is the thing to check, and this is how you clear it.',
  },
  {
    name: 'nextCampaign',
    audience: 'analytics',
    direction: 'read',
    summary:
      'The NextCampaign vendor SDK. When its script is on the page, the SDK forwards analytics events into it.',
    example: `if (window.nextCampaign) {
  console.log('NextCampaign provider is live');
}`,
    caution:
      'Loaded by the SDK when that provider is configured, and read back once present. If ' +
      'the script never loads, events raise a dispatch failure rather than being silently ' +
      'dropped — check the console before assuming the provider is off.',
  },

  // ── third-party ──
  {
    name: 'dataLayer',
    audience: 'third-party',
    direction: 'install',
    summary:
      "Google Tag Manager's event queue. The SDK creates it if absent and pushes its events there.",
    example: `console.log(window.dataLayer.filter(e => e.event?.startsWith('dl_')));`,
    caution:
      'Created with `window.dataLayer = window.dataLayer || []`, so an existing queue is ' +
      'preserved and load order does not matter. Do not reassign it — replacing the array ' +
      'orphans everything GTM has already read.',
  },
  {
    name: 'ElevarDataLayer',
    audience: 'third-party',
    direction: 'install',
    summary:
      "Elevar's event queue, created and filled the same way as `dataLayer`.",
    caution:
      'Created even when Elevar is not in use, in which case it stays an empty array.',
  },

  // ── qa ──
  {
    name: '_nextForcePackageId',
    audience: 'qa',
    direction: 'install',
    summary:
      'Pre-loads the cart with a package for preview, taken from the `?forcePackageId=` URL parameter.',
    example: `// Open the page with:
// https://example.com/offer?forcePackageId=2`,
    caution:
      'Consumed and deleted once the campaign has loaded, so reading it later gives ' +
      '`undefined` even though it worked. Drive it from the URL, not from script.',
  },
  {
    name: '_nextForceShippingId',
    audience: 'qa',
    direction: 'install',
    summary:
      'Pre-selects a shipping method for preview, from the `?forceShippingId=` URL parameter.',
    example: `// https://example.com/checkout?forceShippingId=1`,
    caution:
      'Consumed and deleted after the campaign loads, same as `_nextForcePackageId`.',
  },
  {
    name: '_nextForceBundleId',
    audience: 'qa',
    direction: 'install',
    summary:
      'Forces which bundle card starts selected, from the `?forceBundleId=` URL parameter — overriding `data-next-selected` in the markup.',
    example: `// One selector on the page:
// https://example.com/offer?forceBundleId=3
// Several selectors, addressed by id:
// https://example.com/offer?forceBundleId=main:3,upsell:7`,
    caution:
      'Unlike the other two this one is not deleted after use, because the bundle selector ' +
      'reads it when it initialises, which can be after the campaign has loaded.',
  },

  // ── debug ──
  {
    name: 'nextDebug',
    audience: 'debug',
    direction: 'install',
    summary:
      'The console toolbox: the raw stores, cart shortcuts, campaign cache controls, analytics status, attribution tools, and order inspection.',
    example: `// With ?debugger=true on the URL:
nextDebug.stores.cart.getState().items;
nextDebug.addToCart(2, 1);
nextDebug.getCacheInfo();
nextDebug.attribution.debug();`,
    caution:
      'It hands out the six Zustand stores directly, and a `setState` on one of those skips ' +
      'every operation that carries the pricing and event logic — the cart will disagree ' +
      'with its totals and with analytics. Read through it; write through `next.*`. Absent ' +
      'entirely when debug mode is off, and assembled in two passes (boot, then the debug ' +
      'overlay), so a key can appear a moment after the object does.',
  },
  {
    name: 'validateFormats',
    audience: 'debug',
    direction: 'install',
    summary:
      'Checks every display binding on the page for a malformed format string, logs a report, and outlines the offending elements.',
    example: `validateFormats(); // returns the report as well as logging it`,
    caution:
      'Installed whenever the display code loads, not only in debug mode, but it is a console ' +
      'tool — it writes to the console and mutates element outlines.',
  },
  {
    name: 'eventTimelinePanel_*',
    covers: [
      'eventTimelinePanel_showModal',
      'eventTimelinePanel_closeModal',
      'eventTimelinePanel_setTab',
      'eventTimelinePanel_selectFlowNode',
      'eventTimelinePanel_search',
      'eventTimelinePanel_filterProvider',
      'eventTimelinePanel_toggleIssues',
      'eventTimelinePanel_clearFilters',
      'eventTimelinePanel_toggleDrawer',
      'eventTimelinePanel_toggleInternal',
      'eventTimelinePanel_setView',
    ],
    audience: 'debug',
    direction: 'install',
    summary:
      "Eleven click handlers for the debug overlay's event-timeline panel, on `window` because the panel wires its buttons with inline `onclick`.",
    caution:
      'Implementation detail of the overlay. They exist only while that panel is open, and ' +
      "calling one from your own code drives the panel's UI, nothing else.",
  },
  {
    name: 'fetch',
    audience: 'debug',
    direction: 'install',
    summary:
      "The browser's own `fetch`, wrapped by the debug event manager so API calls appear in the event timeline.",
    caution:
      'A monkey-patch of a browser global — the one entry here that changes behaviour outside ' +
      'the SDK. It delegates to the original and only adds logging, but it is installed for ' +
      'the life of the page and never restored, so anything that also wraps `fetch` will see ' +
      'the patched version. Debug mode only.',
  },
];
