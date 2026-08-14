/**
 * Global type definitions for the SDK
 */

import type { Decimal } from 'decimal.js';
import type { Offer } from './campaign';

import type { Order } from './api';

/**
 * The complete catalog of events the SDK emits, mapped to their payload shape.
 *
 * Each key is an event name you can subscribe to (`sdk.on('cart:updated', …)`),
 * and its value is the object your handler receives. Use this as the lookup for
 * "what fields does *this* event give me?" — the narrative guide to subscribing
 * lives in [the JavaScript API reference](../core/guide/reference/javascript-api.md).
 */
export interface EventMap {
  /**
   * The cart changed and its totals were recalculated. Fires after every add,
   * remove, quantity change, swap, coupon, and shipping change — so it is the one
   * event to bind a cart display to, rather than subscribing to each of those.
   *
   * The payload is the whole cart, not a delta.
   */
  'cart:updated': CartState;
  /**
   * A package was successfully added to the cart.
   *
   * @example
   * ```json
   * {
   *   "packageId": 42,
   *   "quantity": 1,
   *   "source": "selector"
   * }
   * ```
   */
  'cart:item-added': {
    /** The `ref_id` of the package that was added. */
    packageId: number;
    /** How many units were added. */
    quantity?: number;
    /**
     * Where the package came from: `selector` when a linked selector supplied
     * it, `direct` when it came from the button's own `data-next-package-id`.
     */
    source?: string;
  };
  /**
   * A line was removed from the cart — by a remove button, or by a quantity
   * control dropping it to zero.
   *
   * @example
   * ```json
   * { "packageId": 42 }
   * ```
   */
  'cart:item-removed': {
    /** The package whose line was removed. */
    packageId: number;
  };
  /**
   * A cart line's quantity changed. Fired after the write succeeds, so the cart
   * store already reflects the new value. Not fired when the requested quantity
   * equals the current one.
   *
   * @example
   * ```json
   * {
   *   "packageId": 42,
   *   "quantity": 3,
   *   "oldQuantity": 2
   * }
   * ```
   */
  'cart:quantity-changed': {
    /** The package whose quantity changed. */
    packageId: number;
    /** The new quantity. `0` means the line was removed from the cart. */
    quantity: number;
    /** The quantity before the change. */
    oldQuantity: number;
  };
  /**
   * One package replaced another in a single operation, keeping the cart at one
   * line instead of removing and adding — which is what a `swap`-mode selector
   * does when the visitor picks a different card.
   *
   * @example
   * ```json
   * {
   *   "previousPackageId": 101,
   *   "newPackageId": 102,
   *   "priceDifference": 10,
   *   "source": "selector"
   * }
   * ```
   */
  'cart:package-swapped': {
    /** The package that was in the cart before the swap. */
    previousPackageId: number;
    /** The package now in the cart. */
    newPackageId: number;
    /** The full line as it was before the swap, when it could be resolved. */
    previousItem?: CartItem;
    /** The full line as it is after the swap. */
    newItem?: CartItem;
    /** New price minus old price. Negative when the visitor traded down. */
    priceDifference: number;
    /** What triggered the swap, e.g. `selector`. */
    source?: string;
  };
  /**
   * Campaign data — packages, currency, and settings — finished loading.
   *
   * @deprecated Declared and subscribed to, but never emitted by this build. A
   * handler registered for it will not fire; read
   * `useCampaignStore.getState().data` instead.
   */
  'campaign:loaded': Campaign;
  /**
   * The visitor submitted the checkout form and the order request is about to go
   * out. Fires before the payment call, so the order does not exist yet.
   */
  'checkout:started': CheckoutData;
  /** The checkout form finished wiring up its fields, validation, and payment. */
  'checkout:form-initialized': {
    /** The form element that was initialized. */
    form: HTMLFormElement;
  };
  /** The Spreedly card iframe is ready to accept card details. */
  'checkout:spreedly-ready': {};
  /**
   * An express checkout flow started.
   *
   * @deprecated Declared but never emitted by this build. Use
   * `express-checkout:initialized`, which is the event the express container
   * actually fires.
   */
  'checkout:express-started': { method: 'paypal' | 'apple_pay' | 'google_pay' };
  /**
   * The page is holding a finished order: it was opened with `?ref_id=` — a
   * success, receipt or upsell page — and the order came back from the orders API.
   *
   * This is the event to hang purchase tracking on, and the only one the SDK's own
   * `dl_purchase` comes from — once per order, see the
   * [analytics events reference](../core/guide/reference/analytics-events.md).
   * The order it carries was fetched back from the API, so it is a real order with
   * a real order number, and for every payment method that finishes at a gateway
   * it is the first point at which the SDK knows the shopper actually paid.
   *
   * **The checkout page does not fire this.** Creating an order is not completing
   * one: an express checkout (PayPal, Apple Pay, Google Pay) and a card payment
   * needing 3-D Secure both leave the checkout page with the money still unmoved,
   * the order carrying a `payment_complete_url` and the shopper redirected to the
   * gateway to finish paying. Reporting a purchase there is issue #71, so nothing
   * is emitted until the shopper lands back on a page that fetches the order. If
   * you need to act the moment an order is *created*, do it in your own submit
   * handler — the SDK has no event for it.
   *
   * Fires on a fresh fetch only. A reload inside the order store's 15-minute
   * window is served from its cache and emits nothing.
   *
   * **It fires on a failed payment's landing page too.** A redirect payment comes
   * back to either `success_url` or `payment_failed_url` and the platform puts
   * `?ref_id=` on both, so the order loads either way. The SDK's own
   * `dl_purchase` tells the two apart; a listener of your own must check for
   * itself — an order still carrying `payment_complete_url` was never paid.
   *
   * @example
   * ```ts
   * window.next.on('order:completed', order => {
   *   console.log('Thank you for order', order.number);
   * });
   * ```
   */
  'order:completed': Order;
  /**
   * The order succeeded but carried no redirect URL, so the SDK could not send
   * the visitor onward. Handle this to avoid stranding them on the checkout page.
   */
  'order:redirect-missing': {
    /** The created order, as returned by the API. */
    order: any;
  };
  /**
   * Something failed. Emitted both by any feature's error handler and by the
   * central error handler, so one subscriber can watch the whole SDK.
   */
  'error:occurred': ErrorData;
  /**
   * The requested currency was not available for this campaign, so prices are
   * shown in another one. Surface this — otherwise the visitor sees prices in a
   * currency they did not ask for, with no explanation.
   *
   * @example
   * ```json
   * {
   *   "requested": "CAD",
   *   "actual": "USD",
   *   "reason": "api"
   * }
   * ```
   */
  'currency:fallback': {
    /** The currency that was asked for. */
    requested: string;
    /** The currency actually being used. */
    actual: string;
    /**
     * Where the fallback was decided: `cached` when a stored campaign supplied
     * it, `api` when the campaign response did.
     */
    reason: 'cached' | 'api';
  };
  /**
   * A countdown timer reached zero.
   *
   * @example
   * ```json
   * { "persistenceId": "flash-sale" }
   * ```
   */
  'timer:expired': {
    /**
     * The timer's persistence id — the key its deadline is stored under, so the
     * countdown survives a reload. Identifies which timer expired.
     */
    persistenceId: string;
  };
  /**
   * SDK configuration changed at runtime.
   *
   * @deprecated Declared but never emitted by this build. Read
   * `useConfigStore.getState()` instead.
   */
  'config:updated': ConfigState;
  /**
   * A discount code was accepted and applied to the cart. The payload carries the
   * full coupon when the SDK has it, and only the code when it does not.
   *
   * @example
   * ```json
   * { "code": "SAVE10" }
   * ```
   */
  'coupon:applied': { coupon: AppliedCoupon } | { code: string };
  /** A previously applied discount code was taken off the cart. */
  'coupon:removed': {
    /** The code that was removed. */
    code: string;
  };
  /**
   * A discount code was rejected — unknown, expired, or not valid for this cart.
   *
   * @example
   * ```json
   * {
   *   "code": "SAVE10",
   *   "message": "This code has expired."
   * }
   * ```
   */
  'coupon:validation-failed': {
    /** The code the visitor entered. */
    code: string;
    /** The reason, already worded for display to the visitor. */
    message: string;
  };
  /**
   * A visitor clicked a card in a selector. Fires after the selection state is
   * updated but before the cart write completes in `swap` mode.
   *
   * @example
   * ```json
   * {
   *   "selectorId": "main-selector",
   *   "packageId": 102,
   *   "previousPackageId": 101,
   *   "mode": "select",
   *   "pendingAction": true
   * }
   * ```
   */
  'selector:item-selected': {
    /** The selector that fired this, matching its `data-next-selector-id`. */
    selectorId: string;
    /** The package on the card the visitor clicked. */
    packageId: number;
    /** The previously selected package, or `undefined` if nothing was selected. */
    previousPackageId: number | undefined;
    /** The selector's mode at click time: `swap` or `select`. */
    mode: string;
    /**
     * `true` in `select` mode, signalling that an external button still has to
     * perform the cart write.
     */
    pendingAction: boolean | undefined;
    /** The full selected item, when the selector could resolve it. */
    item?: SelectorItem;
  };
  /**
   * A selector finished the cart write for a pending selection.
   *
   * @deprecated Declared but never emitted by this build. Listen for
   * `cart:item-added` or `cart:package-swapped` to know the write landed.
   */
  'selector:action-completed': {
    selectorId: string;
    packageId: number;
    previousPackageId: number | undefined;
    mode: string;
  };
  /**
   * The active selection changed. Fires on every selection update — including
   * programmatic ones, such as cart sync auto-selecting an already-in-cart
   * package on load — not only on visitor clicks.
   *
   * @example
   * ```json
   * {
   *   "selectorId": "main-selector",
   *   "packageId": 101,
   *   "quantity": 1
   * }
   * ```
   */
  'selector:selection-changed': {
    /** The selector that fired this. */
    selectorId: string;
    /** The newly selected package. */
    packageId?: number;
    /** The quantity currently set on the selected card. */
    quantity?: number;
    /** The full selected item, when the selector could resolve it. */
    item?: SelectorItem;
  };
  /**
   * A quantity stepper inside a selector card changed that card's quantity. This
   * is the card's own quantity, not a cart line — in `select` mode nothing has
   * been written to the cart yet.
   *
   * @example
   * ```json
   * {
   *   "selectorId": "main-selector",
   *   "packageId": 101,
   *   "quantity": 2
   * }
   * ```
   */
  'selector:quantity-changed': {
    /** The selector that fired this. */
    selectorId: string;
    /** The card whose quantity changed. */
    packageId: number;
    /** The new quantity on that card. */
    quantity: number;
  };
  /**
   * A shipping method was picked in the UI.
   *
   * @deprecated Declared but never emitted by this build. Use
   * `shipping:method-changed`, which the cart fires once the method is applied.
   */
  'shipping:method-selected': { shippingId: string; selectorId: string };
  /**
   * The cart's shipping method changed and totals were recalculated.
   *
   * @example
   * ```json
   * { "methodId": 5 }
   * ```
   */
  'shipping:method-changed': {
    /** The shipping method now applied to the cart. */
    methodId: number;
    /** The full shipping method record, including its price and label. */
    method: any;
  };

