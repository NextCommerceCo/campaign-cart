import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleSelectorChange, addToCart } from '../add-to-cart.handlers';
import type { AddToCartHandlerContext, SelectorEvent } from '../add-to-cart.types';
import type { SelectorItem } from '@/types/global';
import { cartOperations } from '@/state/cart';

vi.mock('@/state/cart', () => ({
  cartOperations: {
    addItem: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  },
}));
vi.mock('@/core/url-utils', () => ({
  preserveQueryParams: (url: string) => `${url}?kept=1`,
}));

function makeContext(overrides: Partial<AddToCartHandlerContext> = {}): AddToCartHandlerContext {
  return {
    selectorId: 'main',
    quantity: 1,
    clearCart: false,
    redirectUrl: undefined,
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any,
    selectedItemRef: { value: undefined },
    updateButtonState: vi.fn(),
    emit: vi.fn(),
    properties: undefined,
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

// ─── handleSelectorChange ─────────────────────────────────────────────────────

describe('handleSelectorChange', () => {
  const noEl = () => null;
  const getItem = (_: HTMLElement): SelectorItem | null => null;

  it('ignores events for a different selector', () => {
    const ctx = makeContext({ selectorId: 'main' });
    const event: SelectorEvent = { selectorId: 'other', packageId: 5 };
    handleSelectorChange(event, noEl, getItem, ctx);
    expect(ctx.updateButtonState).not.toHaveBeenCalled();
    expect(ctx.selectedItemRef.value).toBeUndefined();
  });

  it('reads the selection from the resolved element when present', () => {
    const ctx = makeContext();
    const resolved = { packageId: 9, quantity: 2 } as unknown as SelectorItem;
    handleSelectorChange(
      { selectorId: 'main' },
      () => document.createElement('div'),
      () => resolved,
      ctx,
    );
    expect(ctx.selectedItemRef.value).toBe(resolved);
    expect(ctx.updateButtonState).toHaveBeenCalled();
  });

  it('falls back to the event item when no element resolves', () => {
    const ctx = makeContext();
    const item = { packageId: 3 } as unknown as SelectorItem;
    handleSelectorChange({ selectorId: 'main', item }, noEl, getItem, ctx);
    expect(ctx.selectedItemRef.value).toBe(item);
  });

  it('synthesizes a selection from packageId when neither element nor item exist', () => {
    const ctx = makeContext();
    handleSelectorChange({ selectorId: 'main', packageId: 7, quantity: 4 }, noEl, getItem, ctx);
    expect(ctx.selectedItemRef.value).toMatchObject({ packageId: 7, quantity: 4 });
  });

  it('clears the selection when nothing is provided', () => {
    const ctx = makeContext({ selectedItemRef: { value: { packageId: 1 } as any } });
    handleSelectorChange({ selectorId: 'main' }, noEl, getItem, ctx);
    expect(ctx.selectedItemRef.value).toBeNull();
    expect(ctx.updateButtonState).toHaveBeenCalled();
  });
});

// ─── addToCart ────────────────────────────────────────────────────────────────

describe('addToCart', () => {
  it('adds the item and emits cart:item-added with selector source', async () => {
    const ctx = makeContext({ selectorId: 'main', properties: { color: 'red' } });
    await addToCart(42, 2, ctx);
    expect(cartOperations.addItem).toHaveBeenCalledWith({
      packageId: 42,
      quantity: 2,
      isUpsell: undefined,
      properties: { color: 'red' },
    });
    expect(ctx.emit).toHaveBeenCalledWith('cart:item-added', {
      packageId: 42,
      quantity: 2,
      source: 'selector',
    });
  });

  it('reports a direct source when there is no selector', async () => {
    const ctx = makeContext({ selectorId: undefined });
    await addToCart(1, 1, ctx);
    expect(ctx.emit).toHaveBeenCalledWith(
      'cart:item-added',
      expect.objectContaining({ source: 'direct' }),
    );
  });

  it('clears the cart first when clearCart is set', async () => {
    const ctx = makeContext({ clearCart: true });
    await addToCart(1, 1, ctx);
    expect(cartOperations.clear).toHaveBeenCalled();
    const clearOrder = (cartOperations.clear as any).mock.invocationCallOrder[0];
    const addOrder = (cartOperations.addItem as any).mock.invocationCallOrder[0];
    expect(clearOrder).toBeLessThan(addOrder);
  });

  it('does not clear the cart by default', async () => {
    const ctx = makeContext({ clearCart: false });
    await addToCart(1, 1, ctx);
    expect(cartOperations.clear).not.toHaveBeenCalled();
  });

  describe('redirect', () => {
    let original: PropertyDescriptor | undefined;
    beforeEach(() => {
      original = Object.getOwnPropertyDescriptor(window, 'location');
      Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } });
    });
    afterEach(() => {
      if (original) Object.defineProperty(window, 'location', original);
    });

    it('redirects (preserving query params) when a redirect URL is set', async () => {
      const ctx = makeContext({ redirectUrl: 'https://example.com/checkout' });
      await addToCart(1, 1, ctx);
      expect(window.location.href).toBe('https://example.com/checkout?kept=1');
    });
  });
});
