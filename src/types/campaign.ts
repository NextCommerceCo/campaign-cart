/**
 * Campaign-specific type definitions
 */

export interface Campaign {
  /** Active currency for the campaign as an ISO 4217 code (e.g. `'USD'`). */
  currency: string;
  /** Active language as a BCP 47 tag (e.g. `'en'`). */
  language: string;
  /** Campaign display name. */
  name: string;
  /** All purchasable packages in the campaign. */
  packages: Package[];
  /** Spreedly environment key used for payment tokenization. */
  payment_env_key: string;
  /** Shipping methods available for this campaign. */
  shipping_methods: ShippingOption[];
  /** Discount offers configured for this campaign. Present when at least one offer exists. */
  offers?: Offer[];
  /** Currencies this campaign supports (ISO 4217 codes with display labels). */
  available_currencies?: Array<{ code: string; label: string }>;
  /** Countries this campaign ships to (ISO 3166-1 alpha-2 codes with display labels). */
  available_shipping_countries?: Array<{ code: string; label: string }>;
  /** Express payment methods enabled (e.g. `'paypal'`, `'apple_pay'`, `'google_pay'`). */
  available_express_payment_methods?: Array<{ code: string; label: string }>;
  /** Standard payment methods enabled for this campaign. */
  available_payment_methods?: Array<{ code: string; label: string }>;
}

export interface VariantAttribute {
  /** Machine-readable attribute key (e.g. `'color'`, `'size'`). */
  code: string;
  /** Human-readable attribute label (e.g. `'Color'`, `'Size'`). */
  name: string;
  /** The attribute value for this variant (e.g. `'Red'`, `'Large'`). */
  value: string;
}

export interface ProductVariant {
  /** Variant ID. */
  id: number;
  /** Variant display name (e.g. `'Red / Large'`). */
  name: string;
  /** Attribute values that define this variant (e.g. color, size). */
  attributes: VariantAttribute[];
  /** Variant SKU. `null` when not configured. */
  sku?: string | null;
}

export interface Product {
  /** Product ID. */
  id: number;
  /** Product display name. */
  name: string;
  /** The specific variant associated with this package. */
  variant: ProductVariant;
  /** Whether the product can be purchased. `'unavailable'` blocks add-to-cart. */
  purchase_availability: 'available' | 'unavailable' | string;
  /** Inventory tracking state. `'out_of_stock'` indicates no stock remaining. */
  inventory_availability: 'untracked' | 'tracked' | 'out_of_stock' | string;
}

export interface Package {
  /** Unique package identifier used throughout the SDK (e.g. in `data-next-package-id`). */
  ref_id: number;
  /** Internal database ID. */
  external_id: number;
  /** Package display name. */
  name: string;
  /** Per-unit price as a formatted string (e.g. `'$19.99'`). */
  price: string;
  /** Total package price as a formatted string — sum of all units (e.g. `'$59.97'` for qty 3). */
  price_total: string;
  /** Per-unit retail/compare-at price. Show alongside `price` to indicate a saving. */
  price_retail?: string;
  /** Total retail/compare-at price for all units. */
  price_retail_total?: string;
  /** Recurring per-unit price. Present when `is_recurring` is `true`. */
  price_recurring?: string;
  /** Recurring total price for all units. */
  price_recurring_total?: string;
  /** Number of product units included in this package. */
  qty: number;
  /** Product image URL. */
  image: string;
  /** `true` for subscription packages that bill on a recurring schedule. */
  is_recurring: boolean;
  /** Billing interval for recurring packages. */
  interval?: 'day' | 'month' | null;
  /** Number of intervals between billing cycles (e.g. `3` with `'month'` = quarterly). */
  interval_count?: number | null;
  /** Full product details. Present on API responses that include product data. */
  product?: Product;
  /** Product variant ID. */
  product_variant_id?: number;
  /** Product variant display name (e.g. `'Red / Large'`). */
  product_variant_name?: string;
  /** Product ID. */
  product_id?: number;
  /** Product display name. */
  product_name?: string;
  /** Product SKU. `null` when not configured. */
  product_sku?: string | null;
  /** `'available'` or `'unavailable'`. Controls whether the package can be purchased. */
  product_purchase_availability?: string;
  /** `'untracked'`, `'tracked'`, or `'out_of_stock'`. */
  product_inventory_availability?: string;
  /** Variant attribute values for this package (e.g. color, size). */
  product_variant_attribute_values?: VariantAttribute[];
}