  // Action Events
  /**
   * An action feature — an add-to-cart or accept-upsell button — completed its
   * work without throwing. Fires for every such button, so check `action` to tell
   * which one.
   *
   * @example
   * ```json
   * { "action": "AddToCartEnhancer" }
   * ```
   */
  'action:success': {
    /** Class name of the feature that ran, e.g. `AddToCartEnhancer`. */
    action: string;
    /** Extra context, including `element`: the button that was clicked. */
    data?: any;
  };
  /** An action feature threw while running. The button is re-enabled either way. */
  'action:failed': {
    /** Class name of the feature that failed, e.g. `AddToCartEnhancer`. */
    action: string;
    /** The error that was thrown. */
    error: Error;
  };

  // Upsell Events
  /**
   * The visitor accepted a post-purchase upsell and it was added to the existing
   * order. This is the event post-purchase revenue tracking should use — the
   * money is additional to the original `order:completed` value.
   *
   * @example
   * ```json
   * {
   *   "packageId": 77,
   *   "quantity": 1,
   *   "orderId": "abc123",
   *   "value": 29.99,
   *   "discount": 0
   * }
   * ```
   */
  'upsell:accepted': {
    /** The upsell package that was added. */
    packageId: number;
    /** How many units were added. */
    quantity: number;
    /** The order the upsell was attached to. */
    orderId: string;
    /** Item revenue for the accepted line(s), after discounts (post-discount). */
    value?: number;
    /** Total discount applied to the accepted line(s) (pre-discount − value). */
    discount?: number;
    /** Voucher/coupon code applied to the order, when present. */
    coupon?: string;
  };
  /** A card in an upsell offer's built-in selector was chosen. */
  'upsell-selector:item-selected': {
    /** The upsell selector that fired this. */
    selectorId: string;
    /** The package on the chosen card. */
    packageId: number;
  };
  /** The quantity on an upsell offer changed before the visitor accepted it. */
  'upsell:quantity-changed': {
    /**
     * The upsell selector the offer belongs to. Present whenever the offer has
     * one — whichever control changed the quantity — and absent in direct mode.
     * Before 2026-07-31 a quantity-toggle press sent the key with `undefined`,
     * so treat "key present but undefined" as direct mode too if you handle
     * events from an older SDK build.
     */
    selectorId?: string | undefined;
    /** The new quantity. */
    quantity: number;
    /** The package whose quantity changed, when it is known. */
    packageId?: number | undefined;
  };
  /** An option was chosen inside an upsell offer — a variant or a tier. */
  'upsell:option-selected': {
    /** The upsell selector that fired this. */
    selectorId: string;
    /** The package behind the chosen option. */
    packageId: number;
  };

  // Message Events
  /**
   * A message was shown to the visitor.
   *
   * @deprecated Declared but never emitted by this build.
   */
  'message:displayed': { message: string; type: string };

  // Payment Events
  /**
   * Card details were exchanged for a payment token. The raw card number never
   * reaches SDK code — only this token does.
   */
  'payment:tokenized': {
    /** The payment token to submit with the order. */
    token: string;
    /** Payment method metadata returned with the token, e.g. card brand and last four. */
    pmData: any;
    /** Which payment method produced the token. */
    paymentMethod: string;
  };
  /**
   * Payment failed. Fires both for card-field errors before submission and for a
   * declined order attempt.
   *
   * @example
   * ```json
   * { "message": "Your card was declined.", "code": "gateway_declined" }
   * ```
   */
  'payment:error': {
    /**
     * The failure, already worded for display to the visitor. When the payment
     * form reported several problems at once they arrive joined into this one
     * string, in the order the form reported them.
     */
    message: string;
    /** The gateway's response code, when the failure came back from an order attempt. */
    code?: string;
    /** The raw error response, for logging. Absent for card-field errors. */
    details?: unknown;
  };
  /**
   * An express checkout attempt finished.
   *
   * @deprecated Declared but never emitted by this build. Listen for
   * `order:completed`, which fires on the page the shopper lands on afterwards,
   * for express and standard checkout alike.
   */
  'checkout:express-completed': { method: string; success: boolean };
  /**
   * An express checkout attempt failed.
   *
   * @deprecated Declared but never emitted by this build. Listen for
   * `payment:error` or `error:occurred`.
   */
  'checkout:express-failed': { method: string; error: string };

