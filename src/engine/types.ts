import type { Attribution, Visit } from './attribution';

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

export interface VisitState {
  params: Record<string, string>;
  landing?: Visit;
  exitIntentShown: number;
  timers: Record<string, number>;
}

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

export interface CountryOption {
  code: string;
  name: string;
}

export type FieldError =
  'blank' | 'not_selected' | 'invalid' | 'invalid_characters' | 'contains_emoji' | 'too_long' | 'not_in_state';

export interface FieldRule {
  required: boolean;
  label?: string;
  label_optional?: string;
  autocomplete?: string;
  input?: {
    type?: string;
    placeholder?: string;
    max_length?: number;
    input_mode?: string;
    auto_capitalize?: string;
    span?: number;
  };
  format?: { pattern?: string; masks?: unknown };
  errors?: Partial<Record<FieldError, string>>;
}

export interface CountryRules {
  country: CountryOption;
  fields: Partial<Record<string, FieldRule>>;
  states?: CountryOption[];
  address?: { layout: string[][] };
}

export interface CheckoutError {
  code: string;
  message?: string;
  decline?: string;
  warning?: boolean;
}

export interface CheckoutState {
  fields: Record<string, string>;
  phoneE164?: string;
  sameAsShipping: boolean;
  paymentMethod: string;
  step: number;
  errors: Record<string, CheckoutError>;
  status: 'idle' | 'placing' | 'placed';
  countries: CountryOption[];
  rules: Record<string, CountryRules>;
  rulesDown?: boolean;
  prospectSaved: boolean;
  pendingRef?: string;
  failurePath?: string;
}

export interface Toggle {
  key: string;
  quantity: number;
  line?: SummaryLine;
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

export interface Address {
  first_name: string;
  last_name: string;
  line1: string;
  line2?: string;
  line4: string;
  state?: string;
  postcode?: string;
  country: string;
  phone_number?: string;
}

export interface OrderUser {
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  phone_number?: string;
  accepts_marketing: boolean;
}

export interface OrderBody {
  lines: ApiLine[];
  shipping_address?: Address;
  billing_same_as_shipping_address?: boolean;
  billing_address?: Address;
  shipping_method: number;
  payment_detail: { payment_method: string; card_token?: string };
  user?: OrderUser;
  vouchers: string[];
  attribution: Attribution;
  currency: string;
  success_url: string;
  payment_failed_url: string;
}

export interface ProspectBody {
  lines: ApiLine[];
  user: OrderUser;
  currency: string;
  attribution: Attribution;
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

export interface OrderState {
  refId?: string;
  order?: Order;
  loadedAt?: number;
  status: 'idle' | 'loading' | 'ready' | 'failed' | 'accepting';
  error?: CheckoutError;
  accepted: string[];
  coupon?: { refId: string; code: string };
}

export interface ExitIntentDetail {
  imageUrl?: string;
  template?: string;
}

export interface EventMap {
  'campaign.loaded': { campaign: Campaign; fromCache: boolean };
  'cart.updated': { cart: CartState };
  'cart.calculated': { summary: CartSummary };
  'coupon.refused': { code: string };
  'selection.changed': { selectorId: string; cardId: string; items: CartLine[] };
  'shipping.changed': { methodId: number | undefined };
  'storage.degraded': { reason: string };
  ready: { lines: ApiLine[] };
  'checkout.started': { lines: ApiLine[] };
  'checkout.shipping-added': { tier: string };
  'checkout.payment-added': { method: string };
  'prospect.saved': { cart: unknown; email: string; phone?: string };
  'order.placed': { order: Order };
  'order.loaded': {
    order: Order;
    purchase?: string;
    coupon?: string;
    upsells?: Array<{ id: string; number: number; line: OrderLine }>;
  };
  'upsell.viewed': { refId: string; page: string };
  'upsell.accepted': { refId: string; lines: ApiLine[] };
  'upsell.skipped': { refId: string; packageId?: number };
  'exit-intent.shown': ExitIntentDetail;
  'exit-intent.clicked': ExitIntentDetail;
  'exit-intent.dismissed': ExitIntentDetail;
  'exit-intent.closed': ExitIntentDetail;
  'exit-intent.action': ExitIntentDetail & { action?: string; couponCode?: string };
  error: { action: string; message: string };
}

export type EventName = keyof EventMap;
