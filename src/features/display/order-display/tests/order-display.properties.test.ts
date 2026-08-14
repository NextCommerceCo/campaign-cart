/**
 * What `order.status` and `order.paymentMethod` render — pinned.
 *
 * These two routing entries used to carry `fallback: 'Completed'` and
 * `fallback: 'Credit Card'`. Evidence from the orders API settled both: it
 * returns `payment_method` (and the SDK now declares it on `Order`), and it
 * returns no order status at all. The fallbacks are gone, so neither path can
 * name a state or a payment method the order did not have.
 *
 * The assertions run the value through the same two steps a rendered element
 * does — the resolver, then `PROPERTY_MAPPINGS`' fallback — because the defect
 * lived in the second step and the resolver alone would not show it.
 */

import { describe, it, expect } from 'vitest';
import { getPropertyConfig } from '@/core/base/display-types';
import { createLogger } from '@/core/logger';
import type { Order } from '@/types/api';
import {
  beautifyPaymentMethod,
  getDisplayValue,
} from '../order-display.properties';

const logger = createLogger('OrderDisplayPropertiesTest');

const ORDER: Order = {
  ref_id: 'ref-1',
  number: 'NX-10428',
  currency: 'USD',
  lines: [],
  total_excl_tax: '59.98',
  total_incl_tax: '59.98',
  total_tax: '0.00',
  total_discounts: '0.00',
  shipping_excl_tax: '0.00',
  shipping_incl_tax: '0.00',
  shipping_tax: '0.00',
  shipping_method: 'Standard',
  shipping_code: 'standard',
  discounts: [],
  user: { first_name: 'Ada', last_name: 'Lovelace', language: 'en' },
  payment_method: 'paypal',
  order_status_url: 'https://example.test/order/ref-1',
  supports_post_purchase_upsells: true,
  is_test: false,
};

/**
 * The value an element bound to `path` ends up with: what the resolver answers,
 * then the routing entry's fallback if that answer was null/undefined.
 * Mirrors `BaseDisplayEnhancer.getPropertyValueWithValidation`.
 */
function rendered(path: string, order: Partial<Order> | null): unknown {
  const raw: unknown = getDisplayValue({ order }, path, logger);
  const property = path.replace(/^order\./, '');
  const config = getPropertyConfig('order' as never, property) as
    | { fallback?: unknown }
    | undefined;
  return raw ?? config?.fallback;
}

describe('order.status', () => {
  it('renders empty — the orders API sends no order status', () => {
    expect(rendered('order.status', ORDER)).toBe('');
  });

  it('routes with no fallback, so nothing can invent a state', () => {
    const config = getPropertyConfig('order' as never, 'status') as {
      fallback?: unknown;
    };
    expect(config.fallback).toBeUndefined();
  });
});

describe('order.paymentMethod', () => {
  it('renders the method the order was actually paid with', () => {
    expect(rendered('order.paymentMethod', ORDER)).toBe('PayPal');
    expect(rendered('order.payment_method', ORDER)).toBe('PayPal');
  });

  it('renders empty rather than "Credit Card" when the API sent none', () => {
    const noMethod = { ...ORDER, payment_method: null };
    expect(rendered('order.paymentMethod', noMethod)).toBe('');
    expect(rendered('order.payment_method', noMethod)).toBe('');
  });

  it('routes with no fallback, so a PayPal order cannot read as a card order', () => {
    const config = getPropertyConfig('order' as never, 'paymentMethod') as {
      fallback?: unknown;
    };
    expect(config.fallback).toBeUndefined();
  });

  it('renders empty before an order has loaded', () => {
    expect(rendered('order.paymentMethod', null)).toBe('');
    expect(rendered('order.status', null)).toBe('');
  });
});

describe('beautifyPaymentMethod', () => {
  it.each([
    ['card_token', 'Credit Card'],
    ['saved_card', 'Saved Card'],
    ['apple_pay', 'Apple Pay'],
    ['google_pay', 'Google Pay'],
    ['paypal', 'PayPal'],
    ['affirm', 'Affirm'],
    ['bancontact', 'Bancontact'],
    ['external', 'External'],
    ['giropay', 'Giropay'],
    ['ideal', 'iDEAL'],
    ['klarna', 'Klarna'],
    ['link', 'Link'],
    ['sepa_debit', 'SEPA Direct Debit'],
    ['sofort', 'Sofort'],
    ['swish', 'Swish'],
    ['twint', 'Twint'],
  ])('labels %s as "%s", the platform’s own name for it', (code, label) => {
    expect(beautifyPaymentMethod(code)).toBe(label);
  });

  it('reads the same code however the order spelled it', () => {
    expect(beautifyPaymentMethod('Apple Pay')).toBe('Apple Pay');
    expect(beautifyPaymentMethod('apple-pay')).toBe('Apple Pay');
    expect(beautifyPaymentMethod(' PAYPAL ')).toBe('PayPal');
  });

  it('shows a method it has no label for exactly as the API spelled it', () => {
    // Never substituted for a friendlier but wrong name, and not title-cased
    // either: a raw code on a receipt gets reported, an invented label does not.
    expect(beautifyPaymentMethod('pix')).toBe('pix');
    expect(beautifyPaymentMethod('')).toBe('');
  });
});
