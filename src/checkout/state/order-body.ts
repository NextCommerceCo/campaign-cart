import type { Attribution } from '../../engine/visit/attribution';
import { shippingMethodOf } from '../../engine/cart/public';
import { nextUrl } from '../../engine/visit/params';
import type { Line } from '../../engine/cart/types';
import type { ApiAddress, OrderBody, OrderUser, State } from '../../engine/types';
import type { Address } from '../../engine/events/checkout';
import { addressFromApi } from '../../engine/order/address';
import { addressToApi } from '../../engine/order/address-line';
import type { CheckoutState } from './types';
import { phoneOf } from './phone';
import { hasField } from './rules';

export interface OrderUrls {
  successUrl?: string;
  failureUrl: string;
  pageUrl: string;
}

export const userOf = (fields: Record<string, string>, language: string, phone?: string): OrderUser => ({
  ...(fields.email?.trim() && { email: fields.email.trim() }),
  first_name: fields.first_name?.trim() ?? '',
  last_name: fields.last_name?.trim() ?? '',
  language,
  ...(phone && { phone_number: phone }),
  accepts_marketing: fields.accepts_marketing !== 'false',
});

function address(checkout: CheckoutState, prefix: '' | 'billing_', phone?: string): ApiAddress {
  const { fields, rules } = checkout;
  const country = rules[fields[`${prefix}country`] ?? ''];
  return addressToApi((name) => (hasField(country, name) && fields[prefix + name]?.trim()) || undefined, phone);
}

/** Only for an `addressValid` address, whose country is set. */
export const publicAddress = (checkout: CheckoutState, prefix: '' | 'billing_'): Address =>
  addressFromApi(address(checkout, prefix, phoneOf(checkout, `${prefix}phone_number`)))!;

export function orderBody(
  state: State,
  order: {
    method: string;
    express?: boolean;
    token?: string;
    lines: Line[];
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
    success_url: nextUrl(urls.successUrl ?? '/success', new URL(urls.pageUrl), state.visit.params),
    payment_failed_url: urls.failureUrl,
  };
  if (order.express) return body;
  const checkout = state.checkout!;
  const phone = phoneOf(checkout, 'phone_number');
  return {
    ...body,
    user: userOf(checkout.fields, campaign.language, phone),
    shipping_address: address(checkout, '', phone),
    billing_same_as_shipping_address: checkout.sameAsShipping,
    ...(!checkout.sameAsShipping && {
      billing_address: address(checkout, 'billing_', phoneOf(checkout, 'billing_phone_number')),
    }),
  };
}
