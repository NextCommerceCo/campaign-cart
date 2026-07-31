/**
 * Shared campaign fixtures for E2E specs.
 *
 * These mirror the shape the SDK expects from `GET /api/v1/campaigns/`
 * (see `src/types/campaign.ts`). Specs stub the network with these via
 * `stubCampaign` in `./routes` so every spec boots from consistent data
 * instead of copy-pasting inline JSON.
 */

import type { Campaign } from '../../src/types/campaign';

/**
 * Minimal campaign — one purchasable, non-recurring package (ref_id 1).
 * Use for specs that only need a single add-to-cart target.
 */
export const MINIMAL_CAMPAIGN: Campaign = {
  name: 'E2E Campaign',
  currency: 'USD',
  language: 'en',
  payment_env_key: '',
  packages: [
    {
      ref_id: 1,
      external_id: 1,
      name: 'Widget',
      price: '29.99',
      price_total: '29.99',
      qty: 1,
      image: '',
      is_recurring: false,
    },
  ],
  shipping_methods: [],
  available_currencies: [{ code: 'USD', label: 'USD' }],
};

/**
 * Rich multi-package campaign for selector/display/checkout specs.
 *
 * - ref_id 1 — simple single-unit package.
 * - ref_id 2 — multi-unit package (qty 3) with a retail/compare-at price.
 * - ref_id 3 — recurring (monthly) subscription package.
 * - ref_id 4 / 5 — two variants of the same product (Red / Blue) for
 *   variant-selection specs.
 *
 * Includes two shipping methods (paid + free), two currencies, and two
 * shipping countries so display/selector/checkout specs have data to bind to.
 */
export const RICH_CAMPAIGN: Campaign = {
  name: 'E2E Rich Campaign',
  currency: 'USD',
  language: 'en',
  payment_env_key: '',
  packages: [
    {
      ref_id: 1,
      external_id: 101,
      name: 'Single Widget',
      price: '29.99',
      price_total: '29.99',
      price_retail: '39.99',
      price_retail_total: '39.99',
      qty: 1,
      image: 'https://example.test/widget.png',
      is_recurring: false,
    },
    {
      ref_id: 2,
      external_id: 102,
      name: 'Triple Widget Pack',
      price: '24.99',
      price_total: '74.97',
      price_retail: '39.99',
      price_retail_total: '119.97',
      qty: 3,
      image: 'https://example.test/widget3.png',
      is_recurring: false,
    },
    {
      ref_id: 3,
      external_id: 103,
      name: 'Widget Subscription',
      price: '19.99',
      price_total: '19.99',
      price_recurring: '19.99',
      price_recurring_total: '19.99',
      qty: 1,
      image: 'https://example.test/widget-sub.png',
      is_recurring: true,
      interval: 'month',
      interval_count: 1,
    },
    {
      ref_id: 4,
      external_id: 104,
      name: 'Widget — Red',
      price: '29.99',
      price_total: '29.99',
      qty: 1,
      image: 'https://example.test/widget-red.png',
      is_recurring: false,
      product_id: 900,
      product_name: 'Widget',
      product_variant_id: 9001,
      product_variant_name: 'Red',
      product_variant_attribute_values: [
        { code: 'color', name: 'Color', value: 'Red' },
      ],
    },
    {
      ref_id: 5,
      external_id: 105,
      name: 'Widget — Blue',
      price: '29.99',
      price_total: '29.99',
      qty: 1,
      image: 'https://example.test/widget-blue.png',
      is_recurring: false,
      product_id: 900,
      product_name: 'Widget',
      product_variant_id: 9002,
      product_variant_name: 'Blue',
      product_variant_attribute_values: [
        { code: 'color', name: 'Color', value: 'Blue' },
      ],
    },
  ],
  shipping_methods: [
    { ref_id: 1, code: 'standard', price: '5.99' },
    { ref_id: 2, code: 'free', price: '0.00' },
  ],
  available_currencies: [
    { code: 'USD', label: 'USD' },
    { code: 'EUR', label: 'EUR' },
  ],
  available_shipping_countries: [
    { code: 'US', label: 'United States' },
    { code: 'CA', label: 'Canada' },
  ],
};