  // Express Checkout Events
  /**
   * An express payment button — PayPal, Apple Pay, Google Pay or Link — rendered
   * and is ready to click. Fires once per available method, so a page offering
   * all four sees it four times.
   */
  'express-checkout:initialized': {
    /** Which express method became available. */
    method: 'paypal' | 'apple_pay' | 'google_pay' | 'link';
    /** The container the button was rendered into. */
    element: HTMLElement;
  };
  /**
   * An express payment method failed to set up.
   *
   * @deprecated Declared but never emitted by this build. Listen for
   * `error:occurred`.
   */
  'express-checkout:error': {
    method: 'paypal' | 'apple_pay' | 'google_pay' | 'link';
    error: string;
  };
  /**
   * The visitor started an express checkout — the button was clicked and the SDK
   * is about to ask the orders API for the order.
   *
   * @remarks
   * `cartTotal` is declared but not sent: the emitting call passes `method` and
   * `itemCount` only. Read the cart store for the total.
   */
  'express-checkout:started': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    cartTotal: { value: number; formatted: string };
    itemCount: number;
  };
  /**
   * An express checkout failed — the order was refused, or the gateway's own
   * fields rejected it. `payment:error` fires alongside it for the errors that
   * carry payment details.
   */
  'express-checkout:failed': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    error: string;
  };
  /**
   * An express checkout produced an order — the orders API accepted it and the
   * SDK is about to redirect the shopper to the payment gateway.
   *
   * **This is not a purchase.** The order it carries has a `payment_complete_url`
   * and no money has moved: the shopper may still cancel at PayPal, or press
   * back. Reporting a conversion here is
   * [issue #71](https://github.com/NextCommerceCo/campaign-cart/issues/71) —
   * hang purchase tracking on
   * {@link EventMap."order:completed" | order:completed} instead, which fires on
   * the success page for the finished order.
   *
   * @remarks
   * The payload wraps the order: `{ method, order }`, not the order itself.
   */
  'express-checkout:completed': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    order: any;
  };
  /**
   * An express order carried no redirect URL.
   *
   * @deprecated Declared but never emitted by this build. Listen for
   * `order:redirect-missing`.
   */
  'express-checkout:redirect-missing': { order: any };

  // Address Autocomplete Events
  /**
   * The visitor picked a suggested address and the form was filled from it. Fires
   * for either autocomplete provider.
   *
   * @example
   * ```json
   * { "type": "shipping" }
   * ```
   */
  'address:autocomplete-filled': {
    /** Which address block was filled. */
    type: 'shipping' | 'billing';
    /** The resolved address parts used to fill the fields. */
    components: any;
  };
  /**
   * Address fields were revealed.
   *
   * @deprecated Declared but never emitted by this build. Use
   * `checkout:location-fields-shown`.
   */
  'address:location-fields-shown': {};
  /**
   * The shipping address fields were revealed — the visitor moved past the
   * collapsed autocomplete input, so state, city, and postcode are now on screen.
   *
   * Also dispatched as a DOM `CustomEvent` on `document`, for code that listens
   * outside the SDK: `document.addEventListener('checkout:location-fields-shown', …)`.
   */
  'checkout:location-fields-shown': {};
  /** The billing address fields were revealed. Also dispatched as a DOM `CustomEvent`. */
  'checkout:billing-location-fields-shown': {};

  // Upsell Events
  /** A post-purchase upsell offer was wired up and is on screen. */
  'upsell:initialized': {
    /** The package being offered. */
    packageId: number;
    /** The offer's container element. */
    element: HTMLElement;
  };
  /** The upsell add request went out. Use it to show a pending state. */
  'upsell:adding': {
    /** The package being added. */
    packageId: number;
  };
  /**
   * The upsell was added to the order. Fires after the API confirms, and before
   * any redirect to the next offer or the receipt.
   *
   * @example
   * ```json
   * {
   *   "packageId": 77,
   *   "quantity": 1,
   *   "value": 29.99,
   *   "willRedirect": true
   * }
   * ```
   */
  'upsell:added': {
    /** The package that was added. */
    packageId: number;
    /** How many units were added. */
    quantity: number;
    /** The updated order, as returned by the API. */
    order: any;
    /** Item revenue for the added line, after discounts. */
    value?: number;
    /**
     * Whether the SDK is about to navigate away. When `true`, finish any tracking
     * synchronously — a handler that awaits will not complete.
     */
    willRedirect?: boolean;
  };
  /** Adding the upsell failed. The offer stays on screen so the visitor can retry. */
  'upsell:error': {
    /** The package that failed to add. */
    packageId: number;
    /** The failure reason. */
    error: string;
  };

  // Accordion Events
  /**
   * An accordion section was toggled. Fires for both directions — read `isOpen`
   * rather than subscribing to the separate opened/closed events.
   */
  'accordion:toggled': {
    /** The section's id. */
    id: string;
    /** `true` when the section is now open. */
    isOpen: boolean;
    /** The section element. */
    element: HTMLElement;
  };
  /** An accordion section opened. */
  'accordion:opened': {
    /** The section's id. */
    id: string;
    /** The section element. */
    element: HTMLElement;
  };
  /** An accordion section closed. */
  'accordion:closed': {
    /** The section's id. */
    id: string;
    /** The section element. */
    element: HTMLElement;
  };
  /** The visitor declined a post-purchase upsell and moved on. */
  'upsell:skipped': {
    /** The package that was declined, when the offer identified one. */
    packageId?: number;
    /** The order the offer belonged to. */
    orderId?: string;
  };
  /**
   * A post-purchase upsell offer became visible to the visitor. Pair it with
   * `upsell:accepted` and `upsell:skipped` to measure offer performance.
   */
  'upsell:viewed': {
    /** The package being offered. */
    packageId?: number;
    /** Path of the page the offer was shown on. */
    pagePath?: string;
    /** The order the offer belonged to. */
    orderId?: string;
  };

  // Exit Intent Events (simplified)
  /** The exit-intent popup was shown — the visitor's pointer left the viewport. */
  'exit-intent:shown': {
    /** Image the popup was rendered with, when it is image-based. */
    imageUrl?: string;
    /** Template the popup was rendered from, when it is template-based. */
    template?: string;
  };
  /** The visitor clicked the exit-intent popup's content, rather than dismissing it. */
  'exit-intent:clicked': {
    /** Image the popup was rendered with. */
    imageUrl?: string;
    /** Template the popup was rendered from. */
    template?: string;
  };
  /**
   * The popup was dismissed — via the close button, the overlay, or the Escape
   * key. Fires alongside `exit-intent:closed`.
   */
  'exit-intent:dismissed': {
    /** Image the popup was rendered with. */
    imageUrl?: string;
    /** Template the popup was rendered from. */
    template?: string;
  };
  /** The popup was removed from the page, whatever the reason. */
  'exit-intent:closed': {
    /** Image the popup was rendered with. */
    imageUrl?: string;
    /** Template the popup was rendered from. */
    template?: string;
  };
  /**
   * The visitor took the popup's offer — usually accepting a discount code.
   *
   * @example
   * ```json
   * {
   *   "action": "accept",
   *   "couponCode": "STAY10"
   * }
   * ```
   */
  'exit-intent:action': {
    /** Which action was taken. */
    action: string;
    /** The code the popup applied, when the action carries one. */
    couponCode?: string;
  };

  // FOMO Events
  /**
   * A social-proof notification was shown — "someone in Denver just bought this".
   * Fires once per notification, on a rotation.
   *
   * @example
   * ```json
   * {
   *   "customer": "Sarah from Denver",
   *   "product": "3-Pack Bundle",
   *   "image": "https://cdn.example.com/pack3.jpg"
   * }
   * ```
   */
  'fomo:shown': {
    /** The customer line as displayed, already formatted. */
    customer: string;
    /** The product name shown in the notification. */
    product: string;
    /** Image shown alongside it. */
    image: string;
  };

  // SDK Events
  /**
   * The SDK finished reading campaign parameters off the page URL — currency,
   * forced package, test mode, attribution. Anything that depends on those values
   * should wait for this rather than reading them at load.
   */
  'sdk:url-parameters-processed': {};

  // Offer Events
  /**
   * An offer was selected.
   *
   * @deprecated Declared but never emitted by this build. Offers moved to a
   * server-side model and the client-side offer features were removed.
   */
  'offer:selected': { offerId: number };
  /**
   * An offer was applied to the cart.
   *
   * @deprecated Declared but never emitted by this build. Offers are applied
   * server-side; read the discounts on `cart:updated` instead.
   */
  'offer:applied': { offerId: number };

  // Bundle Events
  /**
   * A bundle card was chosen. A bundle is several packages bought as one unit, so
   * the payload carries every line the choice implies, not a single package.
   *
   * @example
   * ```json
   * {
   *   "selectorId": "main-bundle",
   *   "items": [
   *     { "packageId": 101, "quantity": 2 },
   *     { "packageId": 105, "quantity": 1 }
   *   ]
   * }
   * ```
   */
  'bundle:selected': {
    /** The bundle selector that fired this. */
    selectorId: string;
    /** Every package the chosen bundle puts in the cart, with quantities. */
    items: { packageId: number; quantity: number }[];
  };
  /**
   * The chosen bundle's contents changed — a different card, a variant swap, or a
   * quantity bump. Fires on every change, including programmatic ones, so it is
   * the event to bind a button or a price display to.
   */
  'bundle:selection-changed': {
    /** The bundle selector that fired this. */
    selectorId: string;
    /** The bundle's packages after the change. */
    items: { packageId: number; quantity: number }[];
  };
  /**
   * The bundle-level quantity stepper changed, multiplying every line in the
   * bundle.
   *
   * @example
   * ```json
   * {
   *   "selectorId": "main-bundle",
   *   "bundleId": "starter",
   *   "quantity": 2,
   *   "items": [{ "packageId": 101, "quantity": 4 }]
   * }
   * ```
   */
  'bundle:quantity-changed': {
    /** The bundle selector that fired this. */
    selectorId: string;
    /** The bundle whose quantity changed. */
    bundleId: string;
    /** The new bundle multiplier. */
    quantity: number;
    /** The resulting package lines, with the multiplier already applied. */
    items: { packageId: number; quantity: number }[];
  };
  /**
   * Bundle prices finished loading and the price slots were filled.
   *
   * Delivered as a DOM `CustomEvent` on `document`, not through the event bus —
   * subscribe with `document.addEventListener('bundle:price-updated', …)`.
   * `next.on()` will not receive it.
   */
  'bundle:price-updated': { selectorId: string };
  /**
   * One selector card's prices finished loading and its raw
   * `data-package-price-*` attributes were written.
   *
   * Delivered as a DOM `CustomEvent` on `document`, not through the event bus —
   * subscribe with `document.addEventListener('selector:price-updated', …)`.
   * `next.on()` will not receive it.
   */
  'selector:price-updated': { selectorId: string; packageId: number };
  /**
   * A package toggle's price finished loading.
   *
   * Delivered as a DOM `CustomEvent` on `document`, not through the event bus.
   */
  'toggle:price-updated': { packageId: number };

  // Package Toggle Events
  /**
   * A package toggle was switched — an add-on like a warranty or express
   * shipping going into or out of the cart.
   *
   * @example
   * ```json
   * { "packageId": 205, "added": true }
   * ```
   */
  'toggle:toggled': {
    /** The package that was toggled. */
    packageId: number;
    /** `true` when it is now in the cart, `false` when it was removed. */
    added: boolean;
  };
  /** The full set of toggled-on packages changed. */
  'toggle:selection-changed': {
    /** Every package currently toggled on. */
    selected: number[];
  };

  // Scroll Hint Events
  /**
   * A scroll hint recalculated whether it should be visible — on scroll, and when
   * the scrollable content resizes.
   *
   * @example
   * ```json
   * {
   *   "isVisible": true,
   *   "scrollTop": 0,
   *   "scrollHeight": 1400,
   *   "clientHeight": 600
   * }
   * ```
   */
  'scroll-hint:updated': {
    /** Whether the hint is showing: the target is at the top and can scroll. */
    isVisible: boolean;
    /** Current scroll offset of the watched element. */
    scrollTop: number;
    /** Full scrollable height of the watched element. */
    scrollHeight: number;
    /** Visible height of the watched element. */
    clientHeight: number;
  };
}

