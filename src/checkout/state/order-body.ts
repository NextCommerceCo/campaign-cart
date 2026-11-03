import type { Attribution } from '../../engine/attribution';
import { shippingMethodOf } from '../../engine/cart/cart';
import type { Address, ApiLine, CheckoutState, OrderBody, OrderUser, State } from '../../engine/types';
import { phoneOf } from './phone';
import { hasField } from './rules';

export const EXPRESS_METHODS = ['paypal', 'apple_pay', 'google_pay', 'shop_pay'];
const LANGUAGE = 'en';

export function paymentCode(word: string): string {
  const code = word.trim().toLowerCase().replace(/-/g, '_');
  return ['credit', 'credit_card', 'card', 'card_token'].includes(code) ? 'card_token' : code;
}

export interface OrderUrls {
  successUrl?: string;
  failureUrl: string;
  pageUrl: string;
}

export const userOf = (fields: Record<string, string>, phone?: string): OrderUser => ({
  email: fields.email?.trim() ?? '',
  first_name: fields.first_name?.trim() ?? '',
  last_name: fields.last_name?.trim() ?? '',
  language: LANGUAGE,
  ...(phone && { phone_number: phone }),
  accepts_marketing: fields.accepts_marketing !== 'false',
});

function address(checkout: CheckoutState, prefix: '' | 'billing_', phone?: string): Address {
  const { fields, rules } = checkout;
  const country = rules[fields[`${prefix}country`] ?? ''];
  const get = (name: string) => (hasField(country, name) && fields[prefix + name]?.trim()) || undefined;
  const optional = { line2: get('line2'), state: get('state'), postcode: get('postcode'), phone_number: phone };
  return {
    first_name: get('first_name') ?? '',
    last_name: get('last_name') ?? '',
    line1: get('line1') ?? '',
    line4: get('city') ?? '',
    country: get('country') ?? '',
    ...Object.fromEntries(Object.entries(optional).filter(([, v]) => v)),
  };
}

export function orderBody(
  state: State,
  order: {
    method: string;
    token?: string;
    lines: ApiLine[];
    vouchers: string[];
    attribution: Attribution;
    urls: OrderUrls;
  },
): OrderBody {
  const { method, token, urls } = order;
  const campaign = state.campaign!;
  const body: OrderBody = {
    lines: order.lines,
    vouchers: order.vouchers,
    attribution: order.attribution,
    currency: campaign.currency,
    shipping_method: shippingMethodOf(state) ?? 1,
    payment_detail: { payment_method: method, ...(token && { card_token: token }) },
    success_url: new URL(urls.successUrl ?? '/success', urls.pageUrl).href,
    payment_failed_url: urls.failureUrl,
  };
  if (EXPRESS_METHODS.includes(method)) return body;
  const checkout = state.checkout!;
  const phone = phoneOf(checkout, 'phone_number');
  return {
    ...body,
    user: userOf(checkout.fields, phone),
    shipping_address: address(checkout, '', phone),
    billing_same_as_shipping_address: checkout.sameAsShipping,
    ...(!checkout.sameAsShipping && {
      billing_address: address(checkout, 'billing_', phoneOf(checkout, 'billing_phone_number')),
    }),
  };
}
