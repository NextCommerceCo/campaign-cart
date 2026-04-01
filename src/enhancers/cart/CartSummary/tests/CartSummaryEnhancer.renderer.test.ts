import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  buildFlags,
  buildVars,
  buildDefaultTemplate,
  updateStateClasses,
} from '../CartSummaryEnhancer.renderer';
import type { SummaryFlags, TemplateVars } from '../CartSummaryEnhancer.types';
import type { CartState } from '@/types/global';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<CartState> = {}): CartState {
  return {
    items: [],
    enrichedItems: [],
    totalQuantity: 0,
    isEmpty: true,
    vouchers: [],
    subtotal: new Decimal(0),
    hasDiscounts: false,
    totalDiscount: new Decimal(0),
    totalDiscountPercentage: new Decimal(0),
    total: new Decimal(0),
    isCalculating: false,
    ...overrides,
  } as CartState;
}

function makeShippingMethod(price: number, hasDiscounts = false) {
  return {
    id: 1,
    name: 'Standard',
    code: 'standard',
    price: new Decimal(price),
    originalPrice: new Decimal(price + 5),
    discountAmount: hasDiscounts ? new Decimal(5) : new Decimal(0),
    discountPercentage: hasDiscounts ? new Decimal(50) : new Decimal(0),
    hasDiscounts,
  };
}

// ─── buildFlags ──────────────────────────────────────────────────────────────

describe('buildFlags', () => {
  it('isEmpty mirrors state.isEmpty', () => {
    expect(buildFlags(makeState({ isEmpty: true })).isEmpty).toBe(true);
    expect(buildFlags(makeState({ isEmpty: false })).isEmpty).toBe(false);
  });

  it('hasDiscounts mirrors state.hasDiscounts', () => {
    expect(buildFlags(makeState({ hasDiscounts: true })).hasDiscounts).toBe(true);
    expect(buildFlags(makeState({ hasDiscounts: false })).hasDiscounts).toBe(false);
  });

  it('isFreeShipping is true when shippingMethod is absent', () => {
    expect(buildFlags(makeState()).isFreeShipping).toBe(true);
  });

  it('isFreeShipping is true when shipping price is zero', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(0) });
    expect(buildFlags(state).isFreeShipping).toBe(true);
  });

  it('isFreeShipping is false when shipping price is non-zero', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(9.99) });
    expect(buildFlags(state).isFreeShipping).toBe(false);
  });

  it('hasShippingDiscount mirrors shippingMethod.hasDiscounts', () => {
    expect(buildFlags(makeState({ shippingMethod: makeShippingMethod(5, true) })).hasShippingDiscount).toBe(true);
    expect(buildFlags(makeState({ shippingMethod: makeShippingMethod(5, false) })).hasShippingDiscount).toBe(false);
  });

  it('hasShippingDiscount is false when no shipping method', () => {
    expect(buildFlags(makeState()).hasShippingDiscount).toBe(false);
  });

  it('isCalculating mirrors state.isCalculating', () => {
    expect(buildFlags(makeState({ isCalculating: true })).isCalculating).toBe(true);
    expect(buildFlags(makeState({ isCalculating: false })).isCalculating).toBe(false);
  });
});

// ─── buildVars ───────────────────────────────────────────────────────────────

describe('buildVars', () => {
  const flags: SummaryFlags = {
    isEmpty: false,
    hasDiscounts: true,
    isFreeShipping: false,
    hasShippingDiscount: false,
    isCalculating: false,
  };

  it('subtotal is formatted as currency', () => {
    const state = makeState({ subtotal: new Decimal(24.99) });
    const vars = buildVars(state, flags, 1);
    expect(vars.subtotal).toContain('24.99');
  });

  it('total is formatted as currency', () => {
    const state = makeState({ total: new Decimal(19.99) });
    const vars = buildVars(state, flags, 1);
    expect(vars.total).toContain('19.99');
  });

  it('discounts is formatted as currency from totalDiscount', () => {
    const state = makeState({ totalDiscount: new Decimal(5) });
    const vars = buildVars(state, flags, 1);
    expect(vars.discounts).toContain('5.00');
  });

  it('shipping shows "Free" when isFreeShipping', () => {
    const freeFlags = { ...flags, isFreeShipping: true };
    const vars = buildVars(makeState(), freeFlags, 0);
    expect(vars.shipping).toBe('Free');
  });

  it('shipping is formatted currency when not free', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(9.99) });
    const vars = buildVars(state, flags, 1);
    expect(vars.shipping).toContain('9.99');
  });

  it('itemCount is a stringified number', () => {
    const vars = buildVars(makeState(), flags, 3);
    expect(vars.itemCount).toBe('3');
  });

  it('shippingOriginal is empty string when no shipping discount', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(9.99, false) });
    const noDiscountFlags = { ...flags, hasShippingDiscount: false };
    const vars = buildVars(state, noDiscountFlags, 1);
    expect(vars.shippingOriginal).toBe('');
  });

  it('shippingOriginal is formatted currency when shipping discount is active', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(4.99, true) });
    const discountFlags = { ...flags, hasShippingDiscount: true };
    const vars = buildVars(state, discountFlags, 1);
    // originalPrice = price + 5 = 9.99
    expect(vars.shippingOriginal).toContain('9.99');
  });
});

