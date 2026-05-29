/**
 * API type definitions based on NextCommerce Campaigns API schema
 */

// Re-export from the OpenAPI spec we reviewed
/** Campaign configuration and catalogue returned when a landing page loads — packages, currencies, shipping, and payment options. */
export interface Campaign {
  /** ISO 4217 currency code the campaign prices and transacts in. */
  currency: string;
  /** Default locale/language code for the campaign (e.g. `en`). */
  language: string;
  /** Human-readable campaign name. */
  name: string;
  /** All purchasable packages (offers) available in this campaign. */
  packages: PackageSerializer[];
  /** Publishable key used to initialise the payment provider on the client. */
  payment_env_key: string;
  /** Shipping options the customer can choose from at checkout. */
  shipping_methods: ShippingOption[];
  /** Express payment methods (e.g. Apple Pay) enabled for one-tap checkout; omitted when none are configured. */
  available_express_payment_methods?: PaymentMethodOption[];
  /** Standard payment methods enabled for this campaign; omitted when none are configured. */
  available_payment_methods?: PaymentMethodOption[];
  /** Currencies the customer may switch the campaign into; omitted when only the default currency is allowed. */
  available_currencies?: Array<{ code: string; label: string }>;
  /** Countries the campaign can ship to; omitted when shipping is unrestricted or unconfigured. */
  available_shipping_countries?: Array<{ code: string; label: string }>;
}

/** A single purchasable package (offer) within a campaign — its pricing, quantity, and recurring-billing terms. */
export interface PackageSerializer {
  /** The package's campaign reference id, used to add it to the cart. */
  ref_id: number;
  /** Identifier of the package in the external/source system. */
  external_id: number;
  /** Display name of the package. */
  name: string;
  /** Per-unit price as a formatted currency string. */
  price: string;
  /** Total package price (price × qty) as a formatted currency string. */
  price_total: string;
  /** Per-unit retail/compare-at price as a formatted string; omitted when no retail price is set. */
  price_retail?: string;
  /** Total retail/compare-at price as a formatted string; omitted when no retail price is set. */
  price_retail_total?: string;
  /** Per-unit recurring (subscription) price as a formatted string; omitted for one-time packages. */
  price_recurring?: string;
  /** Total recurring (subscription) price as a formatted string; omitted for one-time packages. */
  price_recurring_total?: string;
  /** Number of product units contained in this package. */
  qty: number;
  /** URL of the package's display image. */
  image: string;
  /** True when the package is sold as a recurring subscription. */
  is_recurring: boolean;
  /** Billing interval unit for recurring packages; null/omitted for one-time packages. */
  interval?: 'day' | 'month' | null;
  /** Number of interval units between recurring charges; null/omitted for one-time packages. */
  interval_count?: number | null;
}

/** Server-side cart state returned by the cart API — line items, totals (with and without tax/discounts), and the associated user. */
export interface Cart {
  /** Hosted checkout URL for completing the purchase of this cart. */
  checkout_url: string;
  /** ISO 4217 currency code of the cart's monetary values. */
  currency: string;
  /** Line items currently in the cart. */
  lines: CartLine[];
  /** Cart total excluding tax (after discounts), as a formatted currency string. */
  total_excl_tax: string;
  /** Cart total including tax (after discounts), as a formatted currency string. */
  total_incl_tax: string;
  /** Cart total excluding tax before any discounts are applied, as a formatted string. */
  total_excl_tax_excl_discounts: string;
  /** Cart total including tax before any discounts are applied, as a formatted string. */
  total_incl_tax_excl_discounts: string;
  /** Total discount amount applied to the cart, as a formatted currency string. */
  total_discounts: string;
  /** Vouchers/coupons currently applied to the cart. */
  discounts: Voucher[];
  /** Customer details associated with the cart. */
  user: User;
  /** Marketing attribution captured for this cart; omitted when no attribution data is present. */
  attribution?: MarketingAttribution;
}

/** A single discount applied to a cart line, shipping method, or summary — its source offer and amount. */
export interface Discount {
  /** Identifier of the offer/promotion that produced this discount. */
  offer_id: number;
  /** Discount amount as a formatted currency string. */
  amount: string;
  /** Human-readable description of the discount; omitted when not provided. */
  description?: string;
  /** Display name of the discount; omitted when not provided. */
  name?: string;
  /** Discount expressed as a percentage string; omitted for fixed-amount discounts. */
  percentage?: string;
}

