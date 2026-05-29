/**
 * Global type definitions for the SDK
 */

import type { Decimal } from 'decimal.js';
import type { Offer } from './campaign';

import { AddressAutocompleteResult } from './api';

/**
 * Type-safe map of every SDK event name to its payload shape.
 *
 * Used by {@link NextCommerce.on} / {@link NextCommerce.off} and the EventBus so
 * that subscribing to an event gives you a correctly-typed payload. Events are
 * grouped by domain below (cart, checkout, order, selector, upsell, …).
 *
 * @example
 * ```ts
 * next.on('cart:updated', (cart) => {
 *   console.log('New total quantity:', cart.totalQuantity);
 * });
 * ```
 */
export interface EventMap {
  /**
   * Fires whenever the cart store changes — items, quantities, coupons, shipping, or recalculated totals. Payload is the full cart state.
   *
   * @example
   * ```ts
   * next.on('cart:updated', (cart) => {
   *   // cart.items, cart.totalQuantity, cart.total, cart.vouchers, cart.isEmpty
   * });
   * ```
   */
  'cart:updated': CartState;
  /**
   * A package was added to the cart (or its quantity increased from zero).
   *
   * @example
   * ```ts
   * next.on('cart:item-added', (payload) => {
   *   // payload = { packageId: 2, quantity: 1, source: 'selector' }
   * });
   * ```
   */
  'cart:item-added': { packageId: number; quantity?: number; source?: string };
  /**
   * A package was removed from the cart entirely.
   *
   * @example
   * ```ts
   * next.on('cart:item-removed', (payload) => {
   *   // payload = { packageId: 2 }
   * });
   * ```
   */
  'cart:item-removed': { packageId: number };
  /**
   * The quantity of an existing cart line changed. Includes both the new and previous quantity.
   *
   * @example
   * ```ts
   * next.on('cart:quantity-changed', (payload) => {
   *   // payload = { packageId: 2, quantity: 3, oldQuantity: 1 }
   * });
   * ```
   */
  'cart:quantity-changed': {
    packageId: number;
    quantity: number;
    oldQuantity: number;
  };
  /**
   * One package was swapped for another in place (e.g. a selector switching the chosen offer), with the price delta between them.
   *
   * @example
   * ```ts
   * next.on('cart:package-swapped', (payload) => {
   *   // payload = {
   *   //   previousPackageId: 2,
   *   //   newPackageId: 5,
   *   //   priceDifference: 10,
   *   //   source: 'selector'
   *   // }
   * });
   * ```
   */
  'cart:package-swapped': {
    previousPackageId: number;
    newPackageId: number;
    previousItem?: CartItem;
    newItem?: CartItem;
    priceDifference: number;
    source?: string;
  };
  /**
   * The campaign (packages, offers, shipping methods) finished loading into the campaign store.
   *
   * @example
   * ```ts
   * next.on('campaign:loaded', (campaign) => {
   *   // campaign.name, campaign.currency, campaign.packages, campaign.shipping_methods, campaign.offers
   * });
   * ```
   */
  'campaign:loaded': Campaign;
  /**
   * The checkout flow has begun. Payload carries the captured checkout data.
   *
   * @example
   * ```ts
   * next.on('checkout:started', (checkout) => {
   *   // checkout.formData, checkout.paymentMethod, checkout.step
   * });
   * ```
   */
  'checkout:started': CheckoutData;
  /**
   * The checkout `<form>` has been found and wired up by the checkout enhancer.
   *
   * @example
   * ```ts
   * next.on('checkout:form-initialized', (payload) => {
   *   // payload = { form: <HTMLFormElement> }
   * });
   * ```
   */
  'checkout:form-initialized': { form: HTMLFormElement };
  /**
   * The Spreedly card-tokenization iframe is ready to accept input.
   *
   * @example
   * ```ts
   * next.on('checkout:spreedly-ready', (payload) => {
   *   // payload = {}
   * });
   * ```
   */
  'checkout:spreedly-ready': {};
  /**
   * An express-checkout flow (PayPal / Apple Pay / Google Pay) was initiated.
   *
   * @example
   * ```ts
   * next.on('checkout:express-started', (payload) => {
   *   // payload = { method: 'paypal' }
   * });
   * ```
   */
  'checkout:express-started': { method: 'paypal' | 'apple_pay' | 'google_pay' };
  /**
   * An order was successfully created. Payload carries the completed order data.
   *
   * @example
   * ```ts
   * next.on('order:completed', (order) => {
   *   // order.ref_id, order.number, order.total_incl_tax, order.currency, order.order_status_url, order.lines
   * });
   * ```
   */
  'order:completed': OrderData;
  /**
   * The order completed but no redirect URL was available to send the shopper onward.
   *
   * @example
   * ```ts
   * next.on('order:redirect-missing', (payload) => {
   *   // payload = { order: { ref_id: 'abc123', number: 'abc123' } }
   * });
   * ```
   */
  'order:redirect-missing': { order: any };
  /**
   * A recoverable or fatal error occurred somewhere in the SDK.
   *
   * @example
   * ```ts
   * next.on('error:occurred', (error) => {
   *   // error.message, error.code, error.details
   * });
   * ```
   */
  'error:occurred': ErrorData;
  /**
   * The requested currency was unavailable, so the SDK fell back to another. `reason` says whether the fallback came from cache or the API.
   *
   * @example
   * ```ts
   * next.on('currency:fallback', (payload) => {
   *   // payload = { requested: 'EUR', actual: 'USD', reason: 'cached' }
   * });
   * ```
   */
  'currency:fallback': {
    requested: string;
    actual: string;
    reason: 'cached' | 'api';
  };
  /**
   * A persistent countdown timer reached zero. Identified by its persistence id.
   *
   * @example
   * ```ts
   * next.on('timer:expired', (payload) => {
   *   // payload = { persistenceId: 'main-offer' }
   * });
   * ```
   */
  'timer:expired': { persistenceId: string };
  /**
   * SDK configuration changed. Payload is the full config state.
   *
   * @example
   * ```ts
   * next.on('config:updated', (config) => {
   *   // config.apiKey, config.campaignId, config.debug, config.pageType
   * });
   * ```
   */
  'config:updated': ConfigState;
  /**
   * A coupon was successfully applied to the cart. Payload is either the resolved coupon or just the code.
   *
   * @example
   * ```ts
   * next.on('coupon:applied', (payload) => {
   *   // payload = { code: 'SAVE10' }
   * });
   * ```
   */
  'coupon:applied': { coupon: AppliedCoupon } | { code: string };
  /**
   * A previously applied coupon was removed from the cart.
   *
   * @example
   * ```ts
   * next.on('coupon:removed', (payload) => {
   *   // payload = { code: 'SAVE10' }
   * });
   * ```
   */
  'coupon:removed': { code: string };
  /**
   * A coupon code was rejected. `message` is a human-readable reason suitable for display.
   *
   * @example
   * ```ts
   * next.on('coupon:validation-failed', (payload) => {
   *   // payload = { code: 'SAVE10', message: 'Coupon expired' }
   * });
   * ```
   */
  'coupon:validation-failed': { code: string; message: string };
  /**
   * A card within a package selector became the active selection.
   *
   * @example
   * ```ts
   * next.on('selector:item-selected', (payload) => {
   *   // payload = {
   *   //   selectorId: 'main-offer',
   *   //   packageId: 2,
   *   //   previousPackageId: 5,
   *   //   mode: 'swap',
   *   //   pendingAction: false
   *   // }
   * });
   * ```
   */
  'selector:item-selected': {
    selectorId: string;
    packageId: number;
    previousPackageId: number | undefined;
    mode: string;
    pendingAction: boolean | undefined;
    item?: SelectorItem;
  };
  /**
   * A selector's deferred action (e.g. add-to-cart in select mode) finished after selection.
   *
   * @example
   * ```ts
   * next.on('selector:action-completed', (payload) => {
   *   // payload = {
   *   //   selectorId: 'main-offer',
   *   //   packageId: 2,
   *   //   previousPackageId: 5,
   *   //   mode: 'select'
   *   // }
   * });
   * ```
   */
  'selector:action-completed': {
    selectorId: string;
    packageId: number;
    previousPackageId: number | undefined;
    mode: string;
  };
  /**
   * A selector's current selection changed (package and/or quantity).
   *
   * @example
   * ```ts
   * next.on('selector:selection-changed', (payload) => {
   *   // payload = { selectorId: 'main-offer', packageId: 2, quantity: 1 }
   * });
   * ```
   */
  'selector:selection-changed': {
    selectorId: string;
    packageId?: number;
    quantity?: number;
    item?: SelectorItem;
  };
  /**
   * The quantity associated with a selector's current selection changed.
   *
   * @example
   * ```ts
   * next.on('selector:quantity-changed', (payload) => {
   *   // payload = { selectorId: 'main-offer', packageId: 2, quantity: 3 }
   * });
   * ```
   */
  'selector:quantity-changed': {
    selectorId: string;
    packageId: number;
    quantity: number;
  };
  /**
   * A shipping method was selected via a selector element.
   *
   * @example
   * ```ts
   * next.on('shipping:method-selected', (payload) => {
   *   // payload = { shippingId: '2', selectorId: 'main-offer' }
   * });
   * ```
   */
  'shipping:method-selected': { shippingId: string; selectorId: string };
  /**
   * The active shipping method changed; payload carries the resolved method.
   *
   * @example
   * ```ts
   * next.on('shipping:method-changed', (payload) => {
   *   // payload = { methodId: 2, method: { id: 2, name: 'Standard', price: 10 } }
   * });
   * ```
   */
  'shipping:method-changed': { methodId: number; method: any };

