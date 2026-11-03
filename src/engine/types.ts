import type { CheckoutState } from '../checkout/state/types';
import type { OrderState } from '../order/state';
import type { Visit } from './attribution';
import type { CartState, Selector, Toggle } from './cart/types';

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
  name: string;
  currency: string;
  language: string;
  packages: Package[];
  shipping_methods: ShippingOption[];
  payment_env_key?: string;
  available_shipping_countries?: Array<{ code: string; label: string }>;
  available_payment_methods?: Array<{ code: string; label: string }>;
  available_express_payment_methods?: Array<{ code: string; label: string }>;
}

export interface VisitState {
  params: Record<string, string>;
  landing?: Visit;
  exitIntentShown: number;
  timers: Record<string, number>;
}

export interface CheckoutError {
  code: string;
  message?: string;
  decline?: string;
  warning?: boolean;
}

export interface OrderLine {
  id: number | string;
  package?: number;
  image?: string;
  is_upsell?: boolean;
  price_excl_tax: string;
  price_excl_tax_excl_discounts?: string;
  price_incl_tax: string;
  price_incl_tax_excl_discounts?: string;
  product_sku?: string;
  product_title: string;
  product_description?: string;
  variant_title?: string;
  quantity: number;
  product_id?: number;
  variant_id?: number;
}

export interface OrderAddress {
  first_name?: string;
  last_name?: string;
  line1?: string;
  line2?: string;
  line4?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone_number?: string;
}

export interface Order {
  ref_id: string;
  number?: string | number;
  currency?: string;
  lines?: OrderLine[];
  total_excl_tax?: string;
  total_incl_tax?: string;
  total_tax?: string;
  total_discounts?: string;
  shipping_excl_tax?: string;
  shipping_incl_tax?: string;
  shipping_method?: string;
  user?: { first_name?: string; last_name?: string; email?: string; phone_number?: string };
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress;
  payment_method?: string | { code?: string } | null;
  supports_post_purchase_upsells?: boolean;
  payment_complete_url?: string | null;
  order_status_url?: string;
}

export interface State {
  campaign?: Campaign;
  cart: CartState;
  selectors: Record<string, Selector>;
  toggles: Record<number, Toggle>;
  visit: VisitState;
  checkout?: CheckoutState;
  order?: OrderState;
}