/** A per-package line in a calculated cart summary — quantities, original vs discounted prices, and enriched campaign display fields. */
export interface SummaryLine {
  /** Reference id of the package this summary line represents. */
  package_id: number;
  /** Number of this package in the cart. */
  quantity: number;
  /** Discounts applied to this line. */
  discounts: Discount[];
  /** Per-unit price before any discounts, as a formatted currency string. */
  original_unit_price: string;
  /** Full package price before any discounts, as a formatted currency string. */
  original_package_price: string;
  /** Per-unit price after discounts, as a formatted currency string. */
  unit_price: string;
  /** Package price after discounts, as a formatted currency string. */
  package_price: string;
  /** Line subtotal before line-level discounts, as a formatted currency string. */
  subtotal: string;
  /** Total discount applied to this line, as a formatted currency string. */
  total_discount: string;
  /** Final line total after discounts, as a formatted currency string. */
  total: string;
  // Package data enriched from campaign — populated by the cart store after the API call
  /** Package display name; enriched from campaign data, absent until the cart store populates it. */
  name?: string;
  /** Package image URL; enriched from campaign data, absent until populated. */
  image?: string;
  /** Units per package; enriched from campaign data, absent until populated. */
  qty?: number;
  /** Per-unit price as a formatted string; enriched from campaign data, absent until populated. */
  price?: string;
  /** Total package price as a formatted string; enriched from campaign data, absent until populated. */
  price_total?: string;
  /** Per-unit retail/compare-at price; enriched from campaign data, absent when not set. */
  price_retail?: string;
  /** Total retail/compare-at price; enriched from campaign data, absent when not set. */
  price_retail_total?: string;
  /** Per-unit recurring price; enriched from campaign data, absent for one-time packages. */
  price_recurring?: string;
  /** Total recurring price; enriched from campaign data, absent for one-time packages. */
  price_recurring_total?: string;
  /** True when the package is a recurring subscription; enriched from campaign data. */
  is_recurring?: boolean;
  /** Recurring billing interval unit; null/absent for one-time packages. */
  interval?: 'day' | 'month' | null;
  /** Number of interval units between recurring charges; null/absent for one-time packages. */
  interval_count?: number | null;
  /** Recurring price before discounts as a formatted string; absent for one-time packages. */
  original_recurring_price?: string;
  /** ISO 4217 currency code for this line's enriched prices; absent until populated. */
  currency?: string;
  /** Underlying product name; enriched from campaign data, absent until populated. */
  product_name?: string;
  /** Product variant name (e.g. size/colour); absent when the product has no variants. */
  product_variant_name?: string;
  /** Product SKU; null when the product has no SKU, absent until populated. */
  product_sku?: string | null;
  /** Variant attribute values (e.g. colour=red); absent when the product has no variant attributes. */
  product_variant_attribute_values?: Array<{
    code: string;
    name: string;
    value: string;
  }>;
}

/** Chosen shipping method as it appears in a cart summary — its identity, original/discounted price, and applied discounts. */
export interface ShippingMethodSummary {
  /** Identifier of the shipping method. */
  id: number;
  /** Display name of the shipping method. */
  name: string;
  /** Machine-readable shipping method code. */
  code: string;
  /** Shipping price before discounts, as a formatted currency string. */
  original_price: string;
  /** Shipping price after discounts, as a formatted currency string. */
  price: string;
  /** Discounts applied to the shipping cost. */
  discounts: Discount[];
}

/** Result of a server-side cart price calculation — itemised lines, shipping, discount breakdowns, and overall totals. */
export interface CartSummary {
  /** Per-package summary lines for the cart. */
  lines: SummaryLine[];
  /** Selected shipping method and its pricing. */
  shipping_method: ShippingMethodSummary;
  /** Discounts originating from offers/promotions (not coupons). */
  offer_discounts: Discount[];
  /** Discounts originating from applied vouchers/coupons. */
  voucher_discounts: Discount[];
  /** Cart subtotal before discounts, as a formatted currency string. */
  subtotal: string;
  /** Total discount applied across the cart, as a formatted currency string. */
  total_discount: string;
  /** Final cart total after discounts and shipping, as a formatted currency string. */
  total: string;
  /** ISO 4217 currency code of the summary's monetary values. */
  currency: string;
}