export interface ShippingOption {
  /** Unique shipping method ID used when selecting a method at checkout. */
  ref_id: number;
  /** Machine-readable shipping method code. */
  code: string;
  /** Shipping price as a formatted string (e.g. `'$5.99'`, `'$0.00'` for free). */
  price: string;
}

/**
 * Benefit types for offers
 */
export type BenefitType =
  | 'package_percentage'
  | 'shipping_percentage'
  | 'order_percentage';

/**
 * Condition types for offers
 */
export type ConditionType = 'any' | 'count';

/**
 * Offer types
 */
export type OfferType = 'offer' | 'voucher';

/**
 * Benefit details of an offer
 */
export interface OfferBenefit {
  /** Human-readable description of the benefit (e.g. `'20% off all packages'`). */
  description: string;
  /** The type of discount applied. `'package_percentage'` discounts package prices, `'shipping_percentage'` discounts shipping, `'order_percentage'` discounts the order total. */
  type: BenefitType;
  /** Discount value as a string (e.g. `'20'` for 20%). */
  value: string;
}

/**
 * Condition details of an offer
 */
export interface OfferCondition {
  /** Human-readable description of the condition (e.g. `'Buy any 2 packages'`). */
  description: string;
  /** How the condition is evaluated. `'any'` means the offer is always active; `'count'` requires a minimum item count. */
  type: ConditionType;
  /** Threshold value for `'count'` conditions — the minimum number of items required. */
  value: number;
}

/**
 * Package associated with an offer
 */
export interface OfferPackage {
  /** Package ID (matches `Package.ref_id`). */
  package_id: number;
  /** Package image URL. `null` when not set. */
  package_image: string | null;
  /** Package display name. */
  package_name: string;
  /** Discounted total package price as a formatted string. */
  package_price: string;
  /** Original total package price before the offer discount. */
  package_price_before_discount: string;
  /** Number of product units in the package. */
  package_unit_qty: number;
  /** Product display name. */
  product_name: string;
  /** Product variant display name. */
  product_variant_name: string;
  /** Discounted per-unit price as a formatted string. */
  unit_price: string;
  /** Original per-unit price before the offer discount. */
  unit_price_before_discount: string;
}

/**
 * Shipping method associated with an offer
 */
export interface OfferShippingMethod {
  /** Machine-readable shipping method code. */
  code: string;
  /** Discounted shipping price as a formatted string (e.g. `'$0.00'` for free shipping). */
  price: string;
  /** Original shipping price before the offer discount. */
  price_before_discount: string;
  /** Shipping method ID (matches `ShippingOption.ref_id`). */
  ref_id: number;
}

/**
 * Complete offer structure
 */
export interface Offer {
  /** The discount applied when the condition is met. */
  benefit: OfferBenefit;
  /** Voucher code required to activate this offer. Only present when `type` is `'voucher'`. */
  code?: string;
  /** The condition that must be met to unlock this offer. */
  condition: OfferCondition;
  /** Offer display name. */
  name: string;
  /** Packages eligible for this offer, with discounted pricing pre-calculated. */
  packages: OfferPackage[];
  /** Unique offer identifier. */
  ref_id: number;
  /** Shipping methods eligible for this offer, with discounted pricing pre-calculated. */
  shipping_methods: OfferShippingMethod[];
  /** `'offer'` applies automatically when the condition is met; `'voucher'` requires a code. */
  type: OfferType;
}
