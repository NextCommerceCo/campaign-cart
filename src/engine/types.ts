import type { Attribution, Visit } from './visit/attribution';
import type { CartState, Line, SelectorState, Toggle } from './cart/types';
import type { VisitorGeo } from './visit/geo';

export type Send = (url: string, init: RequestInit) => Promise<Response>;

export interface Package {
  ref_id: number;
  external_id: number;
  name: string;
  price: string;
  price_total: string;
  price_retail?: string;
  price_retail_total?: string;
  qty: number;
  image: string;
  is_recurring: boolean;
  interval?: 'day' | 'month' | null;
  interval_count?: number | null;
  price_recurring?: string | null;
  product_name?: string;
  product_variant_name?: string;
  product_sku?: string | null;
  product_id?: number;
  product_variant_id?: number;
  product_purchase_availability?: string;
  product_variant_attribute_values?: Array<{ code: string; name: string; value: string }>;
}

export interface ShippingOption {
  ref_id: number;
  code: string;
  price: string;
}

export interface Campaign {
  id: number;
  name: string;
  currency: string;
  language: string;
  packages: Package[];
  shipping_methods: ShippingOption[];
  payment_env_key?: string;
  available_shipping_countries?: Array<{ code: string; label: string }>;
  available_currencies?: Array<{ code: string; label: string }>;
  available_payment_methods?: Array<{ code: string; label: string }>;
  available_express_payment_methods?: Array<{ code: string; label: string }>;
}

export interface VisitState {
  params: Record<string, string>;
  landing?: Visit;
  geo?: VisitorGeo;
  /** What the page set with `setMetadata`, sent in the attribution's `metadata`. */
  metadata?: Record<string, string | number>;
  exitIntentShown: number;
  timers: Record<string, number>;
}

/** Why a field or a submit did not pass. */
export interface CheckoutError {
  /** `blank`, `invalid`, `not_selected`, `declined`, … */
  code: string;
  /** The message shown, in the page's language. */
  message?: string;
  /** The gateway's decline code, for a declined card. */
  decline?: string;
  /** The request field the API refused (`lines`, `shipping_address`, …), for an order it refused by field. */
  field?: string;
  /** `true` when the address service only warns: the order can still be sent. */
  warning?: boolean;
}

/** One line of an {@link ApiOrder}. Prices are decimal strings in the order's currency. */
export interface ApiOrderLine {
  /** Order line ID. */
  id: number | string;
  /** The package's `ref_id` in the campaign. */
  package?: number | null;
  /** Product image. */
  image?: string;
  /** `true` for a line an upsell added. */
  is_upsell?: boolean;
  /** Line price before tax. */
  price_excl_tax: string;
  /** Line price before tax and discounts. */
  price_excl_tax_excl_discounts?: string;
  /** Line price including tax. */
  price_incl_tax: string;
  /** Line price including tax, before discounts. */
  price_incl_tax_excl_discounts?: string;
  /** The product's Stock Keeping Unit. */
  product_sku?: string;
  /** The product's name as shown to customers. */
  product_title: string;
  product_description?: string;
  variant_title?: string;
  /** Total product units from the package. */
  quantity: number;
  product_id?: number | null;
  variant_id?: number | null;
}

/** A shipping or billing address on an {@link ApiOrder}. */
export interface ApiOrderAddress {
  first_name?: string;
  last_name?: string;
  /** Street address: house number and street name. */
  line1?: string;
  /** Apartment, suite, unit, building or floor. */
  line2?: string;
  /** City. */
  line4?: string;
  /** State, province or region code. */
  state?: string;
  /** Postal or ZIP code. */
  postcode?: string;
  /** ISO 3166-1 alpha-2. */
  country?: string;
  /** E.164. */
  phone_number?: string;
}

/** An address the SDK sends with an order or an Open Cart: the fields every country has are always there. */
export type ApiAddress = ApiOrderAddress &
  Required<Pick<ApiOrderAddress, 'first_name' | 'last_name' | 'line1' | 'line4' | 'country'>>;

/**
 * The Cart the store created from the shopper's contact details: an Open Cart in the dashboard.
 * The Campaigns API answers with more fields (`user`, `lines`, `discounts`, the other totals).
 */
export interface OpenCart {
  /** The store's checkout for this cart. */
  checkout_url: string;
  /** ISO 4217, such as `USD`. */
  currency: string;
  /** Total price including tax. */
  total_incl_tax: string;
  /** The shopper as the store recorded them, with the IP and user agent of the request. */
  user?: { ip?: string | null; user_agent?: string | null; language?: string };
  [field: string]: unknown;
}

/** The shopper on an order or an Open Cart the SDK sends. */
export interface OrderUser {
  email?: string;
  first_name: string;
  last_name: string;
  language: string;
  phone_number?: string;
  accepts_marketing: boolean;
}

/** `POST /orders/`. */
export interface OrderBody {
  lines: Line[];
  shipping_address?: ApiAddress;
  billing_same_as_shipping_address?: boolean;
  billing_address?: ApiAddress;
  shipping_method: number;
  payment_detail: { payment_method: string; card_token?: string };
  user?: OrderUser;
  vouchers: string[];
  attribution: Attribution;
  currency: string;
  success_url: string;
  payment_failed_url: string;
}

/** `POST /carts/`: the Open Cart. */
export interface ProspectBody {
  lines: Line[];
  user: OrderUser;
  currency: string;
  attribution: Attribution;
}

/** One answer of `GET /addresses/autocomplete/`. */
export interface AddressSuggestion {
  label: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    state_code: string;
    postcode: string;
    country: string;
    country_code: string;
  };
}

/** An order from the Campaigns API. Prices are decimal strings in `currency`. */
export interface ApiOrder {
  /** Order reference ID: the `ref_id` in post-purchase page URLs. */
  ref_id: string;
  /** Order number, as the customer sees it. */
  number?: string | number;
  /** ISO 4217, such as `USD`. */
  currency?: string;
  lines?: ApiOrderLine[];
  /** Total price before tax. */
  total_excl_tax?: string;
  /** Total price including tax. */
  total_incl_tax?: string;
  /** Total tax on the order. */
  total_tax?: string;
  /** Total discount on the order. */
  total_discounts?: string;
  /** Shipping price before tax. */
  shipping_excl_tax?: string;
  /** Shipping price including tax. */
  shipping_incl_tax?: string;
  /** Shipping method name. */
  shipping_method?: string;
  /** The customer. */
  user?: { first_name?: string; last_name?: string; email?: string; phone_number?: string };
  shipping_address?: ApiOrderAddress;
  billing_address?: ApiOrderAddress;
  /** Payment method used for the order. */
  payment_method?: string | { code?: string } | null;
  /** `true` when upsells can be added to this order. */
  supports_post_purchase_upsells?: boolean;
  /** Where the shopper pays, for a method that sends them to a payment gateway. */
  payment_complete_url?: string | null;
  /** The order's status page. */
  order_status_url?: string;
  /** `true` for a test order. */
  is_test?: boolean;
}

/** The parts of State an action changes with `update()`. */
export type Slice = Exclude<keyof State, 'locale'>;

/** The boot slices; a lazy chunk adds its own (`checkout`, `order`, `debug`) with `declare module`. */
export interface State {
  campaign?: Campaign;
  /** The page's language (0.4.x `nextConfig.locale`), over the campaign's. */
  locale?: string;
  cart: CartState;
  selectors: Record<string, SelectorState>;
  toggles: Record<number, Toggle>;
  visit: VisitState;
}