/** A single line item in the server-side cart — its product, quantity, and prices with and without tax/discounts. */
export interface CartLine {
  /** Identifier of this cart line. */
  id: number;
  /** Quantity of this item in the cart. */
  quantity: number;
  /** Line price excluding tax (after discounts), as a formatted currency string. */
  price_excl_tax: string;
  /** Line price including tax (after discounts), as a formatted currency string. */
  price_incl_tax: string;
  /** Line price excluding tax before discounts, as a formatted currency string. */
  price_excl_tax_excl_discounts: string;
  /** Line price including tax before discounts, as a formatted currency string. */
  price_incl_tax_excl_discounts: string;
  /** Display title of the product on this line. */
  product_title: string;
  /** SKU of the product on this line. */
  product_sku: string;
  /** URL of the product's image. */
  image: string;
  /** True when this line was added as a post-purchase upsell. */
  is_upsell: boolean;
}

/** A completed order returned by the order API — its totals, tax, shipping, line items, customer, and post-purchase capabilities. */
export interface Order {
  /** Order reference id used in API calls and post-purchase actions. */
  ref_id: string;
  /** Human-readable order number shown to the customer. */
  number: string;
  /** ISO 4217 currency code the order was placed in. */
  currency: string;
  /** Line items included in the order. */
  lines: OrderLine[];
  /** Order total excluding tax, as a formatted currency string. */
  total_excl_tax: string;
  /** Order total including tax, as a formatted currency string. */
  total_incl_tax: string;
  /** Total tax charged on the order, as a formatted currency string. */
  total_tax: string;
  /** Total discounts applied to the order, as a formatted currency string. */
  total_discounts: string;
  /** Shipping cost excluding tax, as a formatted currency string. */
  shipping_excl_tax: string;
  /** Shipping cost including tax, as a formatted currency string. */
  shipping_incl_tax: string;
  /** Tax charged on shipping, as a formatted currency string. */
  shipping_tax: string;
  /** Display name of the chosen shipping method. */
  shipping_method: string;
  /** Machine-readable code of the chosen shipping method. */
  shipping_code: string;
  /** Pre-formatted tax label for display; omitted when not provided. */
  display_taxes?: string;
  /** Discounts applied to the order. */
  discounts: Discount[];
  /** Customer details for the order. */
  user: OrderUser;
  /** Shipping address; omitted for orders without physical shipping. */
  shipping_address?: OrderAddress;
  /** Billing address; omitted when not separately provided. */
  billing_address?: OrderAddress;
  /** Marketing attribution captured for the order; omitted when none. */
  attribution?: MarketingAttribution;
  /** URL of the order status / confirmation page. */
  order_status_url: string;
  /** URL to redirect to once payment completes; omitted when not applicable. */
  payment_complete_url?: string;
  /** True when post-purchase upsells can still be added to this order. */
  supports_post_purchase_upsells: boolean;
  /** True when the order was placed in test mode. */
  is_test: boolean;
}

/** A single line item on a completed order — its product, quantity, and prices with and without tax/discounts. */
export interface OrderLine {
  /** Identifier of this order line. */
  id: number;
  /** URL of the product's image. */
  image: string;
  /** True when this line was added as a post-purchase upsell. */
  is_upsell: boolean;
  /** Line price excluding tax (after discounts), as a formatted currency string. */
  price_excl_tax: string;
  /** Line price excluding tax before discounts, as a formatted currency string. */
  price_excl_tax_excl_discounts: string;
  /** Line price including tax (after discounts), as a formatted currency string. */
  price_incl_tax: string;
  /** Line price including tax before discounts, as a formatted currency string. */
  price_incl_tax_excl_discounts: string;
  /** SKU of the product on this line. */
  product_sku: string;
  /** Display title of the product on this line. */
  product_title: string;
  /** Longer product description; omitted when not provided. */
  product_description?: string;
  /** Variant title (e.g. size/colour); omitted when the product has no variant. */
  variant_title?: string;
  /** Quantity of this item ordered. */
  quantity: number;
}