  // Action Events
  /**
   * An async action (e.g. add-to-cart) fired from a `BaseActionEnhancer` completed successfully.
   *
   * @example
   * ```ts
   * next.on('action:success', (payload) => {
   *   // payload = { action: 'add-to-cart', data: { packageId: 2 } }
   * });
   * ```
   */
  'action:success': { action: string; data?: any };
  /**
   * An async action fired from a `BaseActionEnhancer` threw. Payload carries the action name and error.
   *
   * @example
   * ```ts
   * next.on('action:failed', (payload) => {
   *   // payload = { action: 'add-to-cart', error: new Error('Network error') }
   * });
   * ```
   */
  'action:failed': { action: string; error: Error };

  // Upsell Events
  /**
   * A post-purchase upsell was accepted and added to the order.
   *
   * @example
   * ```ts
   * next.on('upsell:accepted', (payload) => {
   *   // payload = { packageId: 2, quantity: 1, orderId: 'abc123', value: 49.99 }
   * });
   * ```
   */
  'upsell:accepted': {
    packageId: number;
    quantity: number;
    orderId: string;
    value?: number;
  };
  /**
   * A card within an upsell selector became the active selection.
   *
   * @example
   * ```ts
   * next.on('upsell-selector:item-selected', (payload) => {
   *   // payload = { selectorId: 'main-offer', packageId: 2 }
   * });
   * ```
   */
  'upsell-selector:item-selected': { selectorId: string; packageId: number };
  /**
   * The quantity for an upsell selection changed.
   *
   * @example
   * ```ts
   * next.on('upsell:quantity-changed', (payload) => {
   *   // payload = { selectorId: 'main-offer', quantity: 3, packageId: 2 }
   * });
   * ```
   */
  'upsell:quantity-changed': {
    selectorId?: string | undefined;
    quantity: number;
    packageId?: number | undefined;
  };
  /**
   * An upsell option was selected within an upsell selector.
   *
   * @example
   * ```ts
   * next.on('upsell:option-selected', (payload) => {
   *   // payload = { selectorId: 'main-offer', packageId: 2 }
   * });
   * ```
   */
  'upsell:option-selected': { selectorId: string; packageId: number };

