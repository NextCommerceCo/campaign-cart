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
}

export interface ShippingOption {
  ref_id: number;
  code: string;
  price: string;
}

export interface Campaign {
  name: string;
  currency: string;
  language: string;
  packages: Package[];
  shipping_methods: ShippingOption[];
  payment_env_key?: string;
}

export interface Discount {
  offer_id?: number;
  name?: string;
  description?: string;
  amount: string;
}

export interface SummaryLine {
  package_id: number;
  quantity: number;
  unit_price: string;
  package_price: string;
  original_package_price: string;
  subtotal: string;
  total_discount: string;
  total: string;
  discounts: Discount[];
}

export interface CartSummary {
  lines: SummaryLine[];
  shipping_method?: { id: number; name: string; code: string; price: string; original_price: string };
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
}

export interface State {
  campaign?: Campaign;
  cart: CartState;
  selections: Record<string, string>;
  params: Record<string, string>;
}

export interface EventMap {
  'campaign.loaded': { campaign: Campaign; fromCache: boolean };
  'cart.updated': { cart: CartState };
  'cart.calculated': { summary: CartSummary };
  'selection.changed': { selectorId: string; cardId: string; items: CartLine[] };
  'shipping.changed': { methodId: number | undefined };
  'storage.degraded': { reason: string };
  'ready': Record<string, never>;
  'error': { action: string; message: string };
}

export type EventName = keyof EventMap;