/** Marketing attribution data (UTM tags, affiliate and click identifiers) recorded against a cart or order. */
export interface MarketingAttribution {
  /** UTM source identifying where the traffic came from; omitted when not tracked. */
  utm_source?: string;
  /** UTM medium identifying the marketing channel; omitted when not tracked. */
  utm_medium?: string;
  /** UTM campaign name; omitted when not tracked. */
  utm_campaign?: string;
  /** UTM term, typically the paid keyword; omitted when not tracked. */
  utm_term?: string;
  /** UTM content, used to differentiate ads/links; omitted when not tracked. */
  utm_content?: string;
  /** Google Ads click identifier; omitted when not present. */
  gclid?: string;
  /** Affiliate identifier crediting the referring partner; omitted when none. */
  affiliate?: string;
  /** Funnel/page-path identifier the customer entered through; omitted when not tracked. */
  funnel?: string;
  /** First-level sub-affiliate identifier; omitted when not present. */
  subaffiliate1?: string;
  /** Second-level sub-affiliate identifier; omitted when not present. */
  subaffiliate2?: string;
  /** Third-level sub-affiliate identifier; omitted when not present. */
  subaffiliate3?: string;
  /** Fourth-level sub-affiliate identifier; omitted when not present. */
  subaffiliate4?: string;
  /** Fifth-level sub-affiliate identifier; omitted when not present. */
  subaffiliate5?: string;
  /** Arbitrary additional attribution key/value pairs; omitted when none. */
  metadata?: Record<string, any>;
}

/** A shipping option offered by a campaign — its reference id, code, and price. */
export interface ShippingOption {
  /** Reference id used to select this shipping option. */
  ref_id: number;
  /** Machine-readable shipping option code. */
  code: string;
  /** Shipping price as a formatted currency string. */
  price: string;
}

/** A selectable payment method — its code and customer-facing label. */
export interface PaymentMethodOption {
  /** Machine-readable payment method code. */
  code: string;
  /** Customer-facing label for the payment method. */
  label: string;
}

/** Customer details attached to a cart. */
export interface User {
  /** Whether the customer opted in to marketing communications; omitted when not asked. */
  accepts_marketing?: boolean;
  /** Customer email address; omitted until provided. */
  email?: string;
  /** Customer's first name. */
  first_name: string;
  /** Customer's IP address; omitted when not captured. */
  ip?: string;
  /** Customer's preferred language/locale code. */
  language: string;
  /** Customer's last name. */
  last_name: string;
  /** Customer phone number; omitted until provided. */
  phone_number?: string;
  /** Browser user-agent string of the customer; omitted when not captured. */
  user_agent?: string;
}

/** Customer details attached to a completed order. */
export interface OrderUser {
  /** Whether the customer opted in to marketing communications; omitted when not asked. */
  accepts_marketing?: boolean;
  /** Customer email address; omitted when not provided. */
  email?: string;
  /** Customer's first name. */
  first_name: string;
  /** Customer's IP address; omitted when not captured. */
  ip?: string;
  /** Customer's preferred language/locale code. */
  language: string;
  /** Customer's last name. */
  last_name: string;
  /** Customer phone number; omitted when not provided. */
  phone_number?: string;
  /** Browser user-agent string of the customer; omitted when not captured. */
  user_agent?: string;
}

/** A postal address as stored on a completed order. */
export interface OrderAddress {
  /** ISO country code of the address. */
  country: string;
  /** Recipient's first name. */
  first_name: string;
  /** Recipient's last name. */
  last_name: string;
  /** First address line (street address). */
  line1: string;
  /** Second address line (e.g. apartment/suite); omitted when unused. */
  line2?: string;
  /** Third address line; omitted when unused. */
  line3?: string;
  /** City (mapped to address line 4). */
  line4: string; // City
  /** Delivery notes/instructions; omitted when none. */
  notes?: string;
  /** Contact phone number for the address; omitted when none. */
  phone_number?: string;
  /** Postal/ZIP code; omitted when not applicable. */
  postcode?: string;
  /** State/province/region; omitted when not applicable. */
  state?: string;
}

/** A voucher/coupon applied to a cart — its display name and discount amount. */
export interface Voucher {
  /** Discount amount granted by the voucher, as a formatted currency string. */
  amount: string;
  /** Human-readable description of the voucher; omitted when not provided. */
  description?: string;
  /** Display name/code of the voucher; omitted when not provided. */
  name?: string;
}

/**
 * Supported payment method identifiers for order creation and express checkout.
 */
export type PaymentMethod =
  | 'apple_pay'
  | 'card_token'
  | 'paypal'
  | 'klarna'
  | 'ideal'
  | 'bancontact'
  | 'giropay'
  | 'google_pay'
  | 'sofort'
  | 'sepa_debit'
  | 'external';