/**
 * One line in the cart — a package the shopper has added, plus every price and
 * product detail the SDK tracks for it. This is the raw stored shape; for the
 * display-ready version with a full pricing breakdown see {@link EnrichedCartLine}.
 */
export interface CartItem {
  /** Unique cart line ID returned by the API. */
  id: number;
  /** The campaign package `ref_id` for this item. */
  packageId: number;
  /** Original package ID before any variant swap was applied. */
  originalPackageId?: number;
  /** Number of packages in the cart (not units — see `qty` for units per package). */
  quantity: number;
  /** Total package price as a raw number (mirrors `price_total` from the campaign). Used for calculations. */
  price: number;
  /** Product image URL. */
  image: string | undefined;
  /** Package display name. */
  title: string;
  /** Product SKU. */
  sku: string | undefined;
  /** `true` when this item was added via a post-purchase upsell, not a regular add-to-cart. */
  is_upsell: boolean | undefined;
  /** Per-unit price as a formatted string (matches `price` from the campaign API). */
  price_per_unit?: string | undefined;
  /** Number of product units included in this package (matches `qty` from the campaign API). */
  qty?: number | undefined;
  /** Total package price as a formatted string (matches `price_total` from the campaign API). */
  price_total?: string | undefined;
  /** Per-unit retail/compare-at price as a formatted string. */
  price_retail?: string | undefined;
  /** Total retail/compare-at price as a formatted string. */
  price_retail_total?: string | undefined;
  /** Recurring per-unit price string. Present when `is_recurring` is `true`. */
  price_recurring?: string | undefined;
  /** Total recurring price string. */
  price_recurring_total?: string | undefined;
  /** Per-unit price after offer discounts. */
  unit_price?: string | undefined;
  /** Per-unit price before offer discounts. */
  original_unit_price?: string | undefined;
  /** Total package price after offer discounts. */
  package_price?: string | undefined;
  /** Total package price before offer discounts. */
  original_package_price?: string | undefined;
  /** Total line amount as a formatted string. */
  total?: string | undefined;
  /** Total discount amount for this line as a formatted string. */
  total_discount?: string | undefined;
  /** Offer discounts applied to this line. */
  discounts?:
    | Array<{
        offer_id: number;
        amount: string;
        description?: string;
        name?: string;
      }>
    | undefined;
  /** `true` for subscription/recurring items. Check `interval` and `interval_count` for billing cycle details. */
  is_recurring?: boolean | undefined;
  /** Billing interval for recurring items (`'day'` or `'month'`). */
  interval?: string | null | undefined;
  /** Number of intervals between billing cycles (e.g. `3` with `interval: 'month'` = every 3 months). */
  interval_count?: number | null | undefined;
  /** Associated product ID. */
  productId?: number | undefined;
  /** Associated product display name. */
  productName?: string | undefined;
  /** Product variant ID. */
  variantId?: number | undefined;
  /** Product variant display name. */
  variantName?: string | undefined;
  /** Variant attribute values (e.g. `[{ code: 'color', name: 'Color', value: 'Red' }]`). */
  variantAttributes?:
    | Array<{ code: string; name: string; value: string }>
    | undefined;
  /** Variant SKU. */
  variantSku?: string | undefined;
  /** IDs of other cart items grouped with this one (bundle support). */
  groupedItemIds?: number[] | undefined;
  /** Selector ID this item belongs to (set by BundleSelectorEnhancer via data-next-selector-id). */
  selectorId?: string | undefined;
  /** Custom key-value properties for this line item. Two items with the same packageId but different properties are treated as separate lines. */
  properties?: Record<string, string>;
}

