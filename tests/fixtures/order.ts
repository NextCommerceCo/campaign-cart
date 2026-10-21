import type { Order } from '../../src/engine/types';

export const ORDER: Order = {
  ref_id: 'R1',
  number: 1001,
  currency: 'USD',
  lines: [
    {
      id: 11,
      product_title: 'Earbuds',
      product_sku: 'EB-2',
      image: 'https://img.test/eb.png',
      quantity: 2,
      price_excl_tax: '89.00',
      price_incl_tax: '96.12',
      price_incl_tax_excl_discounts: '198.00',
      is_upsell: false,
    },
  ],
  total_excl_tax: '89.00',
  total_incl_tax: '106.11',
  total_tax: '7.12',
  total_discounts: '0.00',
  shipping_excl_tax: '9.99',
  shipping_incl_tax: '9.99',
  shipping_method: 'Express',
  user: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
  shipping_address: {
    first_name: 'Jane',
    last_name: 'Doe',
    line1: '1 Main St',
    line4: 'Austin',
    state: 'TX',
    postcode: '73301',
    country: 'US',
  },
  billing_address: {
    first_name: 'Ann',
    last_name: 'Lee',
    line1: '2 Side St',
    line4: 'Reno',
    state: 'NV',
    country: 'US',
  },
  payment_method: 'card_token',
  supports_post_purchase_upsells: true,
};

export const withUpsell = (order: Order, id: number, quantity: number): Order => ({
  ...order,
  lines: [
    ...(order.lines ?? []),
    { id, product_title: 'Bump', quantity, price_excl_tax: '20.00', price_incl_tax: '20.00', is_upsell: true },
  ],
});