// Request/Response types
/** Base request payload for creating or updating a cart — its lines, user, optional address, attribution, and vouchers. */
export interface CartBase {
  /** Customer address to associate with the cart; omitted when not yet collected. */
  address?: AddressCart;
  /** Marketing attribution to record on the cart; omitted when none. */
  attribution?: Attribution;
  /** ISO 4217 currency code to price the cart in; omitted to use the campaign default. */
  currency?: string;
  /** Line items to place in the cart. */
  lines: LineWithUpsell[];
  /** Customer details for the cart. */
  user: UserCreateCart;
  /** Voucher/coupon codes to apply to the cart; omitted when none. */
  vouchers?: string[];
}

/** Address payload sent when creating or updating a cart. */
export interface AddressCart {
  /** ISO country code of the address. */
  country: string;
  /** Recipient's first name. */
  first_name: string;
  /** Recipient's last name. */
  last_name: string;
  /** First address line (street address). */
  line1: string;
  /** Second address line (e.g. apartment/suite); omitted when unused. */
  line2?: string;
  /** Third address line; omitted when unused. */
  line3?: string;
  /** City (mapped to address line 4). */
  line4: string; // City
  /** Delivery notes/instructions; omitted when none. */
  notes?: string;
  /** Contact phone number for the address; omitted when none. */
  phone_number?: string;
  /** Postal/ZIP code; omitted when not applicable. */
  postcode?: string;
  /** State/province/region; omitted when not applicable. */
  state?: string;
}

/** Marketing attribution payload sent with cart/order requests — UTM tags, affiliate and click identifiers. */
export interface Attribution {
  /** Affiliate identifier crediting the referring partner; omitted when none. */
  affiliate?: string;
  /** Funnel/page-path identifier the customer entered through; omitted when not tracked. */
  funnel?: string;
  /** Google Ads click identifier; omitted when not present. */
  gclid?: string;
  /** Arbitrary additional attribution key/value pairs; omitted when none. */
  metadata?: Record<string, any>;
  /** First-level sub-affiliate identifier; omitted when not present. */
  subaffiliate1?: string;
  /** Second-level sub-affiliate identifier; omitted when not present. */
  subaffiliate2?: string;
  /** Third-level sub-affiliate identifier; omitted when not present. */
  subaffiliate3?: string;
  /** Fourth-level sub-affiliate identifier; omitted when not present. */
  subaffiliate4?: string;
  /** Fifth-level sub-affiliate identifier; omitted when not present. */
  subaffiliate5?: string;
  /** UTM campaign name; omitted when not tracked. */
  utm_campaign?: string;
  /** UTM content, used to differentiate ads/links; omitted when not tracked. */
  utm_content?: string;
  /** UTM medium identifying the marketing channel; omitted when not tracked. */
  utm_medium?: string;
  /** UTM source identifying where the traffic came from; omitted when not tracked. */
  utm_source?: string;
  /** UTM term, typically the paid keyword; omitted when not tracked. */
  utm_term?: string;
  /** Everflow tracking transaction identifier; omitted when not present. */
  everflow_transaction_id?: string;
}

/** A line item in a cart/order request, optionally flagged as an upsell. */
export interface LineWithUpsell {
  /** True when this line should be treated as a post-purchase upsell; omitted/false otherwise. */
  is_upsell?: boolean;
  /** Reference id of the package to add. */
  package_id: number;
  /** Quantity of the package to add. */
  quantity: number;
}

/** Customer details payload sent when creating a cart. */
export interface UserCreateCart {
  /** Whether the customer opted in to marketing communications; omitted when not asked. */
  accepts_marketing?: boolean;
  /** Customer email address; omitted until provided. */
  email?: string;
  /** Customer's first name. */
  first_name: string;
  /** Customer's preferred language/locale code. */
  language: string;
  /** Customer's last name. */
  last_name: string;
  /** Customer phone number; omitted until provided. */
  phone_number?: string;
}

/** Request payload for creating an order — lines, payment, addresses, shipping method, redirect URLs, and vouchers. */
export interface CreateOrder {
  /** Marketing attribution to record on the order; omitted when none. */
  attribution?: Attribution;
  /** Billing address; omitted when billing matches shipping or a default is used. */
  billing_address?: Address;
  /** When true, reuse the shipping address as the billing address; omitted to use explicit values. */
  billing_same_as_shipping_address?: boolean;
  /** ISO 4217 currency code to place the order in; omitted to use the campaign default. */
  currency?: string;
  /** Line items to include in the order. */
  lines: LineWithUpsell[];
  /** Payment details (method and gateway) for the order. */
  payment_detail: Payment;
  /** URL to redirect to if payment fails; omitted when not applicable. */
  payment_failed_url?: string;
  /** Shipping address; omitted when a default address is used. */
  shipping_address?: Address;
  /** Identifier of the chosen shipping method. */
  shipping_method: number;
  /** URL to redirect to on successful order completion. */
  success_url: string;
  /** When true, use the stored default billing address; omitted to use explicit values. */
  use_default_billing_address?: boolean;
  /** When true, use the stored default shipping address; omitted to use explicit values. */
  use_default_shipping_address?: boolean;
  /** Customer details for the order; omitted when reusing an existing cart's user. */
  user?: OrderUser;
  /** Voucher/coupon codes to apply to the order; omitted when none. */
  vouchers?: string[];
}