  // Message Events
  /**
   * A user-facing message was displayed (e.g. a coupon or validation notice). `type` indicates its severity/category.
   *
   * @example
   * ```ts
   * next.on('message:displayed', (payload) => {
   *   // payload = { message: 'Coupon SAVE10 applied', type: 'success' }
   * });
   * ```
   */
  'message:displayed': { message: string; type: string };

  // Payment Events
  /**
   * A payment method was tokenized and is ready to submit with the order.
   *
   * @example
   * ```ts
   * next.on('payment:tokenized', (payload) => {
   *   // payload = { token: 'abc123', pmData: { last_four: '4242' }, paymentMethod: 'paypal' }
   * });
   * ```
   */
  'payment:tokenized': { token: string; pmData: any; paymentMethod: string };
  /**
   * Payment processing failed. `errors` holds the human-readable messages.
   *
   * @example
   * ```ts
   * next.on('payment:error', (payload) => {
   *   // payload = { errors: ['Card declined'] }
   * });
   * ```
   */
  'payment:error': { errors: string[] };
  /**
   * An express-checkout flow finished; `success` indicates the outcome.
   *
   * @example
   * ```ts
   * next.on('checkout:express-completed', (payload) => {
   *   // payload = { method: 'paypal', success: true }
   * });
   * ```
   */
  'checkout:express-completed': { method: string; success: boolean };
  /**
   * An express-checkout flow failed before completion.
   *
   * @example
   * ```ts
   * next.on('checkout:express-failed', (payload) => {
   *   // payload = { method: 'paypal', error: 'User cancelled' }
   * });
   * ```
   */
  'checkout:express-failed': { method: string; error: string };

