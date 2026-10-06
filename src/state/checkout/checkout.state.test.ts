import { describe, it, expect, beforeEach } from 'vitest';
import { useCheckoutStore } from './checkout.state';

/**
 * Regression coverage: `reset()` calls `set(initialState)`, and Zustand's `set`
 * **merges**. `initialState` used to declare no `billingAddress`,
 * `paymentToken` or `shippingMethod`, so those three were left behind — two of
 * them persisted to sessionStorage. On a shared or kiosk browser that carried
 * one shopper's billing address and card token into the next shopper's
 * checkout.
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
 * Regression coverage: `removeVoucher` used to filter on raw string equality
 * (`v !== code`) while `addVoucher` is fed an already-normalised
 * (`toUpperCase().trim()`) code by `applyCoupon`. Any casing/whitespace
 * mismatch between what a caller passes to `removeVoucher` and what is stored
 * meant the voucher was never removed, silently.
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
 * A code applied on an empty cart cannot be priced, so it is marked unchecked
 * until the cart has items. The mark has to go wherever the code goes, and it
 * has to survive a page load: the presell page that took the code is usually
 * not the checkout page that first prices it.
 */
describe('checkout store — unchecked vouchers', () => {
  beforeEach(() => {
    useCheckoutStore.getState().reset();
  });

  it('marks a code added unchecked, and only that code', () => {
    useCheckoutStore.getState().addVoucher('SAVE10');
    useCheckoutStore.getState().addVoucher('PRIMAL_5', { unchecked: true });

    expect(useCheckoutStore.getState().uncheckedVouchers).toEqual(['PRIMAL_5']);
  });

  it('clears the mark, whatever the casing, and keeps the code', () => {
    useCheckoutStore.getState().addVoucher('PRIMAL_5', { unchecked: true });

    useCheckoutStore.getState().markVoucherChecked(' primal_5 ');

    expect(useCheckoutStore.getState().uncheckedVouchers).toEqual([]);
    expect(useCheckoutStore.getState().vouchers).toEqual(['PRIMAL_5']);
  });

  it('drops the mark with the code', () => {
    useCheckoutStore.getState().addVoucher('PRIMAL_5', { unchecked: true });

    useCheckoutStore.getState().removeVoucher('primal_5');

    expect(useCheckoutStore.getState().uncheckedVouchers).toEqual([]);
  });

  it('persists the mark', () => {
    useCheckoutStore.getState().addVoucher('PRIMAL_5', { unchecked: true });

    const persisted = useCheckoutStore.persist
      .getOptions()
      .partialize?.(useCheckoutStore.getState()) as {
      uncheckedVouchers?: string[];
    };

    expect(persisted.uncheckedVouchers).toEqual(['PRIMAL_5']);
  });
});
