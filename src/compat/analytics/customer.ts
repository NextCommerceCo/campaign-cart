import type { ApiOrder } from '../../engine/types';

/**
 * `user_properties` of `dl_purchase` and `dl_upsell_purchase`, as 0.4.x sent it: the order's customer,
 * with the name, phone and address of its billing address.
 */
export interface DataLayerCustomer {
  /** `logged_in` when the order has a customer. */
  visitor_type: 'guest' | 'logged_in';
  customer_email?: string;
  /** The billing address's, else the customer's. */
  customer_first_name?: string;
  customer_last_name?: string;
  /** E.164. */
  customer_phone?: string;
  /** The billing address; empty strings for the parts it lacks, none of these without one. */
  customer_address_1?: string;
  customer_address_2?: string;
  customer_city?: string;
  /** State, province or region code. */
  customer_province?: string;
  customer_province_code?: string;
  customer_zip?: string;
  /** ISO 3166-1 alpha-2. */
  customer_country?: string;
}

/** @deprecated The 0.4.x `user_properties` of a purchase push, from the order as the API returned it. */
export const customer = ({ user, billing_address: b }: ApiOrder): DataLayerCustomer => {
  const first = b?.first_name || user?.first_name;
  const last = b?.last_name || user?.last_name;
  const phone = b?.phone_number || user?.phone_number;
  return {
    visitor_type: user ? 'logged_in' : 'guest',
    ...(user?.email && { customer_email: user.email }),
    ...(first && { customer_first_name: first }),
    ...(last && { customer_last_name: last }),
    ...(phone && { customer_phone: phone }),
    ...(b && {
      customer_address_1: b.line1 || '',
      customer_address_2: b.line2 || '',
      customer_city: b.line4 || '',
      customer_province: b.state || '',
      customer_province_code: b.state || '',
      customer_zip: b.postcode || '',
      customer_country: b.country || '',
    }),
  };
};