  // Express Checkout Events
  /**
   * An express-checkout button (PayPal / Apple Pay / Google Pay) was rendered and is ready.
   *
   * @example
   * ```ts
   * next.on('express-checkout:initialized', (payload) => {
   *   // payload = { method: 'paypal', element: <HTMLElement> }
   * });
   * ```
   */
  'express-checkout:initialized': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    element: HTMLElement;
  };
  /**
   * An express-checkout button errored during setup or rendering.
   *
   * @example
   * ```ts
   * next.on('express-checkout:error', (payload) => {
   *   // payload = { method: 'paypal', error: 'Failed to render button' }
   * });
   * ```
   */
  'express-checkout:error': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    error: string;
  };
  /**
   * The shopper started an express-checkout flow; payload includes the cart total and item count at that moment.
   *
   * @example
   * ```ts
   * next.on('express-checkout:started', (payload) => {
   *   // payload = {
   *   //   method: 'paypal',
   *   //   cartTotal: { value: 49.99, formatted: '$49.99' },
   *   //   itemCount: 1
   *   // }
   * });
   * ```
   */
  'express-checkout:started': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    cartTotal: { value: number; formatted: string };
    itemCount: number;
  };
  /**
   * An express-checkout flow failed before producing an order.
   *
   * @example
   * ```ts
   * next.on('express-checkout:failed', (payload) => {
   *   // payload = { method: 'paypal', error: 'Payment declined' }
   * });
   * ```
   */
  'express-checkout:failed': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    error: string;
  };
  /**
   * An express-checkout flow produced a completed order.
   *
   * @example
   * ```ts
   * next.on('express-checkout:completed', (payload) => {
   *   // payload = { method: 'paypal', order: { ref_id: 'abc123', number: 'abc123' } }
   * });
   * ```
   */
  'express-checkout:completed': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    order: any;
  };
  /**
   * An express-checkout order completed but no redirect URL was available.
   *
   * @example
   * ```ts
   * next.on('express-checkout:redirect-missing', (payload) => {
   *   // payload = { order: { ref_id: 'abc123', number: 'abc123' } }
   * });
   * ```
   */
  'express-checkout:redirect-missing': { order: any };

  // Address Autocomplete Events
  /**
   * Address autocomplete populated a shipping or billing address. `components` holds the resolved address parts.
   *
   * @example
   * ```ts
   * next.on('address:autocomplete-filled', (payload) => {
   *   // payload = { type: 'shipping', components: { city: 'Austin', postal_code: '78701' } }
   * });
   * ```
   */
  'address:autocomplete-filled': {
    type: 'shipping' | 'billing';
    components: any;
  };
  /**
   * The manual address-entry (location) fields were revealed by the autocomplete enhancer.
   *
   * @example
   * ```ts
   * next.on('address:location-fields-shown', (payload) => {
   *   // payload = {}
   * });
   * ```
   */
  'address:location-fields-shown': {};
  /**
   * The checkout's shipping location fields were revealed.
   *
   * @example
   * ```ts
   * next.on('checkout:location-fields-shown', (payload) => {
   *   // payload = {}
   * });
   * ```
   */
  'checkout:location-fields-shown': {};
  /**
   * The checkout's billing location fields were revealed.
   *
   * @example
   * ```ts
   * next.on('checkout:billing-location-fields-shown', (payload) => {
   *   // payload = {}
   * });
   * ```
   */
  'checkout:billing-location-fields-shown': {};

  // Upsell Events
  /**
   * A post-purchase upsell enhancer finished initializing on its element.
   *
   * @example
   * ```ts
   * next.on('upsell:initialized', (payload) => {
   *   // payload = { packageId: 2, element: <HTMLElement> }
   * });
   * ```
   */
  'upsell:initialized': { packageId: number; element: HTMLElement };
  /**
   * An upsell add request is in flight (button clicked, awaiting the order API).
   *
   * @example
   * ```ts
   * next.on('upsell:adding', (payload) => {
   *   // payload = { packageId: 2 }
   * });
   * ```
   */
  'upsell:adding': { packageId: number };
  /**
   * An upsell was added to the order. `willRedirect` indicates whether the page will navigate afterward.
   *
   * @example
   * ```ts
   * next.on('upsell:added', (payload) => {
   *   // payload = {
   *   //   packageId: 2,
   *   //   quantity: 1,
   *   //   order: { ref_id: 'abc123' },
   *   //   value: 49.99,
   *   //   willRedirect: true
   *   // }
   * });
   * ```
   */
  'upsell:added': {
    packageId: number;
    quantity: number;
    order: any;
    value?: number;
    willRedirect?: boolean;
  };
  /**
   * Adding an upsell to the order failed.
   *
   * @example
   * ```ts
   * next.on('upsell:error', (payload) => {
   *   // payload = { packageId: 2, error: 'Order no longer accepts upsells' }
   * });
   * ```
   */
  'upsell:error': { packageId: number; error: string };

  // Accordion Events
  /**
   * An accordion section toggled. `isOpen` reflects its new state.
   *
   * @example
   * ```ts
   * next.on('accordion:toggled', (payload) => {
   *   // payload = { id: 'main-offer', isOpen: true, element: <HTMLElement> }
   * });
   * ```
   */
  'accordion:toggled': { id: string; isOpen: boolean; element: HTMLElement };
  /**
   * An accordion section opened.
   *
   * @example
   * ```ts
   * next.on('accordion:opened', (payload) => {
   *   // payload = { id: 'main-offer', element: <HTMLElement> }
   * });
   * ```
   */
  'accordion:opened': { id: string; element: HTMLElement };
  /**
   * An accordion section closed.
   *
   * @example
   * ```ts
   * next.on('accordion:closed', (payload) => {
   *   // payload = { id: 'main-offer', element: <HTMLElement> }
   * });
   * ```
   */
  'accordion:closed': { id: string; element: HTMLElement };
  /**
   * A post-purchase upsell was skipped/declined by the shopper.
   *
   * @example
   * ```ts
   * next.on('upsell:skipped', (payload) => {
   *   // payload = { packageId: 2, orderId: 'abc123' }
   * });
   * ```
   */
  'upsell:skipped': { packageId?: number; orderId?: string };
  /**
   * A post-purchase upsell offer was viewed (impression), keyed by package and/or page path.
   *
   * @example
   * ```ts
   * next.on('upsell:viewed', (payload) => {
   *   // payload = { packageId: 2, pagePath: '/upsell-1', orderId: 'abc123' }
   * });
   * ```
   */
  'upsell:viewed': { packageId?: number; pagePath?: string; orderId?: string };

  // Exit Intent Events (simplified)
  /**
   * The exit-intent popup was shown.
   *
   * @example
   * ```ts
   * next.on('exit-intent:shown', (payload) => {
   *   // payload = { imageUrl: 'https://cdn.example.com/exit.png', template: 'default' }
   * });
   * ```
   */
  'exit-intent:shown': { imageUrl?: string; template?: string };
  /**
   * The exit-intent popup image/content was clicked.
   *
   * @example
   * ```ts
   * next.on('exit-intent:clicked', (payload) => {
   *   // payload = { imageUrl: 'https://cdn.example.com/exit.png', template: 'default' }
   * });
   * ```
   */
  'exit-intent:clicked': { imageUrl?: string; template?: string };
  /**
   * The exit-intent popup was dismissed (e.g. overlay click or close).
   *
   * @example
   * ```ts
   * next.on('exit-intent:dismissed', (payload) => {
   *   // payload = { imageUrl: 'https://cdn.example.com/exit.png', template: 'default' }
   * });
   * ```
   */
  'exit-intent:dismissed': { imageUrl?: string; template?: string };
  /**
   * The exit-intent popup was closed via its close control.
   *
   * @example
   * ```ts
   * next.on('exit-intent:closed', (payload) => {
   *   // payload = { imageUrl: 'https://cdn.example.com/exit.png', template: 'default' }
   * });
   * ```
   */
  'exit-intent:closed': { imageUrl?: string; template?: string };
  /**
   * An exit-intent action fired (e.g. an embedded CTA), optionally carrying a coupon code to apply.
   *
   * @example
   * ```ts
   * next.on('exit-intent:action', (payload) => {
   *   // payload = { action: 'apply-coupon', couponCode: 'SAVE10' }
   * });
   * ```
   */
  'exit-intent:action': { action: string; couponCode?: string };

  // FOMO Events
  /**
   * A FOMO social-proof notification was shown, naming the customer, product, and image used.
   *
   * @example
   * ```ts
   * next.on('fomo:shown', (payload) => {
   *   // payload = {
   *   //   customer: 'Jane from Austin',
   *   //   product: 'Premium Bundle',
   *   //   image: 'https://cdn.example.com/product.png'
   *   // }
   * });
   * ```
   */
  'fomo:shown': { customer: string; product: string; image: string };

  // SDK Events
  /**
   * The SDK finished reading and storing URL parameters at startup.
   *
   * @example
   * ```ts
   * next.on('sdk:url-parameters-processed', (payload) => {
   *   // payload = {}
   * });
   * ```
   */
  'sdk:url-parameters-processed': {};

  // Offer Events
  /**
   * An offer was selected (chosen but not yet applied).
   *
   * @example
   * ```ts
   * next.on('offer:selected', (payload) => {
   *   // payload = { offerId: 2 }
   * });
   * ```
   */
  'offer:selected': { offerId: number };
  /**
   * An offer was applied to the cart.
   *
   * @example
   * ```ts
   * next.on('offer:applied', (payload) => {
   *   // payload = { offerId: 2 }
   * });
   * ```
   */
  'offer:applied': { offerId: number };

  // Bundle Events
  /**
   * A bundle was selected; payload lists the packages and quantities that make up the bundle.
   *
   * @example
   * ```ts
   * next.on('bundle:selected', (payload) => {
   *   // payload = {
   *   //   selectorId: 'main-offer',
   *   //   items: [{ packageId: 2, quantity: 1 }, { packageId: 5, quantity: 1 }]
   *   // }
   * });
   * ```
   */
  'bundle:selected': {
    selectorId: string;
    items: { packageId: number; quantity: number }[];
  };
  /**
   * The active bundle selection changed; payload lists the new bundle's packages and quantities.
   *
   * @example
   * ```ts
   * next.on('bundle:selection-changed', (payload) => {
   *   // payload = {
   *   //   selectorId: 'main-offer',
   *   //   items: [{ packageId: 2, quantity: 1 }, { packageId: 5, quantity: 1 }]
   *   // }
   * });
   * ```
   */
  'bundle:selection-changed': {
    selectorId: string;
    items: { packageId: number; quantity: number }[];
  };
  /**
   * A bundle's quantity changed; payload includes the bundle id and its resulting package lines.
   *
   * @example
   * ```ts
   * next.on('bundle:quantity-changed', (payload) => {
   *   // payload = {
   *   //   selectorId: 'main-offer',
   *   //   bundleId: 'abc123',
   *   //   quantity: 3,
   *   //   items: [{ packageId: 2, quantity: 3 }]
   *   // }
   * });
   * ```
   */
  'bundle:quantity-changed': {
    selectorId: string;
    bundleId: string;
    quantity: number;
    items: { packageId: number; quantity: number }[];
  };
  /**
   * A bundle selector recalculated and refreshed its displayed price.
   *
   * @example
   * ```ts
   * next.on('bundle:price-updated', (payload) => {
   *   // payload = { selectorId: 'main-offer' }
   * });
   * ```
   */
  'bundle:price-updated': { selectorId: string };
  /**
   * A package selector recalculated and refreshed the displayed price for a card.
   *
   * @example
   * ```ts
   * next.on('selector:price-updated', (payload) => {
   *   // payload = { selectorId: 'main-offer', packageId: 2 }
   * });
   * ```
   */
  'selector:price-updated': { selectorId: string; packageId: number };
  /**
   * A package toggle recalculated and refreshed its displayed price.
   *
   * @example
   * ```ts
   * next.on('toggle:price-updated', (payload) => {
   *   // payload = { packageId: 2 }
   * });
   * ```
   */
  'toggle:price-updated': { packageId: number };

  // Package Toggle Events
  /**
   * A package toggle flipped state. `added` is `true` when the package was added, `false` when removed.
   *
   * @example
   * ```ts
   * next.on('toggle:toggled', (payload) => {
   *   // payload = { packageId: 2, added: true }
   * });
   * ```
   */
  'toggle:toggled': { packageId: number; added: boolean };
  /**
   * The set of toggled-on packages changed; payload lists all currently selected package ids.
   *
   * @example
   * ```ts
   * next.on('toggle:selection-changed', (payload) => {
   *   // payload = { selected: [2, 5] }
   * });
   * ```
   */
  'toggle:selection-changed': { selected: number[] };
}

