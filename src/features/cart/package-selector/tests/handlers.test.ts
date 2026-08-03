import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectItem,
  handleCardClick,
  updateCart,
  setShippingMethod,
  handleQuantityChange,
} from '../package-selector.handlers';
import type { SelectorHandlerContext } from '../package-selector.types';
import type { SelectorItem } from '@/types/global';
import { useCartStore } from '@/state/cart';

vi.mock('@/state/cart', () => {
  const getState = vi.fn();
  const op = (m: string) => (...args: any[]) => getState()?.[m]?.(...args);
  return {
    useCartStore: { getState },
    cartOperations: {
      addItem: op('addItem'),
      swapPackage: op('swapPackage'),
      updateQuantity: op('updateQuantity'),
      setShippingMethod: op('setShippingMethod'),
    },
  };
});
vi.mock('@/features/cart/shared/quantity-controls', () => ({
  setupQuantityControls: vi.fn(),
}));

function makeItem(packageId: number, overrides: Partial<SelectorItem> = {}): SelectorItem {
  const element = document.createElement('div');
  element.setAttribute('data-next-package-id', String(packageId));
  return {
    element,
    packageId,
    quantity: 1,
    price: 10,
    name: `pkg-${packageId}`,
    isPreSelected: false,
    shippingId: undefined,
    ...overrides,
  } as SelectorItem;
}

function makeCtx(items: SelectorItem[], overrides: Partial<SelectorHandlerContext> = {}): SelectorHandlerContext {
  return {
    selectorId: 'main',
    mode: 'select',
    includeShipping: false,
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any,
    element: document.createElement('div'),
    emit: vi.fn(),
    selectedItemRef: { value: null },
    items,
    ...overrides,
  };
}

function mockCart(state: Record<string, any> = {}) {
  const s = {
    items: [] as any[],
    hasItem: vi.fn().mockReturnValue(false),
    addItem: vi.fn().mockResolvedValue(undefined),
    swapPackage: vi.fn().mockResolvedValue(undefined),
    updateQuantity: vi.fn().mockResolvedValue(undefined),
    setShippingMethod: vi.fn().mockResolvedValue(undefined),
    ...state,
  };
  (useCartStore.getState as any).mockReturnValue(s);
  return s;
}

beforeEach(() => vi.clearAllMocks());

// ─── selectItem ──────────────────────────────────────────────────────────────

describe('selectItem', () => {
  it('marks the chosen item selected and deselects the rest', () => {
    const a = makeItem(1);
    const b = makeItem(2);
    a.element.classList.add('next-selected');
    const ctx = makeCtx([a, b]);
    selectItem(b, ctx);

    expect(a.element.classList.contains('next-selected')).toBe(false);
    expect(a.element.getAttribute('data-next-selected')).toBe('false');
    expect(b.element.classList.contains('next-selected')).toBe(true);
    expect(b.element.getAttribute('data-next-selected')).toBe('true');
    expect(ctx.selectedItemRef.value).toBe(b);
    expect(ctx.element.getAttribute('data-selected-package')).toBe('2');
    expect(ctx.emit).toHaveBeenCalledWith(
      'selector:selection-changed',
      expect.objectContaining({ selectorId: 'main', packageId: 2 }),
    );
  });
});

// ─── handleCardClick ───────────────────────────────────────────────────────────

