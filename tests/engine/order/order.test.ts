import { describe, expect, it } from 'vitest';
import { publicOrder, untaxed } from '../../../src/engine/order/order';
import { ORDER, withUpsell } from '../../fixtures/order';

describe('publicOrder', () => {
  it('gives the order the field names and number prices the cart uses', () => {
    expect(publicOrder(ORDER, ['SAVE10'])).toEqual({
      ref_id: 'R1',
      number: '1001',
      paid: true,
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
          tax: 7.12,
          upsell: false,
        },
      ],
      coupons: ['SAVE10'],
      total_discount: 0,
      shipping_method: { name: 'Express', price: 9.99, tax: 0 },
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

  it('leaves out a product or variant the API sends as null', () => {
    const line = { ...ORDER.lines![0]!, product_id: null, variant_id: null, package: null };
    const [item] = publicOrder({ ...ORDER, lines: [line] }).lines;
    expect(item).not.toHaveProperty('product_id');
    expect(item).not.toHaveProperty('variant_id');
    const [known] = publicOrder({ ...ORDER, lines: [{ ...line, product_id: 400, variant_id: 0 }] }).lines;
    expect(known).toMatchObject({ product_id: 400, variant_id: 0 });
  });

  it('marks the lines an upsell added, and a test order', () => {
    const order = publicOrder({ ...withUpsell(ORDER, 99, 1), is_test: true, payment_method: { code: 'paypal' } });
    expect(order.lines.map((l) => l.upsell)).toEqual([false, true]);
    expect(order).toMatchObject({ test: true, payment_method: 'paypal', coupons: [] });
  });

  it('gives each line and the shipping the tax inside its price', () => {
    const order = publicOrder({ ...ORDER, shipping_excl_tax: '8.33', shipping_incl_tax: '9.99' });
    expect(order.lines[0]).toMatchObject({ total: 96.12, tax: 7.12 });
    expect(order.shipping_method).toEqual({ name: 'Express', price: 9.99, tax: 1.66 });
  });
});

describe('untaxed', () => {
  it('takes the tax out of a line’s unit prices', () => {
    const [line] = publicOrder({ ...ORDER, lines: [{ ...ORDER.lines![0]!, price_excl_tax: '80.10' }] }).lines;
    expect(untaxed(line!)).toMatchObject({ price: 40.05, original_price: 82.5, total: 96.12, tax: 16.02 });
  });

  it('leaves a line without tax as it is', () => {
    const line = { price: 10, original_price: 12, total: 20 };
    expect(untaxed(line)).toBe(line);
  });
});