// Basic cart types
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
}

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

// Selector-specific types with explicit undefined handling
export interface SelectorItem {
  element: HTMLElement;
  packageId: number;
  quantity: number;
  price: number | undefined;
  name: string | undefined;
  isPreSelected: boolean;
  shippingId: string | undefined;
}

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

export interface EnrichedCartLine {
  id: number;
  packageId: number;
  quantity: number;
  price: {
    excl_tax: { value: number; formatted: string };
    incl_tax: { value: number; formatted: string };
    original: { value: number; formatted: string };
    savings: { value: number; formatted: string };
  };
  product: {
    title: string;
    sku: string;
    image: string;
  };
  is_upsell: boolean;
  is_recurring: boolean;
  interval?: 'day' | 'month';
  is_bundle: boolean;
  bundleComponents?: number[];
}

// Campaign types
export interface Campaign {
  currency: string;
  language: string;
  name: string;
  packages: Package[];
  payment_env_key: string;
  shipping_methods: ShippingOption[];
  offers?: Offer[];
  available_currencies?: Array<{ code: string; label: string }>;
  available_shipping_countries?: Array<{ code: string; label: string }>;
  available_express_payment_methods?: Array<{ code: string; label: string }>;
  available_payment_methods?: Array<{ code: string; label: string }>;
}

