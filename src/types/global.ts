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
   *   // cart = {
   *   //   items: [{ id: 101, packageId: 2, quantity: 1, price: 49.99, title: 'Starter Kit', qty: 1, sku: 'SK-2', is_upsell: false }],
   *   //   enrichedItems: [],
   *   //   totalQuantity: 1,
   *   //   isEmpty: false,
   *   //   vouchers: ['SAVE10'],
   *   //   currency: 'USD',
   *   //   subtotal: 49.99,               // Decimal
   *   //   hasDiscounts: true,
   *   //   totalDiscount: 5,              // Decimal
   *   //   totalDiscountPercentage: 10,   // Decimal
   *   //   total: 44.99,                  // Decimal
   *   //   isCalculating: false
   *   // }
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
   *   // campaign = {
   *   //   name: 'Summer Sale',
   *   //   currency: 'USD',
   *   //   language: 'en',
   *   //   payment_env_key: 'pk_abc123',
   *   //   packages: [{ ref_id: 2, name: 'Starter Kit', price: '49.99', price_total: '49.99', qty: 1, image: 'https://cdn.example/sk.png', is_recurring: false }],
   *   //   shipping_methods: [{ ref_id: 1, code: 'standard', price: '4.99' }],
   *   //   offers: []
   *   // }
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
   *   // checkout = {
   *   //   formData: { email: 'ada@example.com', fname: 'Ada', lname: 'Lovelace' },
   *   //   paymentMethod: 'card_token',
   *   //   isProcessing: false,
   *   //   step: 2
   *   // }
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
   *   // order = {
   *   //   ref_id: 'abc123',
   *   //   number: 'NC-1001',
   *   //   currency: 'USD',
   *   //   total_incl_tax: '49.99',        // note: string, not number
   *   //   order_status_url: 'https://shop.example/order/abc123',
   *   //   is_test: false,
   *   //   lines: [{ package_id: 2, quantity: 1 }],
   *   //   user: { email: 'ada@example.com' }
   *   // }
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
   *   // error = {
   *   //   message: 'Failed to add item to cart',
   *   //   code: 'CART_WRITE_FAILED',
   *   //   details: { packageId: 2 }
   *   // }
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
   *   // config = {
   *   //   apiKey: 'pk_live_abc123',
   *   //   campaignId: 'camp_123',
   *   //   debug: false,
   *   //   pageType: 'product'   // 'product' | 'cart' | 'checkout' | 'upsell' | 'receipt'
   *   //   // ...plus paymentConfig, addressConfig, detected country/currency, etc.
   *   // }
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

