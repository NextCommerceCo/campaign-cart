import type { Visit } from './attribution';

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
  product_name?: string;
  product_variant_name?: string;
  product_sku?: string | null;
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
}

export type SelectorMode = 'swap' | 'select' | 'offer';

export interface SelectorCard extends CartGroup {
  id: string;
  shippingId?: number;
}

export interface Selector {
  mode: SelectorMode;
  cards: SelectorCard[];
  picked?: string;
  quotes?: Record<string, CartSummary>;
  quoting?: boolean;
}

export interface VisitState {
  params: Record<string, string>;
  landing?: Visit;
  exitIntentShown: number;
}

export interface State {
  campaign?: Campaign;
  cart: CartState;
  selectors: Record<string, Selector>;
  visit: VisitState;
}

export interface ExitIntentDetail {
  imageUrl?: string;
  template?: string;
}

export interface EventMap {
  'campaign.loaded': { campaign: Campaign; fromCache: boolean };
  'cart.updated': { cart: CartState };
  'cart.calculated': { summary: CartSummary };
  'selection.changed': { selectorId: string; cardId: string; items: CartLine[] };
  'shipping.changed': { methodId: number | undefined };
  'storage.degraded': { reason: string };
  ready: { lines: ApiLine[] };
  'exit-intent.shown': ExitIntentDetail;
  'exit-intent.clicked': ExitIntentDetail;
  'exit-intent.dismissed': ExitIntentDetail;
  'exit-intent.closed': ExitIntentDetail;
  'exit-intent.action': ExitIntentDetail & { action?: string; couponCode?: string };
  error: { action: string; message: string };
}

export type EventName = keyof EventMap;
