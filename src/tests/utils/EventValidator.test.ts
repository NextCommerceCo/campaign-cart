import { describe, it, expect } from 'vitest';
import { EventValidator } from '@/utils/analytics/validation/EventValidator';

// Runtime (debug-mode) validator. Complements EcommerceEventValidator (which
// powers the debug overlay) — this one feeds console diagnostics and must cover
// schema-less events, unresolved packages, reconciliation and purchase rules.

const validator = new EventValidator();

const item = (over: Record<string, unknown> = {}) => ({
  item_id: 'SKU-1',
  item_name: 'Drone Hawk',
  price: 10,
  quantity: 1,
  ...over,
});

describe('EventValidator', () => {
  it('passes a well-formed dl_add_to_cart', () => {
    const r = validator.validateEvent({
      event: 'dl_add_to_cart',
      ecommerce: {
        currency: 'USD',
        value: 20,
        items: [item({ price: 10, quantity: 2 })],
      },
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('flags an unresolved item_id / item_name', () => {
    const r = validator.validateEvent({
      event: 'dl_add_to_cart',
      ecommerce: {
        currency: 'USD',
        value: 10,
        items: [item({ item_id: 'undefined', item_name: 'Package undefined' })],
      },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('item_id'))).toBe(true);
    expect(r.errors.some(e => e.includes('item_name'))).toBe(true);
  });

  it('validates schema-less events (dl_upsell_purchase has no early-return gap)', () => {
    const r = validator.validateEvent({
      event: 'dl_upsell_purchase',
      ecommerce: {
        currency: 'USD',
        value: 42,
        items: [item({ price: 14, quantity: 3 })],
      },
      upsell_metadata: { package_id: '0', package_name: 'Package 0' },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('transaction_id'))).toBe(true);
    expect(r.errors.some(e => e.includes('upsell_metadata.package_id'))).toBe(
      true
    );
    expect(r.errors.some(e => e.includes('upsell_metadata.package_name'))).toBe(
      true
    );
  });

  it('requires transaction_id and value on purchase events', () => {
    const r = validator.validateEvent({
      event: 'dl_purchase',
      ecommerce: { currency: 'USD', items: [item()] },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('transaction_id'))).toBe(true);
    expect(r.errors.some(e => e.includes('value'))).toBe(true);
  });

  it('warns when price × quantity does not reconcile to value', () => {
    const r = validator.validateEvent({
      event: 'dl_add_to_cart',
      ecommerce: {
        currency: 'USD',
        value: 70,
        items: [item({ price: 70, quantity: 5 })],
      },
    });
    expect(r.warnings.some(w => w.includes('reconcile'))).toBe(true);
  });

  it('reconciles a compliant purchase: value = item revenue, tax/shipping separate', () => {
    const r = validator.validateEvent({
      event: 'dl_purchase',
      ecommerce: {
        currency: 'USD',
        transaction_id: 'ORD-1',
        value: 100, // GA4: item revenue only; tax + shipping are separate fields
        tax: 10,
        shipping: 5,
        items: [item({ price: 50, quantity: 2 })],
      },
    });
    expect(r.warnings.some(w => w.includes('reconcile'))).toBe(false);
    expect(r.valid).toBe(true);
  });

  it('rejects quantity below 1 and non-finite numbers', () => {
    const zero = validator.validateEvent({
      event: 'dl_add_to_cart',
      ecommerce: { currency: 'USD', value: 0, items: [item({ quantity: 0 })] },
    });
    expect(zero.valid).toBe(false);
    expect(zero.errors.some(e => e.includes('at least 1'))).toBe(true);

    const nan = validator.validateEvent({
      event: 'dl_add_to_cart',
      ecommerce: { currency: 'USD', value: 10, items: [item({ price: NaN })] },
    });
    expect(nan.valid).toBe(false);
    expect(nan.errors.some(e => e.includes('finite number'))).toBe(true);
  });

  it('warns on a missing currency and an item/event currency mismatch', () => {
    const missing = validator.validateEvent({
      event: 'dl_add_to_cart',
      ecommerce: { value: 10, items: [item()] },
    });
    expect(missing.warnings.some(w => w.includes('currency is missing'))).toBe(
      true
    );

    const mismatch = validator.validateEvent({
      event: 'dl_add_to_cart',
      ecommerce: {
        currency: 'USD',
        value: 10,
        items: [item({ currency: 'CAD' })],
      },
    });
    expect(
      mismatch.warnings.some(w => w.includes('differs from ecommerce.currency'))
    ).toBe(true);
  });

  it('still reports a missing event name as an error', () => {
    const r = validator.validateEvent({ ecommerce: {} });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('"event" field'))).toBe(true);
  });
});