/** A single discount applied to the cart (from an offer or voucher), with its amount and optional metadata. */
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
/** A single selectable card within a package selector, with its resolved package, quantity, and pricing. */
export interface SelectorItem {
  /** The card's DOM element that the selector binds to. */
  element: HTMLElement;
  /** Campaign package `ref_id` this card selects. */
  packageId: number;
  /** Number of packages this card adds when selected. */
  quantity: number;
  /** Total package price as a raw number; `undefined` when not yet resolved from campaign data. */
  price: number | undefined;
  /** Package display name; `undefined` when not yet resolved. */
  name: string | undefined;
  /** `true` when this card is the selector's default selection on load. */
  isPreSelected: boolean;
  /** Shipping method id tied to this card; `undefined` when the card sets no shipping. */
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

/** A cart line expanded with a full pricing breakdown and product details, ready for display templates. */
export interface EnrichedCartLine {
  /** Unique cart line id returned by the API. */
  id: number;
  /** Campaign package `ref_id` for this line. */
  packageId: number;
  /** Number of packages on this line. */
  quantity: number;
  /** Pricing breakdown for the line, each amount given as both a raw `value` and a `formatted` string. */
  price: {
    /** Line price excluding tax. */
    excl_tax: { value: number; formatted: string };
    /** Line price including tax. */
    incl_tax: { value: number; formatted: string };
    /** Original (pre-discount) line price. */
    original: { value: number; formatted: string };
    /** Amount saved versus the original price. */
    savings: { value: number; formatted: string };
  };
  /** Product display fields for rendering the line. */
  product: {
    /** Package/product display name. */
    title: string;
    /** Product SKU. */
    sku: string;
    /** Product image URL. */
    image: string;
  };
  /** `true` when this line was added via a post-purchase upsell. */
  is_upsell: boolean;
  /** `true` for subscription/recurring lines. */
  is_recurring: boolean;
  /** Billing interval for recurring lines; absent for one-time purchases. */
  interval?: 'day' | 'month';
  /** `true` when this line represents a multi-package bundle. */
  is_bundle: boolean;
  /** Package ids that make up the bundle; present only when `is_bundle` is `true`. */
  bundleComponents?: number[];
}

// Campaign types
/** A loaded campaign: its packages, offers, shipping methods, and storefront settings. */
export interface Campaign {
  /** ISO currency code the campaign prices are quoted in. */
  currency: string;
  /** Language/locale code for campaign copy (e.g. `'en'`). */
  language: string;
  /** Campaign display name. */
  name: string;
  /** All purchasable packages defined for this campaign. */
  packages: Package[];
  /** Public payment environment key (e.g. Spreedly env key) used to tokenize cards. */
  payment_env_key: string;
  /** Shipping methods available for this campaign. */
  shipping_methods: ShippingOption[];
  /** Offers (discounts/promotions) configured for the campaign; absent when none are defined. */
  offers?: Offer[];
  /** Currencies the shopper may switch between, each with a display label. */
  available_currencies?: Array<{ code: string; label: string }>;
  /** Countries the campaign can ship to, each with a display label. */
  available_shipping_countries?: Array<{ code: string; label: string }>;
  /** Express payment methods (PayPal/Apple Pay/Google Pay) enabled for the campaign. */
  available_express_payment_methods?: Array<{ code: string; label: string }>;
  /** Standard payment methods enabled for the campaign. */
  available_payment_methods?: Array<{ code: string; label: string }>;
}

/** A purchasable package in a campaign — a product/variant bundled at a set quantity and price. */
export interface Package {
  /** Campaign-internal package id; the value referenced everywhere as `packageId`. */
  ref_id: number;
  /** The store's external/platform product id this package maps to. */
  external_id: number;
  /** Package display name. */
  name: string;
  /** Per-unit price as a formatted string. */
  price: string;
  /** Total package price as a formatted string (per-unit price × `qty`). */
  price_total: string;
  /** Per-unit retail/compare-at price as a formatted string; absent when no compare-at price is set. */
  price_retail?: string;
  /** Total retail/compare-at price as a formatted string; absent when no compare-at price is set. */
  price_retail_total?: string;
  /** Per-unit recurring price string; present for subscription packages. */
  price_recurring?: string;
  /** Total recurring price string; present for subscription packages. */
  price_recurring_total?: string;
  /** Number of product units included in the package. */
  qty: number;
  /** Package/product image URL. */
  image: string;
  /** `true` for subscription/recurring packages. */
  is_recurring: boolean;
  /** Billing interval for recurring packages; `null` or absent for one-time purchases. */
  interval?: 'day' | 'month' | null;
  /** Number of intervals between billing cycles; `null` or absent for one-time purchases. */
  interval_count?: number | null;
  /** Product variant id this package maps to; absent when the product has no variants. */
  product_variant_id?: number;
  /** Product variant display name; absent when the product has no variants. */
  product_variant_name?: string;
  /** Underlying product id; absent when not provided. */
  product_id?: number;
  /** Underlying product display name; absent when not provided. */
  product_name?: string;
  /** Product SKU; `null` when the product has no SKU. */
  product_sku?: string | null;
  /** Whether the product can currently be purchased (e.g. `'available'`); absent when unspecified. */
  product_purchase_availability?: string;
  /** Whether the product is currently in stock; absent when unspecified. */
  product_inventory_availability?: string;
}

/** A shipping method offered by a campaign, as returned by the campaign API. */
export interface ShippingOption {
  /** Campaign-internal shipping method id; the value referenced as `shippingId`. */
  ref_id: number;
  /** Shipping method code (e.g. `'standard'`). */
  code: string;
  /** Shipping price as a formatted string. */
  price: string;
}

// Google Maps configuration interface
/** Configuration for Google Maps-powered address autocomplete. */
export interface GoogleMapsConfig {
  /** Google Maps API key; absent disables the integration. */
  apiKey?: string;
  /** Region bias for autocomplete results (ISO country code, e.g. `'US'`). */
  region?: string;
  /** `true` enables address autocomplete on checkout fields. */
  enableAutocomplete?: boolean;
  /** Raw options passed through to the Google Places Autocomplete widget. */
  autocompleteOptions?: any;
}

// Address configuration interface
/** Controls which countries/states appear in checkout address dropdowns and how fallbacks resolve. */
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

