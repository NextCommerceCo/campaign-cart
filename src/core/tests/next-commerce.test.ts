import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextCommerce } from '@/core/next-commerce';
import { useCartStore } from '@/state/cart';
import { useParameterStore } from '@/state/parameter';
import type { CartItem } from '@/types/global';

const exitIntentMocks = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  setup: vi.fn(),
  disable: vi.fn(),
}));

vi.mock('@/features/behavior/simple-exit-intent', () => ({
  ExitIntentEnhancer: vi.fn().mockImplementation(() => ({
    initialize: exitIntentMocks.initialize,
    setup: exitIntentMocks.setup,
    disable: exitIntentMocks.disable,
  })),
}));

/**
 * `next-commerce.ts` was split by `@category` into sibling modules
 * (`next-commerce.cart.ts`, `next-commerce.analytics.ts`, …) that the class
 * now delegates to — see the file for the full list. These tests exist to
 * prove the split changed no observable behavior: the singleton is still
 * single, and a method from each relocated module still reads/writes the
 * same store it always did.
 */

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    packageId: 1,
    quantity: 1,
    price: 10,
    title: 'Package',
    sku: undefined,
    image: undefined,
    is_upsell: false,
    ...overrides,
  } as CartItem;
}

beforeEach(() => {
  useCartStore.getState().reset();
  useParameterStore.setState({ params: {} });
});

describe('NextCommerce.getInstance()', () => {
  it('returns the exact same object on every call', () => {
    const a = NextCommerce.getInstance();
    const b = NextCommerce.getInstance();
    expect(a).toBe(b);
  });

  it('keeps instance state across separate getInstance() call sites', () => {
    // Simulates two different modules each calling getInstance() themselves,
    // as `window.next` consumers do — a duplicated singleton would give the
    // second caller a metadata store that looks empty.
    NextCommerce.getInstance().setParam('utm_source', 'newsletter');
    expect(NextCommerce.getInstance().getParam('utm_source')).toBe(
      'newsletter'
    );
  });
});

describe('NextCommerce — Cart category (next-commerce.cart.ts)', () => {
  it('hasItemInCart reflects the real cart store', () => {
    const sdk = NextCommerce.getInstance();
    expect(sdk.hasItemInCart({ packageId: 7 })).toBe(false);

    useCartStore.setState({ items: [makeItem({ packageId: 7 })] });
    expect(sdk.hasItemInCart({ packageId: 7 })).toBe(true);
  });

  it('getCartCount sums item quantities from the store', () => {
    useCartStore.setState({
      items: [
        makeItem({ id: 1, packageId: 1, quantity: 2 }),
        makeItem({ id: 2, packageId: 2, quantity: 3 }),
      ],
      totalQuantity: 5,
    });

    expect(NextCommerce.getInstance().getCartCount()).toBe(5);
  });
});

describe('NextCommerce — Campaign category (next-commerce.campaign.ts)', () => {
  it('createVariantKey builds a sorted, order-independent key', () => {
    const sdk = NextCommerce.getInstance();
    expect(sdk.createVariantKey({ size: 'L', color: 'red' })).toBe(
      sdk.createVariantKey({ color: 'red', size: 'L' })
    );
    expect(sdk.createVariantKey({ color: 'red', size: 'L' })).toBe(
      'color:red|size:L'
    );
  });
});

describe('NextCommerce — Coupons category (next-commerce.coupons.ts)', () => {
  it('getCoupons reads the cart store vouchers', () => {
    useCartStore.setState({ vouchers: ['SAVE10'] });
    expect(NextCommerce.getInstance().getCoupons()).toEqual(['SAVE10']);
  });
});

describe('NextCommerce — URL Parameters category (next-commerce.url-params.ts)', () => {
  it('setParam / getParam round-trip through the parameter store', () => {
    const sdk = NextCommerce.getInstance();
    sdk.setParam('gclid', 'abc123');
    expect(sdk.getParam('gclid')).toBe('abc123');
    expect(useParameterStore.getState().params.gclid).toBe('abc123');
  });

  it('getParam returns null, not undefined, for a key never captured', () => {
    expect(NextCommerce.getInstance().getParam('never-set')).toBeNull();
  });
});

describe('NextCommerce — Popups category (next-commerce.popups.ts)', () => {
  it('lazy-loads the exit-intent enhancer once and reuses it on later calls', async () => {
    const sdk = NextCommerce.getInstance();
    const { ExitIntentEnhancer } = await import(
      '@/features/behavior/simple-exit-intent'
    );

    await sdk.exitIntent({ image: 'first.png' });
    await sdk.exitIntent({ image: 'second.png' });

    // The private popups ref (`popupsState.exitIntentEnhancer`) that replaced
    // two separate fields must still gate construction to once — a second
    // instance here would mean state silently split across calls.
    expect(ExitIntentEnhancer).toHaveBeenCalledTimes(1);
    expect(exitIntentMocks.setup).toHaveBeenCalledTimes(2);

    sdk.disableExitIntent();
    expect(exitIntentMocks.disable).toHaveBeenCalledTimes(1);
  });
});
