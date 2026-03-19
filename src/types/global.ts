/**
 * Global type definitions for the SDK
 */

import type { Offer } from './campaign';

import { AddressAutocompleteResult } from "./api";

// Event Map for type-safe event handling
export interface EventMap {
  'cart:updated': CartState;
  'cart:item-added': { packageId: number; quantity?: number; source?: string };
  'cart:item-removed': { packageId: number };
  'cart:quantity-changed': {
    packageId: number;
    quantity: number;
    oldQuantity: number;
  };
  'cart:package-swapped': {
    previousPackageId: number;
    newPackageId: number;
    previousItem?: CartItem;
    newItem?: CartItem;
    priceDifference: number;
    source?: string;
  };
  'campaign:loaded': Campaign;
  'checkout:started': CheckoutData;
  'checkout:form-initialized': { form: HTMLFormElement };
  'checkout:spreedly-ready': {};
  'checkout:express-started': { method: 'paypal' | 'apple_pay' | 'google_pay' };
  'order:completed': OrderData;
  'order:redirect-missing': { order: any };
  'error:occurred': ErrorData;
  'currency:fallback': {
    requested: string;
    actual: string;
    reason: 'cached' | 'api';
  };
  'timer:expired': { persistenceId: string };
  'config:updated': ConfigState;
  'coupon:applied': { coupon: AppliedCoupon } | { code: string };
  'coupon:removed': { code: string };
  'coupon:validation-failed': { code: string; message: string };
  'selector:item-selected': {
    selectorId: string;
    packageId: number;
    previousPackageId: number | undefined;
    mode: string;
    pendingAction: boolean | undefined;
    item?: SelectorItem;
  };
  'selector:action-completed': {
    selectorId: string;
    packageId: number;
    previousPackageId: number | undefined;
    mode: string;
  };
  'selector:selection-changed': {
    selectorId: string;
    packageId?: number;
    quantity?: number;
    item?: SelectorItem;
  };
  'selector:quantity-changed': {
    selectorId: string;
    packageId: number;
    quantity: number;
  };
  'shipping:method-selected': { shippingId: string; selectorId: string };
  'shipping:method-changed': { methodId: number; method: any };

  // Action Events
  'action:success': { action: string; data?: any };
  'action:failed': { action: string; error: Error };

  // Upsell Events
  'upsell:accepted': {
    packageId: number;
    quantity: number;
    orderId: string;
    value?: number;
  };
  'upsell-selector:item-selected': { selectorId: string; packageId: number };
  'upsell:quantity-changed': {
    selectorId?: string | undefined;
    quantity: number;
    packageId?: number | undefined;
  };
  'upsell:option-selected': { selectorId: string; packageId: number };

  // Message Events
  'message:displayed': { message: string; type: string };

  // Payment Events
  'payment:tokenized': { token: string; pmData: any; paymentMethod: string };
  'payment:error': { errors: string[] };
  'checkout:express-completed': { method: string; success: boolean };
  'checkout:express-failed': { method: string; error: string };

  // Express Checkout Events
  'express-checkout:initialized': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    element: HTMLElement;
  };
  'express-checkout:error': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    error: string;
  };
  'express-checkout:started': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    cartTotal: { value: number; formatted: string };
    itemCount: number;
  };
  'express-checkout:failed': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    error: string;
  };
  'express-checkout:completed': {
    method: 'paypal' | 'apple_pay' | 'google_pay';
    order: any;
  };
  'express-checkout:redirect-missing': { order: any };

  // Address Autocomplete Events
  'address:autocomplete-filled': {
    type: 'shipping' | 'billing';
    components: any;
  };
  'address:location-fields-shown': {};
  'checkout:location-fields-shown': {};
  'checkout:billing-location-fields-shown': {};

  // Upsell Events
  'upsell:initialized': { packageId: number; element: HTMLElement };
  'upsell:adding': { packageId: number };
  'upsell:added': {
    packageId: number;
    quantity: number;
    order: any;
    value?: number;
    willRedirect?: boolean;
  };
  'upsell:error': { packageId: number; error: string };

  // Accordion Events
  'accordion:toggled': { id: string; isOpen: boolean; element: HTMLElement };
  'accordion:opened': { id: string; element: HTMLElement };
  'accordion:closed': { id: string; element: HTMLElement };
  'upsell:skipped': { packageId?: number; orderId?: string };
  'upsell:viewed': { packageId?: number; pagePath?: string; orderId?: string };

  // Exit Intent Events (simplified)
  'exit-intent:shown': { imageUrl?: string; template?: string };
  'exit-intent:clicked': { imageUrl?: string; template?: string };
  'exit-intent:dismissed': { imageUrl?: string; template?: string };
  'exit-intent:closed': { imageUrl?: string; template?: string };
  'exit-intent:action': { action: string; couponCode?: string };

  // FOMO Events
  'fomo:shown': { customer: string; product: string; image: string };

  // SDK Events
  'sdk:url-parameters-processed': {};

  // Profile Events
  'profile:applied': {
    profileId: string;
    previousProfileId?: string | null;
    itemsSwapped: number;
    originalItems?: number;
    cleared?: boolean;
    profile?: any;
  };
  'profile:reverted': {
    previousProfileId?: string | null;
    itemsRestored: number;
  };
  'profile:switched': {
    fromProfileId?: string | null;
    toProfileId: string;
    itemsAffected: number;
  };
  'profile:registered': {
    profileId: string;
    mappingsCount: number;
  };

  // Offer Events
  'offer:selected': { offerId: number };
  'offer:applied': { offerId: number };

  // Bundle Events
  'bundle:selected': { bundleId: string; items: { packageId: number; quantity: number }[] };
  'bundle:selection-changed': { bundleId: string; items: { packageId: number; quantity: number }[] };
}