  /** `true` enables address autocomplete on the address fields. */
  enableAutocomplete?: boolean;
}

// Configuration types
/** The SDK's runtime configuration: credentials, page context, payment/address setup, detection results, and feature toggles. */
export interface ConfigState {
  /** Public API key used to authenticate campaign/cart API calls. */
  apiKey: string;
  /** Identifier of the campaign this page belongs to. */
  campaignId: string;
  /** `true` enables verbose SDK logging. */
  debug: boolean;
  /** `true` enables the on-page debug overlay; `undefined` leaves it off. */
  debugger: boolean | undefined;
  /** Which campaign page type the SDK is running on. */
  pageType: PageType;
  /** Store display name; absent when not configured. */
  storeName?: string;
  /** Spreedly environment key for card tokenization; absent when card payments are not configured. */
  spreedlyEnvironmentKey?: string | undefined;
  /** Payment method and express-checkout configuration. */
  paymentConfig: PaymentConfig;
  /** Google Maps autocomplete configuration. */
  googleMapsConfig: GoogleMapsConfig;
  /** Address dropdown/fallback configuration. */
  addressConfig: AddressConfig;

  // Location and currency detection
  /** Country detected for the visitor (ISO code); absent when detection has not run. */
  detectedCountry?: string;
  /** Currency detected for the visitor (ISO code); absent when detection has not run. */
  detectedCurrency?: string;
  /** User's IP address from location detection. */
  detectedIp?: string; // User's IP address from location detection
  /** Currency the shopper has explicitly chosen; absent when relying on detection. */
  selectedCurrency?: string;
  /** Raw location-detection response payload. */
  locationData?: any;
  /** How currency follows country changes: `'auto'` switches with country, `'manual'` never auto-changes. */
  currencyBehavior?: 'auto' | 'manual'; // auto: change currency when country changes, manual: never auto-change
  /** `true` when the requested currency was unavailable and a fallback currency was used. */
  currencyFallbackOccurred?: boolean; // Track if currency fallback happened

  // Additional configuration properties for complete type coverage
  /** `true` auto-initializes the SDK on load; `undefined` uses the default behavior. */
  autoInit: boolean | undefined;
  /** Max API requests allowed per interval; `undefined` for no client-side limit. */
  rateLimit: number | undefined;
  /** Cache time-to-live in milliseconds; `undefined` uses the default. */
  cacheTtl: number | undefined;
  /** Number of times to retry a failed request; `undefined` uses the default. */
  retryAttempts: number | undefined;
  /** Request timeout in milliseconds; `undefined` uses the default. */
  timeout: number | undefined;
  /** `true` runs the SDK in test mode (test orders/payments); `undefined` for live mode. */
  testMode: boolean | undefined;

  // API and performance settings
  /** Maximum retry count for API calls; `undefined` uses the default. */
  maxRetries: number | undefined;
  /** Per-request timeout in milliseconds; `undefined` uses the default. */
  requestTimeout: number | undefined;
  /** `true` enables analytics tracking; `undefined` uses the default. */
  enableAnalytics: boolean | undefined;
  /** `true` enables debug-mode behavior; `undefined` uses the default. */
  enableDebugMode: boolean | undefined;

  // Environment and deployment settings
  /** Deployment environment the SDK is running in; `undefined` when unspecified. */
  environment: 'development' | 'staging' | 'production' | undefined;
  /** SDK version string; absent when not stamped into the build. */
  version?: string | undefined;
  /** Build timestamp; absent when not stamped into the build. */
  buildTimestamp?: string | undefined;

