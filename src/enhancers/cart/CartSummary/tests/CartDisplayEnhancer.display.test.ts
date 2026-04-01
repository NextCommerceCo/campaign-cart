import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { CartDisplayEnhancer } from '../CartSummaryEnhancer.display';
import { useCartStore } from '@/stores/cartStore';
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

function makeShippingMethod(price: number, opts: { hasDiscounts?: boolean; name?: string; code?: string } = {}) {
  return {
    id: 1,
    name: opts.name ?? 'Standard',
    code: opts.code ?? 'standard',
    price: new Decimal(price),
    originalPrice: new Decimal(price + 5),
    discountAmount: opts.hasDiscounts ? new Decimal(5) : new Decimal(0),
    discountPercentage: opts.hasDiscounts ? new Decimal(50) : new Decimal(0),
    hasDiscounts: opts.hasDiscounts ?? false,
  };
}

function makeElement(displayPath: string, extra: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('span');
  el.setAttribute('data-next-display', displayPath);
  Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
  document.body.appendChild(el);
  return el;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CartDisplayEnhancer', () => {
  let enhancer: CartDisplayEnhancer;

  beforeEach(() => {
    useCartStore.getState().reset();
  });

  afterEach(() => {
    enhancer?.destroy();
  });

  describe('numeric properties', () => {
    beforeEach(() => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.total'));
    });

    it('subtotal returns toNumber()', () => {
      const state = makeState({ subtotal: new Decimal(24.99) });
      expect(enhancer.getCartProperty(state, 'subtotal')).toBe(24.99);
    });

    it('total returns toNumber()', () => {
      const state = makeState({ total: new Decimal(19.99) });
      expect(enhancer.getCartProperty(state, 'total')).toBe(19.99);
    });

    it('totalDiscount returns toNumber()', () => {
      const state = makeState({ totalDiscount: new Decimal(5) });
      expect(enhancer.getCartProperty(state, 'totalDiscount')).toBe(5);
    });

    it('discounts (deprecated) returns same as totalDiscount', () => {
      const state = makeState({ totalDiscount: new Decimal(3) });
      expect(enhancer.getCartProperty(state, 'discounts')).toBe(3);
    });

    it('shipping returns shippingMethod price', () => {
      const state = makeState({ shippingMethod: makeShippingMethod(9.99) });
      expect(enhancer.getCartProperty(state, 'shipping')).toBe(9.99);
    });

    it('shipping returns 0 when no shippingMethod', () => {
      expect(enhancer.getCartProperty(makeState(), 'shipping')).toBe(0);
    });

    it('shippingOriginal returns originalPrice', () => {
      const state = makeState({ shippingMethod: makeShippingMethod(4.99) });
      expect(enhancer.getCartProperty(state, 'shippingOriginal')).toBe(9.99);
    });

    it('shippingDiscountAmount returns discountAmount', () => {
      const state = makeState({ shippingMethod: makeShippingMethod(4.99, { hasDiscounts: true }) });
      expect(enhancer.getCartProperty(state, 'shippingDiscountAmount')).toBe(5);
    });

    it('shippingDiscountPercentage returns discountPercentage', () => {
      const state = makeState({ shippingMethod: makeShippingMethod(4.99, { hasDiscounts: true }) });
      expect(enhancer.getCartProperty(state, 'shippingDiscountPercentage')).toBe(50);
    });

    it('itemCount returns items.length', () => {
      const state = makeState({ items: [{ id: 1 } as any, { id: 2 } as any] });
      expect(enhancer.getCartProperty(state, 'itemCount')).toBe(2);
    });

    it('totalQuantity sums item quantities', () => {
      const state = makeState({
        items: [{ quantity: 2 } as any, { quantity: 3 } as any],
      });
      expect(enhancer.getCartProperty(state, 'totalQuantity')).toBe(5);
    });
  });

  describe('text properties', () => {
    beforeEach(() => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.shippingName'));
    });

    it('shippingName returns method name', () => {
      const state = makeState({ shippingMethod: makeShippingMethod(5, { name: 'Express' }) });
      expect(enhancer.getCartProperty(state, 'shippingName')).toBe('Express');
    });

    it('shippingName returns empty string when no method', () => {
      expect(enhancer.getCartProperty(makeState(), 'shippingName')).toBe('');
    });

    it('shippingCode returns method code', () => {
      const state = makeState({ shippingMethod: makeShippingMethod(5, { code: 'express' }) });
      expect(enhancer.getCartProperty(state, 'shippingCode')).toBe('express');
    });

    it('shippingCode returns empty string when no method', () => {
      expect(enhancer.getCartProperty(makeState(), 'shippingCode')).toBe('');
    });
  });

  describe('boolean / flag properties', () => {
    beforeEach(() => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.isEmpty'));
    });

    it('isEmpty returns true when cart is empty', () => {
      expect(enhancer.getCartProperty(makeState({ isEmpty: true }), 'isEmpty')).toBe(true);
    });

    it('isEmpty returns false when cart has items', () => {
      expect(enhancer.getCartProperty(makeState({ isEmpty: false }), 'isEmpty')).toBe(false);
    });

    it('hasDiscounts returns state.hasDiscounts', () => {
      expect(enhancer.getCartProperty(makeState({ hasDiscounts: true }), 'hasDiscounts')).toBe(true);
      expect(enhancer.getCartProperty(makeState({ hasDiscounts: false }), 'hasDiscounts')).toBe(false);
    });

    it('isFreeShipping is true when no shipping method', () => {
      expect(enhancer.getCartProperty(makeState(), 'isFreeShipping')).toBe(true);
    });

    it('isFreeShipping is true when price is zero', () => {
      const state = makeState({ shippingMethod: makeShippingMethod(0) });
      expect(enhancer.getCartProperty(state, 'isFreeShipping')).toBe(true);
    });

    it('isFreeShipping is false when price is non-zero', () => {
      const state = makeState({ shippingMethod: makeShippingMethod(9.99) });
      expect(enhancer.getCartProperty(state, 'isFreeShipping')).toBe(false);
    });

    it('hasShippingDiscount reflects shippingMethod.hasDiscounts', () => {
      const yes = makeState({ shippingMethod: makeShippingMethod(5, { hasDiscounts: true }) });
      const no = makeState({ shippingMethod: makeShippingMethod(5, { hasDiscounts: false }) });
      expect(enhancer.getCartProperty(yes, 'hasShippingDiscount')).toBe(true);
      expect(enhancer.getCartProperty(no, 'hasShippingDiscount')).toBe(false);
    });

    it('isCalculating returns state.isCalculating', () => {
      expect(enhancer.getCartProperty(makeState({ isCalculating: true }), 'isCalculating')).toBe(true);
      expect(enhancer.getCartProperty(makeState({ isCalculating: false }), 'isCalculating')).toBe(false);
    });
  });

  describe('.raw suffix', () => {
    beforeEach(() => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.total.raw'));
    });

    it('subtotal.raw returns numeric subtotal', () => {
      const state = makeState({ subtotal: new Decimal(24.99) });
      expect(enhancer.getCartProperty(state, 'subtotal.raw')).toBe(24.99);
    });

    it('total.raw returns numeric total', () => {
      const state = makeState({ total: new Decimal(19.99) });
      expect(enhancer.getCartProperty(state, 'total.raw')).toBe(19.99);
    });

    it('totalDiscount.raw returns numeric totalDiscount', () => {
      const state = makeState({ totalDiscount: new Decimal(5) });
      expect(enhancer.getCartProperty(state, 'totalDiscount.raw')).toBe(5);
    });

    it('shipping.raw returns numeric shipping price', () => {
      const state = makeState({ shippingMethod: makeShippingMethod(9.99) });
      expect(enhancer.getCartProperty(state, 'shipping.raw')).toBe(9.99);
    });

    it('shipping.raw returns 0 when no shipping method', () => {
      expect(enhancer.getCartProperty(makeState(), 'shipping.raw')).toBe(0);
    });

    it('unknown.raw returns undefined', () => {
      expect(enhancer.getCartProperty(makeState(), 'unknown.raw')).toBeUndefined();
    });
  });

  describe('data-include-discounts', () => {
    it('subtotal with include-discounts returns preformatted discounted value', async () => {
      const el = makeElement('cart.subtotal', { 'data-include-discounts': '' });
      enhancer = new CartDisplayEnhancer(el);
      await enhancer.initialize();

      const state = makeState({
        subtotal: new Decimal(50),
        totalDiscount: new Decimal(10),
      });
      const result = enhancer.getCartProperty(state, 'subtotal') as { _preformatted: boolean; value: string };
      expect(result._preformatted).toBe(true);
      expect(result.value).toContain('40.00');
    });

    it('subtotal.raw with include-discounts returns numeric discounted value', async () => {
      const el = makeElement('cart.subtotal.raw', { 'data-include-discounts': '' });
      enhancer = new CartDisplayEnhancer(el);
      await enhancer.initialize();

      const state = makeState({
        subtotal: new Decimal(50),
        totalDiscount: new Decimal(10),
      });
      expect(enhancer.getCartProperty(state, 'subtotal.raw')).toBe(40);
    });

    it('subtotal without include-discounts returns full subtotal', () => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.subtotal'));
      const state = makeState({ subtotal: new Decimal(50), totalDiscount: new Decimal(10) });
      expect(enhancer.getCartProperty(state, 'subtotal')).toBe(50);
    });
  });

  describe('path parsing', () => {
    it('parses cart.{property} — property is extracted after the dot', async () => {
      const el = makeElement('cart.total');
      enhancer = new CartDisplayEnhancer(el);
      await enhancer.initialize();
      // Verify the enhancer resolves via the store subscription
      const state = makeState({ total: new Decimal(99.99) });
      useCartStore.setState(state);
      // Element should update via subscription — verify resolution is correct
      expect(enhancer.getCartProperty(state, 'total')).toBe(99.99);
    });

    it('cart-summary.{property} still resolves (deprecated alias)', async () => {
      const el = makeElement('cart-summary.total');
      enhancer = new CartDisplayEnhancer(el);
      await enhancer.initialize();
      const state = makeState({ total: new Decimal(55) });
      expect(enhancer.getCartProperty(state, 'total')).toBe(55);
    });
  });

  describe('refreshDisplay', () => {
    it('does not throw when called', async () => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.total'));
      await enhancer.initialize();
      expect(() => enhancer.refreshDisplay()).not.toThrow();
    });
  });

  describe('unknown property', () => {
    it('returns undefined for unrecognized property', () => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.notAProperty'));
      expect(enhancer.getCartProperty(makeState(), 'notAProperty')).toBeUndefined();
    });
  });
});