/**
 * A single discount applied to the cart, an item, or shipping — whether from an
 * offer or a voucher. Appears in {@link CartState.offerDiscounts},
 * {@link CartState.voucherDiscounts}, and {@link ShippingMethod.discounts}.
 */
export interface Discount {
  /** ID of the offer that generated this discount. */
  offer_id?: number;
  /** Discount amount as a formatted string (e.g. "$10.00"). */
  amount: string;
  /** Optional description of the discount (e.g. "10% off"). */
  description?: string;
  /** Optional name of the discount (e.g. "Spring Sale"). */
  name?: string;
  /** Optional discount percentage as a numeric string (e.g. "10" or "10.00"). */
  percentage?: string;
}

/**
 * One selectable option inside a package selector — the data behind a single
 * card the shopper can pick. Emitted on `selector:item-selected` and related
 * events so handlers know which package a card represents.
 */
export interface SelectorItem {
  /** The card's DOM element. */
  element: HTMLElement;
  /** The package `ref_id` this card selects. */
  packageId: number;
  /** Quantity this card adds when selected. */
  quantity: number;
  /** Unit price for the card, or `undefined` if not resolved yet. */
  price: number | undefined;
  /** Display name for the card, or `undefined` if none. */
  name: string | undefined;
  /** `true` if this card was marked selected in the markup on load. */
  isPreSelected: boolean;
  /** Shipping method id tied to this card, if any. */
  shippingId: string | undefined;
}

/**
 * The full cart snapshot — items, totals, discounts, and shipping — as held in
 * {@link useCartStore} and delivered with every `cart:updated` event. This is
 * what you read to render prices, item counts, and totals.
 */
export interface CartState {
  /** All items currently in the cart. */
  items: CartItem[];
  /** Cart items enriched with full pricing breakdown for display. See `EnrichedCartLine`. */
  enrichedItems: EnrichedCartLine[];
  /** Total unit count across all items (sum of each item's `quantity × qty`). */
  totalQuantity: number;
  /** `true` when the cart has no items. */
  isEmpty: boolean;
  /** List of applied coupon codes. */
  vouchers: string[];
  /** `true` while a package swap animation is in progress. Use to prevent double-clicks. */
  swapInProgress?: boolean;
  /** ISO currency code of cart data. */
  currency?: string;
  /** Detailed offer information for offers applied to the cart. */
  offerDiscounts?: Discount[];
  /** Detailed voucher information for vouchers applied to the cart. */
  voucherDiscounts?: Discount[];
  /** Cart subtotal before shipping and discounts. */
  subtotal: Decimal;
  /** The currently selected shipping method and its pricing details. */
  shippingMethod?: ShippingMethod;
  /** `true` when any discount (coupon or offer) is applied. */
  hasDiscounts: boolean;
  /** Total discount amount from coupons and offers. */
  totalDiscount: Decimal;
  /** Total discount as a percentage of the subtotal. */
  totalDiscountPercentage: Decimal;
  /** Cart grand total (subtotal + shipping − discounts). */
  total: Decimal;
  /** Raw CartSummary response from the API calculate endpoint. */
  summary?: import('./api').CartSummary;
  /** `true` while the calculate API is in flight. Use to show loading state on price/total fields. */
  isCalculating: boolean;
}

/**
 * A cart line prepared for display: the same item as {@link CartItem} but with
 * a structured price breakdown (with/without tax, original, savings) and product
 * details ready to render. This is what `data-next-display` fields read from.
 */
export interface EnrichedCartLine {
  /** Cart line ID (matches {@link CartItem.id}). */
  id: number;
  /** The package `ref_id` for this line. */
  packageId: number;
  /** Number of packages on this line. */
  quantity: number;
  /** Price breakdown, each as a raw `value` and a display `formatted` string. */
  price: {
    /** Line price excluding tax. */
    excl_tax: { value: number; formatted: string };
    /** Line price including tax. */
    incl_tax: { value: number; formatted: string };
    /** Original (compare-at) price before discounts. */
    original: { value: number; formatted: string };
    /** Amount saved versus the original price. */
    savings: { value: number; formatted: string };
  };
  /** Product details for rendering. */
  product: {
    title: string;
    sku: string;
    image: string;
  };
  /** `true` if added via a post-purchase upsell. */
  is_upsell: boolean;
  /** `true` for subscription/recurring lines. */
  is_recurring: boolean;
  /** Billing interval for recurring lines. */
  interval?: 'day' | 'month';
  /** `true` if this line is part of a bundle. */
  is_bundle: boolean;
  /** Cart line IDs of the bundle's other components, when `is_bundle`. */
  bundleComponents?: number[];
}

/**
 * The campaign a page is selling — its packages, pricing currency, shipping
 * options, and the payment/currency/country choices available to the shopper.
 * Loaded once at init and held in {@link useCampaignStore} (on its `.data`
 * field), and delivered with the `campaign:loaded` event.
 */
export interface Campaign {
  /** Internal NEXT campaign id. */
  id?: number;
  /** ISO currency code all package prices are quoted in. */
  currency: string;
  /** Campaign language code (e.g. `"en"`). */
  language: string;
  /** Campaign display name. */
  name: string;
  /** Every package (offer) the campaign sells. */
  packages: Package[];
  /** Public key used to initialise the payment gateway. */
  payment_env_key: string;
  /** Shipping options the shopper can choose from. */
  shipping_methods: ShippingOption[];
  /** Offers/discount rules configured for the campaign, if any. */
  offers?: Offer[];
  /** Currencies the shopper may switch between, with display labels. */
  available_currencies?: Array<{ code: string; label: string }>;
  /** Countries the campaign can ship to, with display labels. */
  available_shipping_countries?: Array<{ code: string; label: string }>;
  /** Express payment methods enabled (PayPal, Apple Pay, …). */
  available_express_payment_methods?: Array<{ code: string; label: string }>;
  /** Standard payment methods enabled for checkout. */
  available_payment_methods?: Array<{ code: string; label: string }>;
}

/**
 * A single purchasable package (offer) within a {@link Campaign} — one buyable
 * unit with its own pricing, product, and recurring/variant details. `ref_id`
 * is the id you pass everywhere else (add-to-cart, selectors, `data-next-package-id`).
 */
export interface Package {
  /** The package id used throughout the SDK (add-to-cart, selectors, attributes). */
  ref_id: number;
  /** The store's external/catalog id for this package. */
  external_id: number;
  /** Package display name. */
  name: string;
  /** Per-unit price as a formatted string. */
  price: string;
  /** Total package price (all units) as a formatted string. */
  price_total: string;
  /** Per-unit retail/compare-at price, if set. */
  price_retail?: string;
  /** Total retail/compare-at price, if set. */
  price_retail_total?: string;
  /** Recurring per-unit price, for subscription packages. */
  price_recurring?: string;
  /** Total recurring price, for subscription packages. */
  price_recurring_total?: string;
  /** Number of product units included in the package. */
  qty: number;
  /** Product image URL. */
  image: string;
  /** `true` if this is a subscription/recurring package. */
  is_recurring: boolean;
  /** Billing interval for recurring packages. */
  interval?: 'day' | 'month' | null;
  /** Number of intervals between billing cycles. */
  interval_count?: number | null;
  /** Product variant id, when the package maps to a specific variant. */
  product_variant_id?: number;
  /** Product variant display name. */
  product_variant_name?: string;
  /** Underlying product id. */
  product_id?: number;
  /** Underlying product display name. */
  product_name?: string;
  /** Product SKU, or `null` if none. */
  product_sku?: string | null;
  /** Whether the product can currently be purchased. */
  product_purchase_availability?: string;
  /** Whether the product is currently in stock. */
  product_inventory_availability?: string;
}

