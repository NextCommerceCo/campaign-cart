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
  /** Fires whenever the cart store changes — items, quantities, coupons, shipping, or recalculated totals. Payload is the full cart state. */
  'cart:updated': CartState;
  /** A package was added to the cart (or its quantity increased from zero). */
  'cart:item-added': { packageId: number; quantity?: number; source?: string };
  /** A package was removed from the cart entirely. */
  'cart:item-removed': { packageId: number };
  /** The quantity of an existing cart line changed. Includes both the new and previous quantity. */
  'cart:quantity-changed': {
    packageId: number;
    quantity: number;
    oldQuantity: number;
  };
  /** One package was swapped for another in place (e.g. a selector switching the chosen offer), with the price delta between them. */
  'cart:package-swapped': {
    previousPackageId: number;
    newPackageId: number;
    previousItem?: CartItem;
    newItem?: CartItem;
    priceDifference: number;
    source?: string;
  };
  /** The campaign (packages, offers, shipping methods) finished loading into the campaign store. */
  'campaign:loaded': Campaign;
  /** The checkout flow has begun. Payload carries the captured checkout data. */
  'checkout:started': CheckoutData;
  /** The checkout `<form>` has been found and wired up by the checkout enhancer. */
  'checkout:form-initialized': { form: HTMLFormElement };
  /** The Spreedly card-tokenization iframe is ready to accept input. */
  'checkout:spreedly-ready': {};
  /** An express-checkout flow (PayPal / Apple Pay / Google Pay) was initiated. */
  'checkout:express-started': { method: 'paypal' | 'apple_pay' | 'google_pay' };
  /** An order was successfully created. Payload carries the completed order data. */
  'order:completed': OrderData;
  /** The order completed but no redirect URL was available to send the shopper onward. */
  'order:redirect-missing': { order: any };
  /** A recoverable or fatal error occurred somewhere in the SDK. */
  'error:occurred': ErrorData;
  /** The requested currency was unavailable, so the SDK fell back to another. `reason` says whether the fallback came from cache or the API. */
  'currency:fallback': {
    requested: string;
    actual: string;
    reason: 'cached' | 'api';
  };
  /** A persistent countdown timer reached zero. Identified by its persistence id. */
  'timer:expired': { persistenceId: string };
  /** SDK configuration changed. Payload is the full config state. */
  'config:updated': ConfigState;
  /** A coupon was successfully applied to the cart. Payload is either the resolved coupon or just the code. */
  'coupon:applied': { coupon: AppliedCoupon } | { code: string };
  /** A previously applied coupon was removed from the cart. */
  'coupon:removed': { code: string };
  /** A coupon code was rejected. `message` is a human-readable reason suitable for display. */
  'coupon:validation-failed': { code: string; message: string };
  /** A card within a package selector became the active selection. */
  'selector:item-selected': {
    selectorId: string;
    packageId: number;
    previousPackageId: number | undefined;
    mode: string;
    pendingAction: boolean | undefined;
    item?: SelectorItem;
  };
  /** A selector's deferred action (e.g. add-to-cart in select mode) finished after selection. */
  'selector:action-completed': {
    selectorId: string;
    packageId: number;
    previousPackageId: number | undefined;
    mode: string;
  };
  /** A selector's current selection changed (package and/or quantity). */
  'selector:selection-changed': {
    selectorId: string;
    packageId?: number;
    quantity?: number;
    item?: SelectorItem;
  };
  /** The quantity associated with a selector's current selection changed. */
  'selector:quantity-changed': {
    selectorId: string;
    packageId: number;
    quantity: number;
  };
  /** A shipping method was selected via a selector element. */
  'shipping:method-selected': { shippingId: string; selectorId: string };
  /** The active shipping method changed; payload carries the resolved method. */
  'shipping:method-changed': { methodId: number; method: any };

  // Action Events
  /** An async action (e.g. add-to-cart) fired from a `BaseActionEnhancer` completed successfully. */
  'action:success': { action: string; data?: any };
  /** An async action fired from a `BaseActionEnhancer` threw. Payload carries the action name and error. */
  'action:failed': { action: string; error: Error };

  // Upsell Events
  /** A post-purchase upsell was accepted and added to the order. */
  'upsell:accepted': {
    packageId: number;
    quantity: number;
    orderId: string;
    value?: number;
  };
  /** A card within an upsell selector became the active selection. */
  'upsell-selector:item-selected': { selectorId: string; packageId: number };
  /** The quantity for an upsell selection changed. */
  'upsell:quantity-changed': {
    selectorId?: string | undefined;
    quantity: number;
    packageId?: number | undefined;
  };
  /** An upsell option was selected within an upsell selector. */
  'upsell:option-selected': { selectorId: string; packageId: number };

  // Message Events
  /** A user-facing message was displayed (e.g. a coupon or validation notice). `type` indicates its severity/category. */
  'message:displayed': { message: string; type: string };

  // Payment Events
  /** A payment method was tokenized and is ready to submit with the order. */
  'payment:tokenized': { token: string; pmData: any; paymentMethod: string };
  /** Payment processing failed. `errors` holds the human-readable messages. */
  'payment:error': { errors: string[] };
  /** An express-checkout flow finished; `success` indicates the outcome. */
  'checkout:express-completed': { method: string; success: boolean };
  /** An express-checkout flow failed before completion. */
  'checkout:express-failed': { method: string; error: string };

  // Express Checkout Events
  /** An express-checkout button (PayPal / Apple Pay / Google Pay) was rendered and is ready. */
  'express-checkout:initialized': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    element: HTMLElement;
  };
  /** An express-checkout button errored during setup or rendering. */
  'express-checkout:error': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    error: string;
  };
  /** The shopper started an express-checkout flow; payload includes the cart total and item count at that moment. */
  'express-checkout:started': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    cartTotal: { value: number; formatted: string };
    itemCount: number;
  };
  /** An express-checkout flow failed before producing an order. */
  'express-checkout:failed': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    error: string;
  };
  /** An express-checkout flow produced a completed order. */
  'express-checkout:completed': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    order: any;
  };
  /** An express-checkout order completed but no redirect URL was available. */
  'express-checkout:redirect-missing': { order: any };

  // Address Autocomplete Events
  /** Address autocomplete populated a shipping or billing address. `components` holds the resolved address parts. */
  'address:autocomplete-filled': {
    type: 'shipping' | 'billing';
    components: any;
  };
  /** The manual address-entry (location) fields were revealed by the autocomplete enhancer. */
  'address:location-fields-shown': {};
  /** The checkout's shipping location fields were revealed. */
  'checkout:location-fields-shown': {};
  /** The checkout's billing location fields were revealed. */
  'checkout:billing-location-fields-shown': {};

  // Upsell Events
  /** A post-purchase upsell enhancer finished initializing on its element. */
  'upsell:initialized': { packageId: number; element: HTMLElement };
  /** An upsell add request is in flight (button clicked, awaiting the order API). */
  'upsell:adding': { packageId: number };
  /** An upsell was added to the order. `willRedirect` indicates whether the page will navigate afterward. */
  'upsell:added': {
    packageId: number;
    quantity: number;
    order: any;
    value?: number;
    willRedirect?: boolean;
  };
  /** Adding an upsell to the order failed. */
  'upsell:error': { packageId: number; error: string };

  // Accordion Events
  /** An accordion section toggled. `isOpen` reflects its new state. */
  'accordion:toggled': { id: string; isOpen: boolean; element: HTMLElement };
  /** An accordion section opened. */
  'accordion:opened': { id: string; element: HTMLElement };
  /** An accordion section closed. */
  'accordion:closed': { id: string; element: HTMLElement };
  /** A post-purchase upsell was skipped/declined by the shopper. */
  'upsell:skipped': { packageId?: number; orderId?: string };
  /** A post-purchase upsell offer was viewed (impression), keyed by package and/or page path. */
  'upsell:viewed': { packageId?: number; pagePath?: string; orderId?: string };

  // Exit Intent Events (simplified)
  /** The exit-intent popup was shown. */
  'exit-intent:shown': { imageUrl?: string; template?: string };
  /** The exit-intent popup image/content was clicked. */
  'exit-intent:clicked': { imageUrl?: string; template?: string };
  /** The exit-intent popup was dismissed (e.g. overlay click or close). */
  'exit-intent:dismissed': { imageUrl?: string; template?: string };
  /** The exit-intent popup was closed via its close control. */
  'exit-intent:closed': { imageUrl?: string; template?: string };
  /** An exit-intent action fired (e.g. an embedded CTA), optionally carrying a coupon code to apply. */
  'exit-intent:action': { action: string; couponCode?: string };

  // FOMO Events
  /** A FOMO social-proof notification was shown, naming the customer, product, and image used. */
  'fomo:shown': { customer: string; product: string; image: string };

  // SDK Events
  /** The SDK finished reading and storing URL parameters at startup. */
  'sdk:url-parameters-processed': {};

  // Offer Events
  /** An offer was selected (chosen but not yet applied). */
  'offer:selected': { offerId: number };
  /** An offer was applied to the cart. */
  'offer:applied': { offerId: number };

  // Bundle Events
  /** A bundle was selected; payload lists the packages and quantities that make up the bundle. */
  'bundle:selected': {
    selectorId: string;
    items: { packageId: number; quantity: number }[];
  };
  /** The active bundle selection changed; payload lists the new bundle's packages and quantities. */
  'bundle:selection-changed': {
    selectorId: string;
    items: { packageId: number; quantity: number }[];
  };
  /** A bundle's quantity changed; payload includes the bundle id and its resulting package lines. */
  'bundle:quantity-changed': {
    selectorId: string;
    bundleId: string;
    quantity: number;
    items: { packageId: number; quantity: number }[];
  };
  /** A bundle selector recalculated and refreshed its displayed price. */
  'bundle:price-updated': { selectorId: string };
  /** A package selector recalculated and refreshed the displayed price for a card. */
  'selector:price-updated': { selectorId: string; packageId: number };
  /** A package toggle recalculated and refreshed its displayed price. */
  'toggle:price-updated': { packageId: number };

  // Package Toggle Events
  /** A package toggle flipped state. `added` is `true` when the package was added, `false` when removed. */
  'toggle:toggled': { packageId: number; added: boolean };
  /** The set of toggled-on packages changed; payload lists all currently selected package ids. */
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
