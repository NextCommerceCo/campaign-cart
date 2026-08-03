import { describe, it, expect, beforeEach } from 'vitest';
import { useCheckoutStore } from './checkout.state';

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
