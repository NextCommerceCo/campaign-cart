/** A discount an offer or a coupon gives, as the Campaigns API reports it. */
export interface SummaryDiscount {
  /** The offer that gave it. */
  offer_id?: number;
  name?: string;
  description?: string;
  /** The percentage taken off, when the offer is a percentage. */
  percentage?: string;
  /** The amount taken off. */
  amount: string;
}

/** One priced line of a {@link CartSummary}. Prices are decimal strings in the cart's currency. */
export interface SummaryLine {
  /** The package's `ref_id` in the campaign. */
  package_id: number;
  /** Package quantity. */
  quantity: number;
  /** Unit price after discounts. */
  unit_price: string;
  /** Unit price before discounts. */
  original_unit_price: string;
  /** Package price after discounts. */
  package_price: string;
  /** Package price before discounts. */
  original_package_price: string;
  /** Line total before discounts. */
  subtotal: string;
  /** Total discount on the line. */
  total_discount: string;
  /** Line total after discounts. */
  total: string;
  /** Discounts on the line. */
  discounts: SummaryDiscount[];
  /** `true` for a subscription package. */
  is_recurring?: boolean;
  /** How often a subscription renews. */
  interval?: 'day' | 'month' | null;
  /** How many `interval`s between renewals. */
  interval_count?: number | null;
  /** The price each renewal charges. */
  price_recurring?: string | null;
  original_recurring_price?: string | null;
}

/** The cart as the Campaigns API priced it. Prices are decimal strings in `currency`. */
export interface CartSummary {
  lines: SummaryLine[];
  /** The selected shipping method, priced. */
  shipping_method?: {
    id: number;
    name: string;
    code: string;
    /** Shipping price after discounts. */
    price: string;
    /** Shipping price before discounts. */
    original_price: string;
    discounts?: SummaryDiscount[];
  };
  /** Offer discounts on the cart. */
  offer_discounts: SummaryDiscount[];
  /** Coupon discounts on the cart. */
  voucher_discounts: SummaryDiscount[];
  /** Cart subtotal before discounts. */
  subtotal: string;
  /** Total discount on the cart. */
  total_discount: string;
  /** Cart total after discounts. */
  total: string;
  /** ISO 4217, such as `USD`. */
  currency: string;
}

export interface CartLine {
  packageId: number;
  quantity: number;
  isUpsell?: boolean;
  properties?: Record<string, string>;
}

/** A package and how many of it: what the cart holds and what the API is sent. */
export interface Line {
  /** The package's `ref_id` in the campaign. */
  package_id: number;
  /** Package quantity. */
  quantity: number;
  /** `true` for a line added after the order. */
  is_upsell?: boolean;
  /** Line properties, such as a variant picked in a bundle slot. */
  properties?: Record<string, string>;
}

export interface CartGroup {
  lines: CartLine[];
  vouchers: string[];
}

export interface CartState {
  groups: Record<string, CartGroup>;
  coupons: string[];
  dismissed: string[];
  shippingId?: number;
  summary?: CartSummary;
  calculating: boolean;
  frozen: boolean;
  reported?: ReportedLine[];
  added?: boolean;
}

export interface ReportedLine {
  package_id: number;
  quantity: number;
  price: number;
}

export type SelectorMode = 'swap' | 'select' | 'offer';

export interface SelectorLine extends CartLine {
  configurable?: boolean;
}

export interface Slot {
  packageId: number;
  properties?: Record<string, string>;
}

export interface SelectorCard extends CartGroup {
  id: string;
  lines: SelectorLine[];
  shippingId?: number;
  quantity?: number;
  min?: number;
  max?: number;
}

export interface SelectorState {
  mode: SelectorMode;
  cards: SelectorCard[];
  picked?: string;
  quantities?: Record<string, number>;
  slots?: Record<string, Slot[]>;
  quotes?: Record<string, CartSummary>;
  quoting?: boolean;
}

export interface Toggle {
  key: string;
  quantity: number;
  line?: SummaryLine;
}