export interface Package {
  ref_id: number;
  external_id: number;
  name: string;
  price: string;
  price_total: string;
  price_retail?: string;
  price_retail_total?: string;
  price_recurring?: string;
  price_recurring_total?: string;
  qty: number;
  image: string;
  is_recurring: boolean;
  interval?: 'day' | 'month' | null;
  interval_count?: number | null;
  product_variant_id?: number;
  product_variant_name?: string;
  product_id?: number;
  product_name?: string;
  product_sku?: string | null;
  product_purchase_availability?: string;
  product_inventory_availability?: string;
}

export interface ShippingOption {
  ref_id: number;
  code: string;
  price: string;
}

// Google Maps configuration interface
export interface GoogleMapsConfig {
  apiKey?: string;
  region?: string;
  enableAutocomplete?: boolean;
  autocompleteOptions?: any;
}

// Address configuration interface
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

// Configuration types
export interface ConfigState {
  apiKey: string;
  campaignId: string;
  debug: boolean;
  debugger: boolean | undefined;
  pageType: PageType;
  storeName?: string;
  spreedlyEnvironmentKey?: string | undefined;
  paymentConfig: PaymentConfig;
  googleMapsConfig: GoogleMapsConfig;
  addressConfig: AddressConfig;

  // Location and currency detection
  detectedCountry?: string;
  detectedCurrency?: string;
  detectedIp?: string; // User's IP address from location detection
  selectedCurrency?: string;
  locationData?: any;
  currencyBehavior?: 'auto' | 'manual'; // auto: change currency when country changes, manual: never auto-change
  currencyFallbackOccurred?: boolean; // Track if currency fallback happened

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

export type PageType = 'product' | 'cart' | 'checkout' | 'upsell' | 'receipt';

// Card input configuration interface
// Generic configuration for credit card input fields (iFrame-based)
// Previously named SpreedlyConfig - alias maintained for backward compatibility
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

// Backward compatibility alias - SpreedlyConfig is now CardInputConfig
export type SpreedlyConfig = CardInputConfig;

export interface PaymentConfig {
  // Generic card input configuration (preferred)
  cardInputConfig?: CardInputConfig;
  // Legacy naming - maintained for backward compatibility
  spreedly?: CardInputConfig;

