/**
 * Shared order fixture for checkout + order + upsell E2E specs.
 *
 * Mirrors the shape the SDK expects from `POST /api/v1/orders/` and
 * `GET /api/v1/orders/{ref_id}/` (see `src/types/api.ts` `Order`). Specs stub
 * the network with this via `stubOrder` in `./routes`.
 */

import type { Order } from '../../src/types/api';

/**
 * A completed test order with one line and post-purchase upsells enabled, so
 * order-display, order-item-list, and upsell specs have data to render.
 */
export const TEST_ORDER: Order = {
  ref_id: 'test-order-ref',
  number: 'E2E-1001',
  currency: 'USD',
  lines: [
    {
      id: 1,
      image: 'https://example.test/widget.png',
      is_upsell: false,
      price_excl_tax: '29.99',
      price_excl_tax_excl_discounts: '29.99',
      price_incl_tax: '29.99',
      price_incl_tax_excl_discounts: '29.99',
      product_sku: 'WIDGET-1',
      product_title: 'Single Widget',
      quantity: 1,
    },
  ],
  total_excl_tax: '29.99',
  total_incl_tax: '29.99',
  total_tax: '0.00',
  total_discounts: '0.00',
  shipping_excl_tax: '0.00',
  shipping_incl_tax: '0.00',
  shipping_tax: '0.00',
  shipping_method: 'Free Shipping',
  shipping_code: 'free',
  discounts: [],
  user: {
    email: 'e2e@example.test',
    first_name: 'Ada',
    last_name: 'Lovelace',
    language: 'en',
  },
  shipping_address: {
    country: 'US',
    first_name: 'Ada',
    last_name: 'Lovelace',
    line1: '1 Test St',
    line4: 'Testville',
    postcode: '10001',
    state: 'NY',
  },
  order_status_url: 'https://example.test/order/test-order-ref',
  supports_post_purchase_upsells: true,
  is_test: true,
};

/**
 * The same order after a post-purchase upsell was accepted — `TEST_ORDER` plus
 * one `is_upsell` line. `POST /api/v1/orders/{ref}/upsells/` answers with the
 * whole updated order, and the SDK reads the *new* `is_upsell` line to work out
 * what the upsell was worth, so a stub that echoes the unchanged order reports a
 * value of 0.
 *
 * The added line is priced identically incl and excl tax on purpose, so a value
 * assertion does not depend on which tax basis the store resolves to; the
 * `_excl_discounts` prices are 10.00 higher, which is the `discount` the
 * `upsell:accepted` payload should carry.
 */
export const TEST_ORDER_WITH_UPSELL: Order = {
  ...TEST_ORDER,
  lines: [
    ...TEST_ORDER.lines,
    {
      id: 2,
      image: 'https://example.test/triple-pack.png',
      is_upsell: true,
      price_excl_tax: '49.98',
      price_excl_tax_excl_discounts: '59.98',
      price_incl_tax: '49.98',
      price_incl_tax_excl_discounts: '59.98',
      product_sku: 'WIDGET-3',
      product_title: 'Triple Pack',
      quantity: 2,
    },
  ],
  total_excl_tax: '79.97',
  total_incl_tax: '79.97',
  total_discounts: '10.00',
};