  // Discount system
  /** Locally-defined discounts keyed by coupon code. */
  discounts: Record<string, DiscountDefinition>;

  // Attribution configuration
  /** UTM-forwarding settings controlling how tracking params propagate to links. */
  utmTransfer?: {
    /** `true` enables forwarding UTM parameters. */
    enabled: boolean;
    /** `true` also appends params to external (off-domain) links. */
    applyToExternalLinks?: boolean;
    /** Domains excluded from UTM forwarding. */
    excludedDomains?: string[];
    /** Specific parameter names to copy; absent copies the default set. */
    paramsToCopy?: string[];
  };

  // Tracking configuration (legacy)
  /** Legacy tracking mode; superseded by `analytics`. */
  tracking?: 'auto' | 'manual' | 'disabled';

  // New analytics configuration
  /** Analytics configuration covering mode and per-provider settings. */
  analytics?: {
    /** `true` enables analytics. */
    enabled: boolean;
    /** How events are dispatched: automatically, manually, or disabled. */
    mode: 'auto' | 'manual' | 'disabled';
    /** `true` logs analytics events for debugging. */
    debug: boolean;
    /** Per-provider analytics configuration. */
    providers: {
      /** Google Tag Manager provider settings. */
      gtm: {
        /** `true` enables the GTM provider. */
        enabled: boolean;
        /** GTM container and data-layer settings. */
        settings: {
          /** GTM container id (e.g. `GTM-XXXX`); absent when not set. */
          containerId?: string;
          /** Custom dataLayer variable name; absent uses the default. */
          dataLayerName?: string;
          /** GTM environment string; absent uses the default. */
          environment?: string;
        };
      };
      /** Facebook (Meta) Pixel provider settings. */
      facebook: {
        /** `true` enables the Facebook provider. */
        enabled: boolean;
        /** Facebook pixel and Conversions API settings. */
        settings: {
          /** Facebook Pixel id. */
          pixelId: string;
          /** Conversions API access token; absent when server-side events are not used. */
          accessToken?: string;
          /** Test event code for validating events in the Events Manager. */
          testEventCode?: string;
        };
        /** Event names to suppress for this provider. */
        blockedEvents?: string[];
      };
      /** Custom HTTP endpoint provider settings. */
      custom: {
        /** `true` enables the custom provider. */
        enabled: boolean;
        /** Endpoint and request settings for the custom provider. */
        settings: {
          /** URL events are POSTed to. */
          endpoint: string;
          /** API key sent with custom-provider requests; absent when not required. */
          apiKey?: string;
          /** Number of events to batch per request; absent sends individually. */
          batchSize?: number;
          /** Request timeout in milliseconds; absent uses the default. */
          timeout?: number;
        };
      };
    };
  };

  // Error monitoring configuration - removed
  // Error tracking can be added externally via HTML/scripts

  // Cart initialization behavior
  /** `true` empties the cart on SDK init; absent preserves any persisted cart. */
  clearCartOnInit?: boolean;
}

/**
 * The kind of campaign page the SDK is running on. Drives page-specific
 * behavior such as which analytics events fire and which enhancers apply.
 */
export type PageType = 'product' | 'cart' | 'checkout' | 'upsell' | 'receipt';

// Card input configuration interface
// Generic configuration for credit card input fields (iFrame-based)
// Previously named SpreedlyConfig - alias maintained for backward compatibility
/** Configuration for the iframe-based credit-card input fields (card number and CVV). */
export interface CardInputConfig {
  /** Input type per field — controls the mobile keyboard shown for card number and CVV. */
  fieldType?: {
    /** Input type for the card-number field. */
    number?: 'number' | 'text' | 'tel';
    /** Input type for the CVV field. */
    cvv?: 'number' | 'text' | 'tel';
  };

  /** How the card number is displayed as the shopper types. */
  numberFormat?: 'prettyFormat' | 'plainFormat' | 'maskedFormat';

  /** Accessible labels for the iframe fields. */
  labels?: {
    /** Accessible label for the card-number field. */
    number?: string;
    /** Accessible label for the CVV field. */
    cvv?: string;
  };