// Basic cart types
export interface CartItem {
  /** Unique cart line ID returned by the API. */
  id: number;
  /** The campaign package `ref_id` for this item. */
  packageId: number;
  /** Original package ID before any profile mapping was applied. */
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
  /** Bundle ID this item belongs to (set by BundleSelectorEnhancer). */
  bundleId?: string | undefined;
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
  /** Cart subtotal as a raw number, before shipping and discounts. */
  subtotal: number;
  /** Shipping cost as a raw number. */
  shipping: number;
  /** Tax amount as a raw number. */
  tax: number;
  /** Cart grand total as a raw number. */
  total: number;
  /** Total unit count across all items (sum of each item's `quantity × qty`). */
  totalQuantity: number;
  /** `true` when the cart has no items. */
  isEmpty: boolean;
  /**
   * @deprecated Use `appliedCoupons` instead.
   * Legacy coupon object — kept for backwards compatibility.
   */
  coupon?: Coupon;
  /** All active coupons with their calculated discount amounts. */
  appliedCoupons: AppliedCoupon[];
  /** The currently selected shipping method. */
  shippingMethod?: ShippingMethod;
  /** Cart items enriched with full pricing breakdown for display. See `EnrichedCartLine`. */
  enrichedItems: EnrichedCartLine[];
  /** Computed cart totals with both raw values and formatted display strings. See `CartTotals`. */
  totals: CartTotals;
  /** `true` while a package swap animation is in progress. Use to prevent double-clicks. */
  swapInProgress?: boolean;
  /** ISO currency code of the last loaded cart data. Used to detect currency changes. */
  lastCurrency?: string;
  /** Breakdown of offer and voucher discounts applied to the cart. */
  discountDetails?: {
    offerDiscounts: Array<{
      offer_id: number;
      amount: string;
      description?: string;
      name?: string;
    }>;
    voucherDiscounts: Array<{
      amount: string;
      description?: string;
      name?: string;
    }>;
  };
  /** Raw CartSummary response from the API calculate endpoint. */
  summary?: import('./api').CartSummary;
}

export interface CartTotals {
  /** Cart subtotal before shipping and discounts. */
  subtotal: { value: number; formatted: string };
  /** Shipping cost. */
  shipping: { value: number; formatted: string };
  /** Discount applied to shipping (e.g. from a free-shipping offer). */
  shippingDiscount: { value: number; formatted: string };
  /** Tax amount. */
  tax: { value: number; formatted: string };
  /** Total discount amount from coupons and offers. */
  discounts: { value: number; formatted: string };
  /** Cart grand total (subtotal + shipping − discounts + tax). */
  total: { value: number; formatted: string };
  /** Grand total excluding shipping — useful for "free shipping" threshold displays. */
  totalExclShipping: { value: number; formatted: string };
  /** Number of packages (lines) in the cart. */
  count: number;
  /** `true` when the cart has no items. */
  isEmpty: boolean;
  /** Savings from the retail/compare-at price on selected packages. */
  savings: { value: number; formatted: string };
  /** Retail savings as a percentage of the compare-at total. */
  savingsPercentage: { value: number; formatted: string };
  /** Sum of all retail/compare-at prices — the "before" price for savings display. */
  compareTotal: { value: number; formatted: string };
  /** `true` when retail savings are available to display. */
  hasSavings: boolean;
  /** Total savings including both retail price differences and applied discounts. */
  totalSavings: { value: number; formatted: string };
  /** Total savings as a percentage of the compare-at total. */
  totalSavingsPercentage: { value: number; formatted: string };
  /** `true` when there are total savings (retail + discounts) to display. */
  hasTotalSavings: boolean;
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

  // Profile configuration
  profiles?: Record<
    string,
    {
      name: string;
      description?: string;
      packageMappings: Record<number, number>;
    }
  >;
  defaultProfile?: string;
  activeProfile?: string;

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
  cartTotals: CartTotals;
  campaignData: Campaign | null;
  appliedCoupons: AppliedCoupon[];
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
  id: number;
  name: string;
  price: number;
  code: string;
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