// ─── buildDefaultTemplate ────────────────────────────────────────────────────

describe('buildDefaultTemplate', () => {
  const vars: TemplateVars = {
    subtotal: '$24.99',
    total: '$19.99',
    shipping: 'Free',
    shippingOriginal: '',
    discounts: '$5.00',
    itemCount: '1',
  };

  it('always contains a subtotal row', () => {
    const html = buildDefaultTemplate(vars, {
      isEmpty: false, hasDiscounts: false, isFreeShipping: true,
      hasShippingDiscount: false, isCalculating: false,
    });
    expect(html).toContain('next-row-subtotal');
    expect(html).toContain('$24.99');
  });

  it('omits discounts row when hasDiscounts is false', () => {
    const html = buildDefaultTemplate(vars, {
      isEmpty: false, hasDiscounts: false, isFreeShipping: true,
      hasShippingDiscount: false, isCalculating: false,
    });
    expect(html).not.toContain('next-row-discounts');
  });

  it('includes discounts row when hasDiscounts is true', () => {
    const html = buildDefaultTemplate(vars, {
      isEmpty: false, hasDiscounts: true, isFreeShipping: false,
      hasShippingDiscount: false, isCalculating: false,
    });
    expect(html).toContain('next-row-discounts');
    expect(html).toContain('-$5.00');
  });

  it('always contains a shipping row', () => {
    const html = buildDefaultTemplate(vars, {
      isEmpty: false, hasDiscounts: false, isFreeShipping: true,
      hasShippingDiscount: false, isCalculating: false,
    });
    expect(html).toContain('next-row-shipping');
  });

  it('always contains a total row', () => {
    const html = buildDefaultTemplate(vars, {
      isEmpty: false, hasDiscounts: false, isFreeShipping: true,
      hasShippingDiscount: false, isCalculating: false,
    });
    expect(html).toContain('next-row-total');
    expect(html).toContain('$19.99');
  });
});

// ─── updateStateClasses ──────────────────────────────────────────────────────

describe('updateStateClasses', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
  });

  it('adds next-cart-empty when isEmpty', () => {
    updateStateClasses(el, { isEmpty: true, hasDiscounts: false, isFreeShipping: true, hasShippingDiscount: false, isCalculating: false });
    expect(el.classList.contains('next-cart-empty')).toBe(true);
    expect(el.classList.contains('next-cart-has-items')).toBe(false);
  });

  it('adds next-cart-has-items when not isEmpty', () => {
    updateStateClasses(el, { isEmpty: false, hasDiscounts: false, isFreeShipping: true, hasShippingDiscount: false, isCalculating: false });
    expect(el.classList.contains('next-cart-has-items')).toBe(true);
    expect(el.classList.contains('next-cart-empty')).toBe(false);
  });

  it('adds next-has-discounts when hasDiscounts', () => {
    updateStateClasses(el, { isEmpty: false, hasDiscounts: true, isFreeShipping: false, hasShippingDiscount: false, isCalculating: false });
    expect(el.classList.contains('next-has-discounts')).toBe(true);
    expect(el.classList.contains('next-no-discounts')).toBe(false);
  });

  it('adds next-no-discounts when no discounts', () => {
    updateStateClasses(el, { isEmpty: false, hasDiscounts: false, isFreeShipping: false, hasShippingDiscount: false, isCalculating: false });
    expect(el.classList.contains('next-no-discounts')).toBe(true);
    expect(el.classList.contains('next-has-discounts')).toBe(false);
  });

  it('adds next-free-shipping when isFreeShipping', () => {
    updateStateClasses(el, { isEmpty: false, hasDiscounts: false, isFreeShipping: true, hasShippingDiscount: false, isCalculating: false });
    expect(el.classList.contains('next-free-shipping')).toBe(true);
    expect(el.classList.contains('next-has-shipping')).toBe(false);
  });

  it('adds next-has-shipping when not free', () => {
    updateStateClasses(el, { isEmpty: false, hasDiscounts: false, isFreeShipping: false, hasShippingDiscount: false, isCalculating: false });
    expect(el.classList.contains('next-has-shipping')).toBe(true);
    expect(el.classList.contains('next-free-shipping')).toBe(false);
  });

  it('adds next-has-shipping-discount when hasShippingDiscount', () => {
    updateStateClasses(el, { isEmpty: false, hasDiscounts: false, isFreeShipping: false, hasShippingDiscount: true, isCalculating: false });
    expect(el.classList.contains('next-has-shipping-discount')).toBe(true);
    expect(el.classList.contains('next-no-shipping-discount')).toBe(false);
  });

  it('toggles correctly on repeated calls', () => {
    updateStateClasses(el, { isEmpty: true, hasDiscounts: false, isFreeShipping: true, hasShippingDiscount: false, isCalculating: false });
    expect(el.classList.contains('next-cart-empty')).toBe(true);
    updateStateClasses(el, { isEmpty: false, hasDiscounts: false, isFreeShipping: true, hasShippingDiscount: false, isCalculating: false });
    expect(el.classList.contains('next-cart-empty')).toBe(false);
    expect(el.classList.contains('next-cart-has-items')).toBe(true);
  });
});
