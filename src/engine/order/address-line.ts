import type { Address } from '../events/checkout';
import type { ApiAddress, ApiOrderAddress } from '../types';

/** The API address of a form's fields read by `get` (`city` goes to `line4`); optional fields only when set. */
export function addressToApi(get: (name: string) => string | undefined, phone?: string): ApiAddress {
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

/** The parts of an address on one line, each part's fields joined by a space and the parts by `, `. */
export type AddressLayout<K extends string> = K[][];

/** `order.shippingAddress` and `order.billingAddress`: every field a part, on the API's names. */
export const ORDER_LAYOUT: AddressLayout<keyof ApiOrderAddress> = [
  ['line1'],
  ['line2'],
  ['line4'],
  ['state'],
  ['postcode'],
  ['country'],
];

/** An Address value in attributes v2: state and postcode one part. */
export const LINE_LAYOUT: AddressLayout<keyof Address> = [
  ['line1'],
  ['line2'],
  ['city'],
  ['state', 'postcode'],
  ['country'],
];

/** `data-next-checkout-review="address"`: city, state and postcode one part. */
export const REVIEW_LAYOUT: AddressLayout<keyof Address> = [
  ['line1'],
  ['line2'],
  ['city', 'state', 'postcode'],
  ['country'],
];

/** An address on one line by `layout`; empty fields and parts are left out. */
export function formatAddress<K extends string>(address: Partial<Record<K, string>>, layout: AddressLayout<K>): string {
  const part = (fields: K[]) =>
    fields
      .map((field) => address[field])
      .filter(Boolean)
      .join(' ');
  return layout.map(part).filter(Boolean).join(', ');
}