  expressCheckout?: {
    enabled: boolean;
    methods: {
      paypal?: boolean;
      applePay?: boolean;
      googlePay?: boolean;
    };
    methodOrder?: ('paypal' | 'apple_pay' | 'google_pay')[]; // Order in which payment methods should be displayed
    requireValidation?: boolean; // If true, express payment methods in combo form will require form validation
    requiredFields?: string[]; // List of fields required for express checkout (e.g., ['email', 'fname', 'lname'])
  };
}

// Callback types
export type CallbackType =
  | 'beforeRender'
  | 'afterRender'
  | 'beforeCheckout'
  | 'afterCheckout'
  | 'beforeRedirect'
  | 'itemAdded'
  | 'itemRemoved'
  | 'cartCleared';

export interface CallbackData {
  cartLines: EnrichedCartLine[];
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

// Coupon system types
export interface DiscountDefinition {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  scope: 'order' | 'package';
  packageIds?: number[]; // For package-specific discounts
  minOrderValue?: number;
  maxDiscount?: number; // For percentage discounts
  description?: string;
  usageLimit?: number;
  combinable?: boolean; // Can be combined with other coupons
}

export interface AppliedCoupon {
  code: string;
  discount: number; // Calculated discount amount
  definition: DiscountDefinition;
}

// Legacy coupon interface - kept for backwards compatibility
export interface Coupon {
  code: string;
  amount: number;
  type: 'fixed' | 'percentage';
}

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

export interface CheckoutData {
  formData: Record<string, any>;
  paymentMethod:
    | 'card_token'
    | 'paypal'
    | 'apple_pay'
    | 'google_pay'
    | 'credit-card'
    | 'klarna';
  isProcessing?: boolean;
  step?: number;
}

export interface OrderData {
  ref_id: string;
  number: string;
  currency: string;
  total_incl_tax: string;
  order_status_url: string;
  is_test: boolean;
  lines?: any[];
  user?: any;
}

export interface ErrorData {
  message: string;
  code?: string;
  details?: any;
}
