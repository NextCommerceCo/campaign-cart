import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCheckoutStore } from './checkout.state';

/**
 * Regression coverage for code-findings.md #156: `reset()` calls `set(initialState)`, and
 * Zustand's `set` **merges**. `initialState` used to declare no `billingAddress`,
 * `paymentToken` or `shippingMethod`, so those three were left behind — two of them
 * persisted to sessionStorage. On a shared or kiosk browser that put one shopper's billing
 * address and card token into the next shopper's checkout.
 */
describe('checkout store — reset clears every field', () => {
  beforeEach(() => {
    useCheckoutStore.setState(
      {
        billingAddress: undefined,
        paymentToken: undefined,
        shippingMethod: undefined,
      },
      false
    );
    useCheckoutStore.getState().reset();
  });

  it('clears the separate billing address', () => {
    useCheckoutStore.getState().setBillingAddress({
      first_name: 'Ada',
      last_name: 'Lovelace',
      address1: '12 Dean Street',
      city: 'London',
      province: 'London',
      postal: 'W1D 3RN',
      country: 'GB',
      phone: '+447700900123',
    });

    useCheckoutStore.getState().reset();

    expect(useCheckoutStore.getState().billingAddress).toBeUndefined();
  });

  it('clears the card token', () => {
    useCheckoutStore.getState().setPaymentToken('tok_abc123');

    useCheckoutStore.getState().reset();

    expect(useCheckoutStore.getState().paymentToken).toBeUndefined();
  });

  it('clears the chosen shipping method', () => {
    useCheckoutStore.getState().setShippingMethod({
      id: 2,
      name: 'Express (2 days)',
      price: 9.99,
      code: 'express',
    });

    useCheckoutStore.getState().reset();

    expect(useCheckoutStore.getState().shippingMethod).toBeUndefined();
  });

  it('leaves the store actions callable', () => {
    useCheckoutStore.getState().reset();

    expect(typeof useCheckoutStore.getState().reset).toBe('function');
    expect(typeof useCheckoutStore.getState().setBillingAddress).toBe(
      'function'
    );
  });
});

/**
 * Regression coverage for code-findings.md #4: `removeVoucher` used to filter
 * on raw string equality (`v !== code`) while `addVoucher` is fed an
 * already-normalised (`toUpperCase().trim()`) code by `applyCoupon`. Any
 * casing/whitespace mismatch between what a caller passes to `removeVoucher`
 * and what is stored meant the voucher was never removed, silently.
 */
describe('checkout store — removeVoucher normalisation', () => {
  beforeEach(() => {
    useCheckoutStore.getState().reset();
  });

  it('removes a stored code when passed lower-case', () => {
    useCheckoutStore.getState().addVoucher('SAVE10');

    useCheckoutStore.getState().removeVoucher('save10');

    expect(useCheckoutStore.getState().vouchers).toEqual([]);
  });

  it('removes a stored code when passed with surrounding whitespace and mixed case', () => {
    useCheckoutStore.getState().addVoucher('SAVE10');

    useCheckoutStore.getState().removeVoucher(' Save10 ');

    expect(useCheckoutStore.getState().vouchers).toEqual([]);
  });

  it('still removes an exact match', () => {
    useCheckoutStore.getState().addVoucher('SAVE10');

    useCheckoutStore.getState().removeVoucher('SAVE10');

    expect(useCheckoutStore.getState().vouchers).toEqual([]);
  });

  it('leaves other codes untouched', () => {
    useCheckoutStore.getState().addVoucher('SAVE10');
    useCheckoutStore.getState().addVoucher('WELCOME5');

    useCheckoutStore.getState().removeVoucher('save10');

    expect(useCheckoutStore.getState().vouchers).toEqual(['WELCOME5']);
  });
});

/**
 * A checkout saved before `credit-card` was retired.
 *
 * sessionStorage outlives an SDK upgrade, so a shopper part-way through a card
 * checkout rehydrates whatever the previous release wrote. `credit-card` was that
 * release's word for a card; nothing answers to it now, so without the migration
 * the form stops treating them as a card payer — no card fields are validated, no
 * token is collected, and the order the API is sent names a method it refuses.
 */
describe('checkout store — a checkout saved by an older SDK', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  /** Rehydrates the store from `stored` and hands back the fresh instance. */
  async function bootWith(stored: unknown) {
    const { CHECKOUT_STORAGE_KEY } = await import('@/core/storage');
    sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(stored));
    const { useCheckoutStore: store } = await import('./checkout.state');
    return store;
  }

  it('reads a v0 card checkout as a card checkout', async () => {
    const store = await bootWith({
      state: { paymentMethod: 'credit-card', formData: { email: 'a@b.test' } },
      version: 0,
    });

    expect(store.getState().paymentMethod).toBe('card_token');
    // The rest of the saved checkout is untouched — this is one field's rename,
    // not a reason to make the shopper type their details again.
    expect(store.getState().formData).toEqual({ email: 'a@b.test' });
  });

  it('leaves every other method alone', async () => {
    const store = await bootWith({
      state: { paymentMethod: 'ideal' },
      version: 0,
    });

    expect(store.getState().paymentMethod).toBe('ideal');
  });
});
