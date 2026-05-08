import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

function makeShippingMethod(
  price: number,
  opts: { hasDiscounts?: boolean; name?: string; code?: string } = {},
) {
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

function makeElement(displayPath: string): HTMLElement {
  const el = document.createElement('span');
  el.setAttribute('data-next-display', displayPath);
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

  // ─── Numeric (currency) properties ─────────────────────────────────────────

  describe('currency properties', () => {
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

    it('totalDiscountPercentage returns toNumber()', () => {
      const state = makeState({ totalDiscountPercentage: new Decimal(15) });
      expect(enhancer.getCartProperty(state, 'totalDiscountPercentage')).toBe(15);
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

    it('shippingOriginal returns 0 when no shippingMethod', () => {
      expect(enhancer.getCartProperty(makeState(), 'shippingOriginal')).toBe(0);
    });

    it('shippingDiscountAmount returns discountAmount', () => {
      const state = makeState({
        shippingMethod: makeShippingMethod(4.99, { hasDiscounts: true }),
      });
      expect(enhancer.getCartProperty(state, 'shippingDiscountAmount')).toBe(5);
    });

    it('shippingDiscountAmount returns 0 when no shippingMethod', () => {
      expect(enhancer.getCartProperty(makeState(), 'shippingDiscountAmount')).toBe(0);
    });

    it('shippingDiscountPercentage returns discountPercentage', () => {
      const state = makeState({
        shippingMethod: makeShippingMethod(4.99, { hasDiscounts: true }),
      });
      expect(enhancer.getCartProperty(state, 'shippingDiscountPercentage')).toBe(50);
    });

    it('shippingDiscountPercentage returns 0 when no shippingMethod', () => {
      expect(enhancer.getCartProperty(makeState(), 'shippingDiscountPercentage')).toBe(0);
    });
  });

  // ─── Text properties ───────────────────────────────────────────────────────

  describe('text properties', () => {
    beforeEach(() => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.shippingName'));
    });

    it('shippingName returns method name', () => {
      const state = makeState({
        shippingMethod: makeShippingMethod(5, { name: 'Express' }),
      });
      expect(enhancer.getCartProperty(state, 'shippingName')).toBe('Express');
    });

    it('shippingName returns empty string when no method', () => {
      expect(enhancer.getCartProperty(makeState(), 'shippingName')).toBe('');
    });

    it('shippingCode returns method code', () => {
      const state = makeState({
        shippingMethod: makeShippingMethod(5, { code: 'express' }),
      });
      expect(enhancer.getCartProperty(state, 'shippingCode')).toBe('express');
    });

    it('shippingCode returns empty string when no method', () => {
      expect(enhancer.getCartProperty(makeState(), 'shippingCode')).toBe('');
    });

    it('currency returns state.currency', () => {
      const state = makeState({ currency: 'EUR' });
      expect(enhancer.getCartProperty(state, 'currency')).toBe('EUR');
    });

    it('currency returns empty string when undefined', () => {
      expect(enhancer.getCartProperty(makeState(), 'currency')).toBe('');
    });
  });

  // ─── Count properties ──────────────────────────────────────────────────────

  describe('count properties', () => {
    beforeEach(() => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.itemCount'));
    });

    it('itemCount returns items.length', () => {
      const state = makeState({ items: [{ id: 1 } as any, { id: 2 } as any] });
      expect(enhancer.getCartProperty(state, 'itemCount')).toBe(2);
    });

    it('itemCount returns 0 when cart is empty', () => {
      expect(enhancer.getCartProperty(makeState(), 'itemCount')).toBe(0);
    });

    it('totalQuantity sums item quantities', () => {
      const state = makeState({
        items: [{ quantity: 2 } as any, { quantity: 3 } as any],
      });
      expect(enhancer.getCartProperty(state, 'totalQuantity')).toBe(5);
    });

    it('totalQuantity returns 0 when cart is empty', () => {
      expect(enhancer.getCartProperty(makeState(), 'totalQuantity')).toBe(0);
    });
  });

  // ─── Boolean / flag properties ─────────────────────────────────────────────

  describe('boolean / flag properties', () => {
    beforeEach(() => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.isEmpty'));
    });

    it('isEmpty returns true when cart is empty', () => {
      expect(enhancer.getCartProperty(makeState({ isEmpty: true }), 'isEmpty')).toBe(
        true,
      );
    });

    it('isEmpty returns false when cart has items', () => {
      expect(enhancer.getCartProperty(makeState({ isEmpty: false }), 'isEmpty')).toBe(
        false,
      );
    });

    it('hasDiscounts returns state.hasDiscounts', () => {
      expect(
        enhancer.getCartProperty(makeState({ hasDiscounts: true }), 'hasDiscounts'),
      ).toBe(true);
      expect(
        enhancer.getCartProperty(makeState({ hasDiscounts: false }), 'hasDiscounts'),
      ).toBe(false);
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
      const yes = makeState({
        shippingMethod: makeShippingMethod(5, { hasDiscounts: true }),
      });
      const no = makeState({
        shippingMethod: makeShippingMethod(5, { hasDiscounts: false }),
      });
      expect(enhancer.getCartProperty(yes, 'hasShippingDiscount')).toBe(true);
      expect(enhancer.getCartProperty(no, 'hasShippingDiscount')).toBe(false);
    });

    it('hasShippingDiscount is false when no shipping method', () => {
      expect(enhancer.getCartProperty(makeState(), 'hasShippingDiscount')).toBe(false);
    });

    it('isCalculating returns state.isCalculating', () => {
      expect(
        enhancer.getCartProperty(makeState({ isCalculating: true }), 'isCalculating'),
      ).toBe(true);
      expect(
        enhancer.getCartProperty(makeState({ isCalculating: false }), 'isCalculating'),
      ).toBe(false);
    });
  });

  // ─── Unknown property ──────────────────────────────────────────────────────

  describe('unknown property', () => {
    it('returns undefined for unrecognized property', () => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.notAProperty'));
      expect(enhancer.getCartProperty(makeState(), 'notAProperty')).toBeUndefined();
    });
  });

  // ─── refreshDisplay ────────────────────────────────────────────────────────

  describe('refreshDisplay', () => {
    it('does not throw when called before initialize', () => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.total'));
      expect(() => enhancer.refreshDisplay()).not.toThrow();
    });

    it('does not throw after initialize', async () => {
      enhancer = new CartDisplayEnhancer(makeElement('cart.total'));
      await enhancer.initialize();
      expect(() => enhancer.refreshDisplay()).not.toThrow();
    });
  });

  // ─── Store subscription wires up cart-state classes ────────────────────────

  describe('store subscription', () => {
    it('toggles next-cart-empty / next-cart-has-items as the store state changes', async () => {
      const el = makeElement('cart.total');
      enhancer = new CartDisplayEnhancer(el);
      await enhancer.initialize();

      // Zustand subscriptions only fire on subsequent state changes — push one.
      useCartStore.setState({ isEmpty: false });
      expect(el.classList.contains('next-cart-empty')).toBe(false);
      expect(el.classList.contains('next-cart-has-items')).toBe(true);

      useCartStore.setState({ isEmpty: true });
      expect(el.classList.contains('next-cart-empty')).toBe(true);
      expect(el.classList.contains('next-cart-has-items')).toBe(false);
    });
  });
});