  /** `title` attribute text for the iframe fields (accessibility). */
  titles?: {
    /** Title for the card-number field. */
    number?: string;
    /** Title for the CVV field. */
    cvv?: string;
  };

  /** Placeholder text for the iframe fields. */
  placeholders?: {
    /** Placeholder for the card-number field. */
    number?: string;
    /** Placeholder for the CVV field. */
    cvv?: string;
  };

  /** Inline CSS applied inside the iframe fields. */
  styles?: {
    /** CSS for the card-number field. */
    number?: string;
    /** CSS for the CVV field. */
    cvv?: string;
    /** CSS for field placeholders. */
    placeholder?: string;
  };

  // Security parameters - REQUIRED for authentication
  /** Single-use value unique per session (e.g. a UUID), required for tokenization auth. */
  nonce?: string; // Unique per session (e.g., UUID)
  /** Epoch timestamp used in the tokenization signature. */
  timestamp?: string; // Epoch time
  /** Spreedly certificate token identifying the signing certificate. */
  certificateToken?: string; // Spreedly certificate token
  /** Server-generated signature authenticating the tokenization request. */
  signature?: string; // Server-generated signature

  /** Enable fraud detection, or pass `{ siteId }` to use a bring-your-own fraud site id. */
  fraud?: boolean | { siteId: string }; // Enable fraud detection or specify BYOC fraud site ID

  /** `true` enables browser autocomplete on the card fields. */
  enableAutoComplete?: boolean; // Toggle autocomplete functionality
  /** Marks individual fields as required for submission. */
  requiredAttributes?: {
    /** `true` requires the card-number field. */
    number?: boolean;
    /** `true` requires the CVV field. */
    cvv?: boolean;
  };

  /** `true` skips cardholder-name validation. */
  allowBlankName?: boolean; // Skip name validation
  /** `true` allows submitting an expired card date. */
  allowExpiredDate?: boolean; // Allow expired dates
}

// Backward compatibility alias - SpreedlyConfig is now CardInputConfig
/**
 * Configuration for the Spreedly hosted card-input fields. Alias of
 * {@link CardInputConfig}.
 */
export type SpreedlyConfig = CardInputConfig;

/** Payment configuration: card-input fields and express-checkout setup. */
export interface PaymentConfig {
  /** Card-input field configuration (preferred field name). */
  cardInputConfig?: CardInputConfig;
  /** Legacy alias for `cardInputConfig`; kept for backward compatibility. */
  spreedly?: CardInputConfig;

  /** Express-checkout (PayPal/Apple Pay/Google Pay) configuration. */
  expressCheckout?: {
    /** `true` enables express checkout. */
    enabled: boolean;
    /** Which express methods are turned on. */
    methods: {
      /** `true` shows the PayPal button. */
      paypal?: boolean;
      /** `true` shows the Apple Pay button. */
      applePay?: boolean;
      /** `true` shows the Google Pay button. */
      googlePay?: boolean;
    };
    /** Display order of the express methods; absent uses the default order. */
    methodOrder?: ('paypal' | 'apple_pay' | 'google_pay')[]; // Order in which payment methods should be displayed
    /** `true` requires form validation before an in-form express payment proceeds. */
    requireValidation?: boolean; // If true, express payment methods in combo form will require form validation
    /** Field names that must be filled before express checkout (e.g. `['email', 'fname', 'lname']`). */
    requiredFields?: string[]; // List of fields required for express checkout (e.g., ['email', 'fname', 'lname'])
  };
}

// Callback types
/**
 * Lifecycle hook names accepted by {@link NextCommerce.registerCallback}. Each
 * fires at a fixed point in the render / checkout flow and receives the current
 * cart snapshot as {@link CallbackData}.
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

/** Snapshot of cart and campaign state passed to lifecycle callbacks (see `CallbackType`). */
export interface CallbackData {
  /** Current cart lines with full pricing breakdown. */
  cartLines: EnrichedCartLine[];
  /** Cart totals subset: subtotal, total, discount flags/amounts, and selected shipping method (all monetary values are `Decimal`). */
  cartTotals: Pick<
    CartState,
    | 'subtotal'
    | 'total'
    | 'hasDiscounts'
    | 'totalDiscount'
    | 'totalDiscountPercentage'
    | 'shippingMethod'
  >;
  /** Loaded campaign data, or `null` when the campaign has not yet loaded. */
  campaignData: Campaign | null;
  /** Currently applied coupon codes. */
  vouchers: string[];
}

