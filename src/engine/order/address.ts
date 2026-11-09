import type { Address } from '../events/checkout';
import type { ApiOrderAddress } from '../types';

/** The public Address of an API address (`line4` is the city); none without a country. */
export function addressFromApi(raw?: ApiOrderAddress): Address | undefined {
  if (!raw?.country) return undefined;
  return {
    first_name: raw.first_name ?? '',
    last_name: raw.last_name ?? '',
    line1: raw.line1 ?? '',
    ...(raw.line2 && { line2: raw.line2 }),
    ...(raw.line4 && { city: raw.line4 }),
    ...(raw.state && { state: raw.state }),
    ...(raw.postcode && { postcode: raw.postcode }),
    country: raw.country,
    ...(raw.phone_number && { phone: raw.phone_number }),
  };
}
