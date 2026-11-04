import { describe, expect, it } from 'vitest';
import { publicOrder } from '../../src/engine/order';
import { ORDER, withUpsell } from '../fixtures/order';

describe('publicOrder', () => {
  it('gives the order the field names and number prices the cart uses', () => {
    expect(publicOrder(ORDER, ['SAVE10'])).toEqual({
      ref_id: 'R1',
      number: '1001',
      currency: 'USD',
      test: false,
      lines: [
        {
          id: '11',
          product_title: 'Earbuds',
          sku: 'EB-2',
          image: 'https://img.test/eb.png',
          quantity: 2,
          price: 48.06,
          original_price: 99,
          total: 96.12,
          upsell: false,
        },
      ],
      coupons: ['SAVE10'],
      total_discount: 0,
      shipping_method: { name: 'Express', price: 9.99 },
      tax: 7.12,
      total: 106.11,
      user: { email: 'jane@example.com', first_name: 'Jane', last_name: 'Doe' },
      shipping_address: {
        first_name: 'Jane',
        last_name: 'Doe',
        line1: '1 Main St',
        city: 'Austin',
        state: 'TX',
        postcode: '73301',
        country: 'US',
      },
      billing_address: {
        first_name: 'Ann',
        last_name: 'Lee',
        line1: '2 Side St',
        city: 'Reno',
        state: 'NV',
        country: 'US',
      },
      payment_method: 'card_token',
      supports_upsells: true,
    });
  });

  it('marks the lines an upsell added, and a test order', () => {
    const order = publicOrder({ ...withUpsell(ORDER, 99, 1), is_test: true, payment_method: { code: 'paypal' } });
    expect(order.lines.map((l) => l.upsell)).toEqual([false, true]);
    expect(order).toMatchObject({ test: true, payment_method: 'paypal', coupons: [] });
  });
});
