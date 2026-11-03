export interface Discount {
  offer_id?: number;
  name?: string;
  description?: string;
  percentage?: string;
  amount: string;
}

export interface SummaryLine {
  package_id: number;
  quantity: number;
  unit_price: string;
  original_unit_price: string;
  package_price: string;
  original_package_price: string;
  subtotal: string;
  total_discount: string;
  total: string;
  discounts: Discount[];
  is_recurring?: boolean;
  interval?: 'day' | 'month' | null;
  interval_count?: number | null;
  price_recurring?: string | null;
  original_recurring_price?: string | null;
}

export interface CartSummary {
  lines: SummaryLine[];
  shipping_method?: {
    id: number;
    name: string;
    code: string;
    price: string;
    original_price: string;
    discounts?: Discount[];
  };
  offer_discounts: Discount[];
  voucher_discounts: Discount[];
  subtotal: string;
  total_discount: string;
  total: string;
  currency: string;
}

export interface CartLine {
  packageId: number;
  quantity: number;
  isUpsell?: boolean;
  properties?: Record<string, string>;
}

export interface ApiLine {
  package_id: number;
  quantity: number;
  is_upsell?: boolean;
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

export interface Selector {
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