/** Request payload for calculating a cart summary without persisting a cart — lines, vouchers, currency, and shipping. */
export interface CartCalculateSummary {
  /** Line items to price in the calculation. */
  lines: LineWithUpsell[];
  /** Voucher/coupon codes to factor into the calculation; omitted when none. */
  vouchers?: string[];
  /** ISO 4217 currency code to calculate in; null/omitted to use the campaign default. */
  currency?: string | null;
  /** Shipping method id to include in the calculation; omitted when shipping is not yet chosen. */
  shipping_method?: number;
}

/** Address payload that may also be flagged as the customer's default billing/shipping address. */
export interface Address {
  /** ISO country code of the address. */
  country: string;
  /** Recipient's first name. */
  first_name: string;
  /** When true, mark this address as the customer's default billing address; omitted otherwise. */
  is_default_for_billing?: boolean;
  /** When true, mark this address as the customer's default shipping address; omitted otherwise. */
  is_default_for_shipping?: boolean;
  /** Recipient's last name. */
  last_name: string;
  /** First address line (street address). */
  line1: string;
  /** Second address line (e.g. apartment/suite); omitted when unused. */
  line2?: string;
  /** Third address line; omitted when unused. */
  line3?: string;
  /** City (mapped to address line 4). */
  line4: string; // City
  /** Delivery notes/instructions; omitted when none. */
  notes?: string;
  /** Contact phone number for the address; omitted when none. */
  phone_number?: string;
  /** Postal/ZIP code; omitted when not applicable. */
  postcode?: string;
  /** State/province/region; omitted when not applicable. */
  state?: string;
}

/** Payment details for an order — the method and, where applicable, the card token or gateway selection. */
export interface Payment {
  /** Tokenised card reference for card payments; omitted for non-card methods. */
  card_token?: string;
  /** Identifier of the external payment method when paying outside the standard gateways; omitted otherwise. */
  external_payment_method?: string;
  /** Specific payment gateway id to charge through; omitted to use the default. */
  payment_gateway?: number;
  /** Payment gateway group id to route through; omitted to use the default. */
  payment_gateway_group?: number;
  /** The payment method being used. */
  payment_method: PaymentMethod;
}

/** Request payload for adding post-purchase upsell lines to an existing order. */
export interface AddUpsellLine {
  /** Upsell line items to add to the order. */
  lines: UpsellLineItem[];
  /** Payment routing details for the upsell charge; omitted to reuse the order's payment. */
  payment_detail?: PaymentDetail;
  /** ISO 4217 currency code for the upsell; omitted to use the order's currency. */
  currency?: string;
  /** Voucher/coupon codes to apply to the upsell; omitted when none. */
  vouchers?: string[];
}

/** A single package and quantity to add as a post-purchase upsell. */
export interface UpsellLineItem {
  /** Reference id of the package to add as an upsell. */
  package_id: number;
  /** Quantity of the package to add. */
  quantity: number;
}

/** Payment gateway routing details used when charging a post-purchase upsell. */
export interface PaymentDetail {
  /** Specific payment gateway id to charge the upsell through; omitted to use the default. */
  payment_gateway?: number;
  /** Payment gateway group id to route the upsell through; omitted to use the default. */
  payment_gateway_group?: number;
}

/** A single address suggestion returned by address autocomplete — its display label and structured address parts. */
export interface AddressAutocompleteResult {
  /** Human-readable label for the suggested address. */
  label: string;
  /** Structured components of the suggested address. */
  address: {
    line1: string;
    line2?: string;
    line3?: string;
    city: string;
    state: string;
    state_code: string;
    postcode: string;
    country: string;
    country_code: string;
  };
}

/** Response wrapper for an address autocomplete query — the list of matching suggestions. */
export interface AddressAutocomplete {
  /** Address suggestions matching the query. */
  results: AddressAutocompleteResult[];
}