/**
 * A shipping choice offered by a {@link Campaign}, as returned by the API. Its
 * `ref_id` is what a shopper's selection resolves to; the richer runtime form
 * with computed discounts is {@link ShippingMethod}.
 */
export interface ShippingOption {
  /** Shipping option id. */
  ref_id: number;
  /** Shipping option code (matches the campaign API). */
  code: string;
  /** Shipping price as a formatted string. */
  price: string;
}

/**
 * Google Maps settings for address autocomplete on checkout forms. Optional —
 * autocomplete is off unless an API key is supplied.
 */
export interface GoogleMapsConfig {
  /** Google Maps API key. Autocomplete stays disabled without it. */
  apiKey?: string;
  /** Region bias for autocomplete results (e.g. `"US"`). */
  region?: string;
  /** Master switch for address autocomplete. */
  enableAutocomplete?: boolean;
  /** Extra options passed through to the Google autocomplete widget. */
  autocompleteOptions?: any;
}

/**
 * How the checkout address form behaves — default country, which countries and
 * states to show, and whether to autocomplete. All fields are optional; sensible
 * defaults are derived from the campaign's shipping countries.
 */
export interface AddressConfig {
  /**
   * Fallback country when detected country is not available (Low priority fallback).
   *
   * Automatic fallback priority:
   * 1. United States (US) - if available in shipping countries
   * 2. First country in available list - if US not available
   * 3. This defaultCountry - only if list is empty (edge case)
   *
   * @example "US"
   * @default undefined (auto-fallback to US or first available country)
   */
  defaultCountry?: string;

  /**
   * @deprecated Use campaign API's available_shipping_countries instead.
   * Countries are now automatically filtered based on your campaign configuration.
   * This field is kept for backward compatibility only (Priority 3 fallback).
   * @example ["US", "CA", "GB"]
   */
  showCountries?: string[];

  /**
   * Array of state/province codes to hide from dropdowns (e.g., US territories).
   * @example ["AS", "GU", "PR", "VI"]
   */
  dontShowStates?: string[];

  /**
   * Custom countries list with full control over code and name.
   * Takes priority over showCountries but not over campaign API countries.
   * @example [{ code: "US", name: "United States" }]
   */
  countries?: Array<{
    code: string;
    name: string;
  }>;

  enableAutocomplete?: boolean;
}

/**
 * Everything a page can configure about the SDK.
 *
 * You write these keys on `window.nextConfig` before the loader script runs. Some
 * also have a `<meta name="next-*">` equivalent, and where both exist the meta tag
 * wins, because `loadFromWindow()` runs first and `loadFromMeta()` overwrites it
 * (`core/sdk-initializer.ts › SDKInitializer.initialize`).
 *
 * Fields marked "the SDK fills this in" are readable at runtime but are not yours
 * to set. Writing them on `window.nextConfig` has no effect.
 *
 * @example
 * ```html
 * <script>
 *   window.nextConfig = {
 *     apiKey: "{YOUR_CAMPAIGN_API_KEY}",
 *     storeName: "acme",
 *     currencyBehavior: "auto",
 *     analytics: { enabled: true, mode: "auto", debug: false, providers: {} }
 *   };
 * </script>
 * <script src="/next-campaign-cart.js" type="module"></script>
 * ```
 *
 * @category Core
 */
export interface ConfigState {
  /**
   * The campaign API key every request authenticates with.
   *
   * Also settable as `<meta name="next-api-key">`, which wins over this value. An
   * empty string means the SDK never found a key, so no prices load and no order
   * can be placed.
   *
   * A leftover meta tag silently overriding the key here is the usual cause of a
   * page loading the wrong campaign. Check the markup before anything else.
   *
   * @example "{YOUR_CAMPAIGN_API_KEY}"
   */
  apiKey: string;

  /**
   * A campaign identifier shown in the debug panel.
   *
   * Nothing in the SDK sends it: requests identify the campaign from {@link ConfigState.apiKey}
   * alone. Setting it does not point the page at a different campaign.
   *
   * @example "winter-sale"
   * @default "" (not supplied)
   */
  campaignId: string;

  /**
   * Turns on verbose SDK logging in the browser console.
   *
   * Also turned on by `<meta name="next-debug" content="true">` or `?debugger=true`
   * in the URL. Leave it off for shopper traffic.
   *
   * @example true
   * @default false
   */
  debug: boolean;

  /**
   * Opens the on-page debug overlay at boot.
   *
   * The overlay also reads `?debugger=true` and `window.nextConfig.debugger`
   * directly, so changing this value after boot does not open or close it.
   *
   * @example true
   * @default false
   */
  debugger: boolean | undefined;

  /**
   * Which stage of the funnel this page is.
   *
   * Analytics reports it as `page_type`, so a mislabelled page files its events
   * under the wrong funnel step. Prefer the meta tag, which wins over this value.
   *
   * @example "checkout"
   * @see {@link PageType}
   */
  pageType: PageType;

  /**
   * The store identifier used to deduplicate purchases against a server-side copy
   * of the same order.
   *
   * Required by the NEXT Storefront Meta App: with it set, the Meta event carries
   * `eventID: "{storeName}-{orderNumber}"`. Leave it unset and browser and server
   * events count the same order twice.
   *
   * @example "acme"
   */
  storeName?: string;

  /**
   * The key that authorises the hosted credit-card fields.
   *
   * `undefined` means the card fields cannot start, so card payment is unavailable
   * and only express or pay-later methods work. Once the campaign loads its own
   * `payment_env_key` overwrites whatever was set here, so check the campaign
   * response before the page markup when the card fields use an unexpected key.
   */
  spreedlyEnvironmentKey?: string | undefined;

  /**
   * Express checkout and card field behaviour.
   *
   * Accepted on `window.nextConfig` as either `paymentConfig` or `payment`.
   *
   * @example
   * ```js
   * paymentConfig: {
   *   expressCheckout: {
   *     enabled: true,
   *     methodOrder: ["paypal", "apple_pay", "google_pay"]
   *   }
   * }
   * ```
   * @see {@link PaymentConfig}
   */
  paymentConfig: PaymentConfig;

  /**
   * Google Maps address autocomplete settings.
   *
   * Written as `googleMaps` on `window.nextConfig`. Leave `apiKey` empty to use the
   * NEXT autocomplete instead; a non-empty key takes priority over it.
   *
   * @example
   * ```js
   * googleMaps: { apiKey: "{GOOGLE_MAPS_API_KEY}", region: "US" }
   * ```
   * @see {@link GoogleMapsConfig}
   */
  googleMapsConfig: GoogleMapsConfig;

  /**
   * How the checkout address form behaves.
   *
   * @example
   * ```js
   * addressConfig: { dontShowStates: ["AS", "GU", "PR", "VI"], enableAutocomplete: true }
   * ```
   * @see {@link AddressConfig}
   */
  addressConfig: AddressConfig;

  /** The visitor's country, as geo-detected at boot. The SDK fills this in. */
  detectedCountry?: string;

  /** The currency geo-detection chose for the visitor. The SDK fills this in. */
  detectedCurrency?: string;

  /** The visitor's IP address, from geo-detection. The SDK fills this in. */
  detectedIp?: string;

  /**
   * The currency the visitor is actually being charged in, held for the whole
   * session. The SDK fills this in from `?currency=`, a stored session value, or
   * geo-detection, in that order.
   */
  selectedCurrency?: string;

  /** The raw geo-detection response. The SDK fills this in. */
  locationData?: any;