// Coupon system types
/** Rules defining a locally-configured coupon: its type, value, scope, and eligibility constraints. */
export interface DiscountDefinition {
  /** Coupon code that triggers this discount. */
  code: string;
  /** Whether the discount is a percentage off or a fixed amount. */
  type: 'percentage' | 'fixed';
  /** Discount magnitude — a percent when `type` is `'percentage'`, otherwise a currency amount. */
  value: number;
  /** Whether the discount applies to the whole order or only specific packages. */
  scope: 'order' | 'package';
  /** Package ids the discount applies to; used when `scope` is `'package'`. */
  packageIds?: number[]; // For package-specific discounts
  /** Minimum order value required for the coupon to apply; absent means no minimum. */
  minOrderValue?: number;
  /** Cap on the discount amount for percentage coupons; absent means uncapped. */
  maxDiscount?: number; // For percentage discounts
  /** Human-readable description of the coupon; absent when none is set. */
  description?: string;
  /** Maximum number of times the coupon may be used; absent means unlimited. */
  usageLimit?: number;
  /** `true` if the coupon can stack with other coupons; absent treated as not combinable. */
  combinable?: boolean; // Can be combined with other coupons
}

/** A coupon that has been applied to the cart, with its resolved discount amount and source definition. */
export interface AppliedCoupon {
  /** The applied coupon code. */
  code: string;
  /** Discount amount calculated for this coupon against the current cart. */
  discount: number; // Calculated discount amount
  /** The rule definition this applied coupon was resolved from. */
  definition: DiscountDefinition;
}

// Legacy coupon interface - kept for backwards compatibility
/** Legacy coupon shape; retained for backward compatibility. Prefer `AppliedCoupon`/`DiscountDefinition`. */
export interface Coupon {
  /** Coupon code. */
  code: string;
  /** Discount magnitude — a percent when `type` is `'percentage'`, otherwise a currency amount. */
  amount: number;
  /** Whether the discount is a fixed amount or a percentage. */
  type: 'fixed' | 'percentage';
}

/** The shipping method currently selected on the cart, with its discounted pricing (monetary values are `Decimal`). */
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

/** State captured for the checkout flow: collected form values, chosen payment method, and progress. */
export interface CheckoutData {
  /** Checkout form field values keyed by field name (e.g. `email`, `fname`, `lname`). */
  formData: Record<string, any>;
  /** Payment method the shopper is checking out with. */
  paymentMethod:
    | 'card_token'
    | 'paypal'
    | 'apple_pay'
    | 'google_pay'
    | 'credit-card'
    | 'klarna';
  /** `true` while the order is being submitted; absent before submission starts. */
  isProcessing?: boolean;
  /** Current step index in a multi-step checkout; absent for single-step flows. */
  step?: number;
}

/** A completed order as returned by the order API. */
export interface OrderData {
  /** Unique order reference id assigned by the API. */
  ref_id: string;
  /** Human-facing order number shown to the shopper. */
  number: string;
  /** ISO currency code the order was placed in. */
  currency: string;
  /** Order grand total including tax, as a formatted string. */
  total_incl_tax: string;
  /** URL of the shopper-facing order status/confirmation page. */
  order_status_url: string;
  /** `true` when the order was placed in test mode. */
  is_test: boolean;
  /** Order line items; shape varies by API response, absent when not returned. */
  lines?: any[];
  /** Customer/user details attached to the order; absent when not returned. */
  user?: any;
}

/** Payload describing an error surfaced by the SDK (emitted via the `error:occurred` event). */
export interface ErrorData {
  /** Human-readable error message suitable for logging or display. */
  message: string;
  /** Machine-readable error code; absent when the error is uncategorized. */
  code?: string;
  /** Extra context about the error (e.g. the offending package id); absent when none. */
  details?: any;
}
