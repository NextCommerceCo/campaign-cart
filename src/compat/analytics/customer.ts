import type { Engine } from '../../engine/engine';
import { apiOrder } from '../../engine/tracking';
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

/** `user_properties` of every push but the purchases, as 0.4.x sent it: what the checkout form holds so far. */
export interface DataLayerShopper {
  visitor_type: 'guest';
  /** As typed. */
  customer_email?: string;
  /** The billing country: the shipping one unless the billing address is separate. ISO 3166-1 alpha-2. */
  customer_country?: string;
}

/** `user_properties` of `dl_user_data`: also the shopper's name and phone; the order's customer on an order page. */
export interface DataLayerVisitor extends DataLayerShopper {
  customer_first_name?: string;
  customer_last_name?: string;
  /** E.164. */
  customer_phone?: string;
}

const filled = (value: string | undefined) => value?.trim() || undefined;
const E164 = /^\+[1-9]\d{7,14}$/;

/** @deprecated The 0.4.x `user_properties` of a push before the purchase, from the checkout form. */
export const shopper = (engine: Engine): DataLayerShopper => {
  const checkout = engine.getState().checkout;
  const email = filled(checkout?.fields.email);
  const country = filled(
    (checkout?.sameAsShipping === false && checkout.fields.billing_country) || checkout?.fields.country,
  );
  return {
    visitor_type: 'guest',
    ...(email && { customer_email: email }),
    ...(country && { customer_country: country }),
  };
};

/** @deprecated The 0.4.x `user_properties` of `dl_user_data`: the order's customer on an order page, else the form's. */
export const visitor = (engine: Engine): DataLayerVisitor => {
  const { checkout, order } = engine.getState();
  const user = order?.refId ? apiOrder(engine, order.refId)?.user : undefined;
  const form = checkout?.fields ?? {};
  const email = filled(user ? user.email : form.email);
  const first = filled(user ? user.first_name : form.first_name);
  const last = filled(user ? user.last_name : form.last_name);
  const phone = user ? user.phone_number : checkout?.phones.phone_number?.value;
  return {
    ...shopper(engine),
    ...(email && { customer_email: email }),
    ...(first && { customer_first_name: first }),
    ...(last && { customer_last_name: last }),
    ...(phone && E164.test(phone) && { customer_phone: phone }),
  };
};