  /**
   * Whether the SDK may change currency when the visitor's country changes.
   *
   * `"auto"` geo-detects on first load when no `?currency=` parameter and no stored
   * currency exist, then locks that currency for the session. `"manual"` never
   * auto-detects and falls back to the campaign default.
   *
   * @example "manual"
   * @default "auto"
   */
  currencyBehavior?: 'auto' | 'manual';

  /**
   * Whether the requested currency was unavailable and a fallback was used. The
   * SDK fills this in.
   */
  currencyFallbackOccurred?: boolean;

  /**
   * Keeps two campaigns on one domain from sharing a cart.
   *
   * The SDK derives a scope from the API key and the folder the page is served
   * from, so you do not normally set this. Reach for it when a funnel's pages sit
   * at different depths (`/hu/` and `/hu/checkout`), which derives two scopes and
   * loses the cart between them. Pages that must share a cart declare the same
   * value; pages that must not declare different ones.
   *
   * Also settable as `<meta name="next-storage-scope">`. Unlike every other key
   * here, this value wins over the meta tag. It is read while the storage modules
   * are created, so it must be set before the loader script runs.
   *
   * @example "hu-earbuds"
   * @default undefined (derived from the API key and page path)
   */
  storageScope?: string;

  /**
   * BCP 47 tag that pins how prices are written — `"de-DE"`, `"fr-FR"`, `"en-US"`.
   *
   * The locale, not the currency code, decides the decimal separator and which side the
   * symbol sits on: the same `EUR` amount is `€69.99` under `en-US` and `69,99 €` under
   * `de-DE`. Set this when a store must render the same way for every visitor.
   *
   * Leave it unset and the visitor's own browser locale is used, which is usually what you
   * want — a German shopper already sees `69,99 €`. Pin it only when the store's format
   * must not follow the browser.
   *
   * An unparseable tag (`"de_DE"` with an underscore is the common typo) is rejected with a
   * warning and the browser locale is used instead, so a bad value never breaks prices.
   *
   * @example "de-DE"
   * @default undefined (use the browser's locale)
   */
  locale?: string;

  // Additional configuration properties for complete type coverage
  autoInit: boolean | undefined;
  rateLimit: number | undefined;
  cacheTtl: number | undefined;
  retryAttempts: number | undefined;
  timeout: number | undefined;
  testMode: boolean | undefined;

  // API and performance settings
  maxRetries: number | undefined;
  requestTimeout: number | undefined;
  enableAnalytics: boolean | undefined;
  enableDebugMode: boolean | undefined;

  // Environment and deployment settings
  environment: 'development' | 'staging' | 'production' | undefined;
  version?: string | undefined;
  buildTimestamp?: string | undefined;

  // Discount system
  discounts: Record<string, DiscountDefinition>;

  // Attribution configuration
  utmTransfer?: {
    enabled: boolean;
    applyToExternalLinks?: boolean;
    excludedDomains?: string[];
    paramsToCopy?: string[];
  };

  // Tracking configuration (legacy)
  tracking?: 'auto' | 'manual' | 'disabled';

  // New analytics configuration
  analytics?: {
    enabled: boolean;
    mode: 'auto' | 'manual' | 'disabled';
    debug: boolean;
    providers: {
      gtm: {
        enabled: boolean;
        settings: {
          containerId?: string;
          dataLayerName?: string;
          environment?: string;
        };
      };
      facebook: {
        enabled: boolean;
        settings: {
          pixelId: string;
          accessToken?: string;
          testEventCode?: string;
        };
        blockedEvents?: string[];
      };
      custom: {
        enabled: boolean;
        settings: {
          endpoint: string;
          apiKey?: string;
          batchSize?: number;
          timeout?: number;
        };
      };
    };
  };

  // Error monitoring configuration - removed
  // Error tracking can be added externally via HTML/scripts

  // Cart initialization behavior
  clearCartOnInit?: boolean;
}

/**
 * Which stage of the funnel a page represents. Drives page-specific behavior and
 * analytics.
 *
 * Set with `<meta name="next-page-type" content="checkout">`, or with
 * `window.nextConfig.pageType` — the meta tag wins over the config. It is a meta
 * tag only: there is no element attribute for it, and a value written that way is
 * never read.
 *
 * @example
 * ```html
 * <meta name="next-page-type" content="upsell">
 * ```
 */
export type PageType = 'product' | 'cart' | 'checkout' | 'upsell' | 'receipt';

/**
 * Configuration for the hosted (iFrame-based) credit-card input fields — keyboard
 * type, formatting, labels, styling, and the security tokens required to
 * authenticate the fields. Previously named `SpreedlyConfig`; {@link SpreedlyConfig}
 * remains as an alias.
 */
export interface CardInputConfig {
  // Field type configuration - controls keyboard display on mobile
  fieldType?: {
    number?: 'number' | 'text' | 'tel';
    cvv?: 'number' | 'text' | 'tel';
  };

  // Number format configuration
  numberFormat?: 'prettyFormat' | 'plainFormat' | 'maskedFormat';

  // Label configuration for accessibility
  labels?: {
    number?: string;
    cvv?: string;
  };

  // Title attribute for accessibility
  titles?: {
    number?: string;
    cvv?: string;
  };

  // Placeholder text
  placeholders?: {
    number?: string;
    cvv?: string;
  };

  // CSS styling for iFrame fields
  styles?: {
    number?: string;
    cvv?: string;
    placeholder?: string;
  };

  // Security parameters - REQUIRED for authentication
  nonce?: string; // Unique per session (e.g., UUID)
  timestamp?: string; // Epoch time
  certificateToken?: string; // Spreedly certificate token
  signature?: string; // Server-generated signature

  // Fraud detection
  fraud?: boolean | { siteId: string }; // Enable fraud detection or specify BYOC fraud site ID

  // Other options
  enableAutoComplete?: boolean; // Toggle autocomplete functionality
  requiredAttributes?: {
    number?: boolean;
    cvv?: boolean;
  };

  // Validation parameters
  allowBlankName?: boolean; // Skip name validation
  allowExpiredDate?: boolean; // Allow expired dates
}

/**
 * @deprecated Use {@link CardInputConfig}. Kept as an alias for backward
 * compatibility — the two are identical.
 */
export type SpreedlyConfig = CardInputConfig;

/**
 * Payment setup for checkout — the card-input configuration plus which express
 * methods (PayPal, Apple Pay, Google Pay) are enabled and how they behave.
 */
export interface PaymentConfig {
  // Generic card input configuration (preferred)
  cardInputConfig?: CardInputConfig;
  // Legacy naming - maintained for backward compatibility
  spreedly?: CardInputConfig;

  expressCheckout?: {
    enabled: boolean;
    /**
     * Which express buttons to offer, when the campaign does not say.
     *
     * Write the method names with underscores — `apple_pay`, `google_pay` — the
     * same as `methodOrder` beside them and as every other place the SDK names a
     * payment method. `applePay`/`googlePay` are the older camelCase spellings and
     * still work; a method turned on under either key is turned on.
     */
    methods: {
      paypal?: boolean;
      apple_pay?: boolean;
      google_pay?: boolean;
      link?: boolean;
      /** @deprecated Write `apple_pay`. Still read, so existing config keeps working. */
      applePay?: boolean;
      /** @deprecated Write `google_pay`. Still read, so existing config keeps working. */
      googlePay?: boolean;
    };
    methodOrder?: ('paypal' | 'apple_pay' | 'google_pay' | 'link')[]; // Order in which payment methods should be displayed
    requireValidation?: boolean; // If true, express payment methods in combo form will require form validation
    requiredFields?: string[]; // List of fields required for express checkout (e.g., ['email', 'fname', 'lname'])
  };
}

/**
 * The lifecycle hooks you can register a callback for — points in the render and
 * checkout flow where the SDK will invoke your function with {@link CallbackData}.
 */