describe('handleCardClick', () => {
  const clickEvent = () => ({ preventDefault: vi.fn() }) as unknown as Event;

  it('does nothing when the item is already selected', async () => {
    const a = makeItem(1);
    const ctx = makeCtx([a], { selectedItemRef: { value: a } });
    await handleCardClick(clickEvent(), a, ctx);
    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it('selects and emits item-selected with pendingAction in select mode', async () => {
    mockCart();
    const a = makeItem(1);
    const b = makeItem(2);
    const ctx = makeCtx([a, b], { mode: 'select', selectedItemRef: { value: a } });
    await handleCardClick(clickEvent(), b, ctx);
    expect(ctx.emit).toHaveBeenCalledWith(
      'selector:item-selected',
      expect.objectContaining({ packageId: 2, previousPackageId: 1, mode: 'select', pendingAction: true }),
    );
  });

  it('updates the cart in swap mode', async () => {
    const cart = mockCart();
    const a = makeItem(1);
    const b = makeItem(2, { shippingId: '3' });
    const ctx = makeCtx([a, b], { mode: 'swap', selectedItemRef: { value: null } });
    await handleCardClick(clickEvent(), b, ctx);
    expect(cart.addItem).toHaveBeenCalledWith({ packageId: 2, quantity: 1, isUpsell: false });
    expect(cart.setShippingMethod).toHaveBeenCalledWith(3);
  });
});

// ─── updateCart ────────────────────────────────────────────────────────────────

describe('updateCart', () => {
  it('swaps when a selector package is already in the cart', async () => {
    const items = [makeItem(1), makeItem(2)];
    const cart = mockCart({ items: [{ packageId: 1 }] });
    await updateCart(items[0]!, items[1]!, items);
    expect(cart.swapPackage).toHaveBeenCalledWith(1, { packageId: 2, quantity: 1, isUpsell: false });
  });

  it('adds when no selector package is in the cart', async () => {
    const items = [makeItem(1), makeItem(2)];
    const cart = mockCart({ items: [], hasItem: vi.fn().mockReturnValue(false) });
    await updateCart(null, items[1]!, items);
    expect(cart.addItem).toHaveBeenCalledWith({ packageId: 2, quantity: 1, isUpsell: false });
  });

  it('does nothing when the selected package is already the cart item', async () => {
    const items = [makeItem(2)];
    const cart = mockCart({ items: [{ packageId: 2 }] });
    await updateCart(null, items[0]!, items);
    expect(cart.swapPackage).not.toHaveBeenCalled();
    expect(cart.addItem).not.toHaveBeenCalled();
  });
});

// ─── setShippingMethod ──────────────────────────────────────────────────────────

describe('setShippingMethod', () => {
  it('sets a numeric shipping id', async () => {
    const cart = mockCart();
    const logger = { warn: vi.fn() } as any;
    await setShippingMethod('5', { logger });
    expect(cart.setShippingMethod).toHaveBeenCalledWith(5);
  });

  it('warns and skips a non-numeric shipping id', async () => {
    const cart = mockCart();
    const logger = { warn: vi.fn() } as any;
    await setShippingMethod('abc', { logger });
    expect(logger.warn).toHaveBeenCalled();
    expect(cart.setShippingMethod).not.toHaveBeenCalled();
  });
});

// ─── handleQuantityChange ────────────────────────────────────────────────────────

describe('handleQuantityChange', () => {
  it('emits quantity-changed and updates the cart in swap mode when selected', async () => {
    const item = makeItem(2, { quantity: 3 });
    const cart = mockCart({ hasItem: vi.fn().mockReturnValue(true) });
    const ctx = makeCtx([item], { mode: 'swap', selectedItemRef: { value: item } });
    await handleQuantityChange(item, ctx);
    expect(ctx.emit).toHaveBeenCalledWith(
      'selector:quantity-changed',
      expect.objectContaining({ packageId: 2, quantity: 3 }),
    );
    expect(cart.updateQuantity).toHaveBeenCalledWith(2, 3);
  });

  it('only emits (no cart write) in select mode', async () => {
    const item = makeItem(2, { quantity: 3 });
    const cart = mockCart();
    const ctx = makeCtx([item], { mode: 'select', selectedItemRef: { value: item } });
    await handleQuantityChange(item, ctx);
    expect(ctx.emit).toHaveBeenCalled();
    expect(cart.updateQuantity).not.toHaveBeenCalled();
    expect(cart.addItem).not.toHaveBeenCalled();
  });
});