export type CallbackType =
  | 'beforeRender'
  | 'afterRender'
  | 'beforeCheckout'
  | 'afterCheckout'
  | 'beforeRedirect'
  | 'itemAdded'
  | 'itemRemoved'
  | 'cartCleared';

/**
 * The snapshot passed to a lifecycle callback ({@link CallbackType}) — the
 * current cart lines, totals, campaign data, and applied vouchers at the moment
 * the hook fires.
 */
export interface CallbackData {
  /** Display-ready cart lines at the time the hook fires. */
  cartLines: EnrichedCartLine[];
  /** The totals slice of {@link CartState}. */
  cartTotals: Pick<
    CartState,
    | 'subtotal'
    | 'total'
    | 'hasDiscounts'
    | 'totalDiscount'
    | 'totalDiscountPercentage'
    | 'shippingMethod'
  >;
  campaignData: Campaign | null;
  vouchers: string[];
}

/**
 * The rules that define a discount code — its type, value, what it applies to,
 * and any limits. These are configured up front; when a shopper enters a code
 * that matches one, it becomes an {@link AppliedCoupon}.
 */
export interface DiscountDefinition {
  /** The code a shopper enters (e.g. `"SAVE10"`). */
  code: string;
  /** Whether `value` is a percentage or a fixed amount. */
  type: 'percentage' | 'fixed';
  /** The discount amount — a percent (e.g. `10`) or a currency amount. */
  value: number;
  /** Whether the discount applies to the whole order or specific packages. */
  scope: 'order' | 'package';
  /** Packages the discount applies to, when `scope` is `'package'`. */
  packageIds?: number[];
  /** Minimum order value required for the code to apply. */
  minOrderValue?: number;
  /** Cap on the discount amount, for percentage discounts. */
  maxDiscount?: number;
  /** Human-readable description of the discount. */
  description?: string;
  /** Maximum number of times the code may be used. */
  usageLimit?: number;
  /** Whether this code can be combined with other coupons. */
  combinable?: boolean;
}

/**
 * A discount code the shopper has successfully applied — its code, the computed
 * discount amount, and the {@link DiscountDefinition} it matched.
 */
export interface AppliedCoupon {
  /** The applied code. */
  code: string;
  /** The calculated discount amount for the current cart. */
  discount: number;
  /** The rule this code matched. */
  definition: DiscountDefinition;
}

/**
 * @deprecated Legacy coupon shape kept for backward compatibility. New code uses
 * {@link AppliedCoupon} / {@link DiscountDefinition}.
 */
export interface Coupon {
  code: string;
  amount: number;
  type: 'fixed' | 'percentage';
}

/**
 * The shipping method currently applied to the cart, with fully computed pricing
 * (original price, discount, final price). The runtime counterpart to the
 * campaign's {@link ShippingOption}.
 */
export interface ShippingMethod {
  /** Shipping method ID. */
  id: number;
  /** Shipping method display name. */
  name: string;
  /** Shipping method code (matches campaign API). */
  code: string;
  /** Original shipping price before any discount. */
  originalPrice: Decimal;
  /** Final shipping price after discount. */
  price: Decimal;
  /** Absolute discount applied to shipping. */
  discountAmount: Decimal;
  /** Shipping discount as a percentage of the original price. */
  discountPercentage: Decimal;
  /** `true` when a shipping discount is applied. */
  hasDiscounts: boolean;
  /** Detailed shipping discounts applied to the cart. */
  discounts?: Discount[];
}

/**
 * The ways of paying this SDK release knows by name, in its own spelling.
 *
 * Not the same vocabulary as the markup or the API, and all three differ on the
 * card entry alone: a radio says `credit`, this type says `credit-card`, and the
 * orders API is sent `card_token`. The SDK translates in both directions, so a
 * page never spells an API value and a listener never sees a markup one.
 *
 * Everything after `klarna` is a **redirect method**: there is no form to fill in
 * and no token to collect, so the order is created with the method on it and the
 * API answers with a `payment_complete_url` for the shopper to finish paying at.
 * See {@link Order.payment_complete_url}.
 */
export type KnownCheckoutPaymentMethod =
  | 'card_token'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay'
  | 'credit-card'
  | 'klarna'
  | 'affirm'
  | 'bancontact'
  | 'giropay'
  | 'ideal'
  | 'link'
  | 'sepa_debit'
  | 'sofort'
  | 'swish'
  | 'twint';

/**
 * The method the shopper chose: one the SDK knows by name, or any other name the
 * page offered.
 *
 * The open end is deliberate. A store can be given a new way to pay before this
 * SDK release knows about it, so a name that is not on the list is **passed
 * through to the orders API** rather than replaced with a card — the API decides
 * whether it can charge that way. See {@link KnownCheckoutPaymentMethod} for the
 * names the SDK does recognise, which are the ones an editor will suggest.
 */
export type CheckoutPaymentMethod = KnownCheckoutPaymentMethod | (string & {});

/**
 * The state of the checkout in progress — the collected form values, chosen
 * payment method, and which step the shopper is on. Delivered with the
 * `checkout:started` event.
 */
export interface CheckoutData {
  /** Collected checkout form field values, keyed by field name. */
  formData: Record<string, any>;
  /** The payment method the shopper selected. */
  paymentMethod: CheckoutPaymentMethod;
  /** `true` while the order is being submitted. */
  isProcessing?: boolean;
  /** Current step index in a multi-step checkout. */
  step?: number;
}

/**
 * The six fields you can always count on being present on a completed order —
 * enough to identify it, show its total, and link to its receipt.
 *
 * A narrow, older view of {@link Order}, kept exported because integrations import
 * it. **No event declares this payload any more:** `order:completed` carries the
 * full `Order`, so a listener gets totals excluding tax, tax, shipping, discounts,
 * addresses, attribution and typed lines without reaching for anything else. Use
 * `Order` in new code; the same object is on `useOrderStore().order`.
 *
 * The field list is pinned to `Order` by the compiler (`extends Pick<Order, …>`),
 * so the two declarations cannot drift apart.
 *
 * @example
 * ```ts
 * // `Order` is a superset, so an OrderData-typed helper still accepts the payload.
 * function receiptLine(order: OrderData): string {
 *   return `${order.number} — ${order.total_incl_tax} ${order.currency}`;
 * }
 *
 * window.next.on('order:completed', order => console.log(receiptLine(order)));
 * ```
 */
export interface OrderData
  extends Pick<
    Order,
    | 'ref_id'
    | 'number'
    | 'currency'
    | 'total_incl_tax'
    | 'order_status_url'
    | 'is_test'
  > {
  /** Order reference id — used to fetch the order and add upsells. */
  ref_id: string;
  /** Human-facing order number. */
  number: string;
  /** ISO currency code the order was placed in. */
  currency: string;
  /** Order grand total including tax, as a formatted string. */
  total_incl_tax: string;
  /** URL of the hosted order-status/receipt page. */
  order_status_url: string;
  /** `true` for test-mode orders (not real purchases). */
  is_test: boolean;
  /**
   * Order line items. Loosely typed for backwards compatibility — the runtime
   * value is {@link Order.lines}, so read it through {@link Order} to get
   * `product_title`, `quantity`, `is_upsell` and the per-line prices typed.
   */
  lines?: any[];
  /**
   * Customer details attached to the order. Loosely typed for backwards
   * compatibility — the runtime value is {@link Order.user} ({@link OrderUser}).
   */
  user?: any;
}

/**
 * The payload of an `error:occurred` event — a human-readable message plus an
 * optional machine code and extra details for debugging.
 */
export interface ErrorData {
  /** Human-readable error message. */
  message: string;
  /** Machine-readable error code, when available. */
  code?: string;
  /** Extra context about the error, when available. */
  details?: any;
}
