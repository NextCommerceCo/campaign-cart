import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyBundle } from '../BundleSelectorEnhancer.handlers';
import type { BundleCard, BundleSlot, HandlerContext } from '../BundleSelectorEnhancer.types';
import type { CartItem } from '@/types/global';
import { useCartStore } from '@/stores/cartStore';
import { useCheckoutStore } from '@/stores/checkoutStore';

vi.mock('@/stores/cartStore', () => ({
  useCartStore: { getState: vi.fn() },
}));
vi.mock('@/stores/checkoutStore', () => ({
  useCheckoutStore: { getState: vi.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSlot(packageId: number, quantity = 1): BundleSlot {
  return {
    slotIndex: 0,
    unitIndex: 0,
    originalPackageId: packageId,
    activePackageId: packageId,
    quantity,
    configurable: false,
    variantSelected: false,
  };
}

function makeCard(bundleId: string, packageId = 1, quantity = 1): BundleCard {
  const element = document.createElement('div');
  element.classList.add('next-selected');
  element.setAttribute('data-next-selected', 'true');
  return {
    element,
    bundleId,
    name: bundleId,
    items: [{ packageId, quantity }],
    slots: [makeSlot(packageId, quantity)],
    isPreSelected: false,
    vouchers: [],
    packageStates: new Map(),
    bundlePrice: null,
    slotVarsCache: new Map(),
  };
}

function makeCtx(overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    mode: 'swap',
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
    classNames: {
      bundleCard: 'next-bundle-card',
      selected: 'next-selected',
      inCart: 'next-in-cart',
      variantSelected: 'next-variant-selected',
      variantUnavailable: 'next-variant-unavailable',
      bundleSlot: 'next-bundle-slot',
      slotVariantGroup: 'next-slot-variant-group',
    },
    isApplyingRef: { value: false },
    externalSlotsEl: null,
    containerElement: document.createElement('div'),
    isUpsellContext: false,
    selectorId: 'selector-a',
    selectCard: vi.fn(),
    getSelectedCard: vi.fn(),
    fetchAndUpdateBundlePrice: vi.fn(),
    emit: vi.fn(),
    ...overrides,
  };
}

function makeCartItem(
  packageId: number,
  quantity: number,
  selectorId?: string,
): CartItem {
  return {
    id: packageId,
    packageId,
    quantity,
    price: 0,
    image: undefined,
    title: `pkg-${packageId}`,
    sku: undefined,
    is_upsell: false,
    selectorId,
  };
}

function mockCartStore(
  items: CartItem[],
  swapCart: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
) {
  vi.mocked(useCartStore.getState).mockReturnValue({
    items,
    swapCart,
    calculateTotals: vi.fn(),
  } as any);
  return swapCart;
}

function mockCheckoutStore() {
  vi.mocked(useCheckoutStore.getState).mockReturnValue({
    vouchers: [],
    addVoucher: vi.fn(),
    removeVoucher: vi.fn(),
  } as any);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('applyBundle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckoutStore();
  });

  // ── Swap behavior (cases 1–6) ──────────────────────────────────────────────

  it('case 1 — empty cart: calls swapCart with only the new bundle items', async () => {
    const selected = makeCard('card-a', 1, 1);
    const swapCart = mockCartStore([]);
    const ctx = makeCtx();

    await applyBundle(null, selected, ctx);

    expect(swapCart).toHaveBeenCalledOnce();
    expect(swapCart).toHaveBeenCalledWith([
      expect.objectContaining({ packageId: 1, quantity: 1, selectorId: 'selector-a' }),
    ]);
    expect(ctx.isApplyingRef.value).toBe(false);
  });

  it('case 2 — first select: strips stale same-selector items when previous is null', async () => {
    const selected = makeCard('card-a', 1, 1);
    // Stale item from a previous session, same selectorId
    const swapCart = mockCartStore([makeCartItem(1, 1, 'selector-a')]);
    const ctx = makeCtx();

    await applyBundle(null, selected, ctx);

    // items with selectorId='selector-a' are removed, new ones added
    expect(swapCart).toHaveBeenCalledWith([
      expect.objectContaining({ packageId: 1, quantity: 1, selectorId: 'selector-a' }),
    ]);
    expect(swapCart.mock.calls[0][0]).toHaveLength(1);
  });

  it('case 3 — swap card: replaces previous card items with selected card items', async () => {
    const previous = makeCard('card-a', 2, 1); // pkgId=2
    const selected = makeCard('card-b', 1, 1); // pkgId=1
    const swapCart = mockCartStore([makeCartItem(2, 1, 'selector-a')]);
    const ctx = makeCtx();

    await applyBundle(previous, selected, ctx);

    expect(swapCart).toHaveBeenCalledWith([
      expect.objectContaining({ packageId: 1, quantity: 1, selectorId: 'selector-a' }),
    ]);
    expect(swapCart.mock.calls[0][0]).toHaveLength(1);
  });

  it('case 4 — other selector items: retains them alongside new bundle items', async () => {
    const previous = makeCard('card-a', 1, 1);
    const selected = makeCard('card-b', 1, 1);
    const swapCart = mockCartStore([makeCartItem(5, 1, 'selector-b')]);
    const ctx = makeCtx();

    await applyBundle(previous, selected, ctx);

    const [calledWith] = swapCart.mock.calls[0];
    expect(calledWith).toHaveLength(2);
    expect(calledWith).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ packageId: 5, selectorId: 'selector-b' }),
        expect.objectContaining({ packageId: 1, selectorId: 'selector-a' }),
      ]),
    );
  });

  it('case 5 — toggle item (no selectorId): retained alongside new bundle items', async () => {
    const previous = makeCard('card-a', 1, 1);
    const selected = makeCard('card-b', 1, 1);
    const swapCart = mockCartStore([makeCartItem(9, 1, undefined)]);
    const ctx = makeCtx();

    await applyBundle(previous, selected, ctx);

    const [calledWith] = swapCart.mock.calls[0];
    expect(calledWith).toHaveLength(2);
    expect(calledWith).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ packageId: 9, selectorId: undefined }),
        expect.objectContaining({ packageId: 1, selectorId: 'selector-a' }),
      ]),
    );
  });

  it('case 6 — package selector item (no selectorId): retained alongside new bundle items', async () => {
    const previous = makeCard('card-a', 1, 1);
    const selected = makeCard('card-b', 1, 1);
    const swapCart = mockCartStore([makeCartItem(7, 2, undefined)]);
    const ctx = makeCtx();

    await applyBundle(previous, selected, ctx);

    const [calledWith] = swapCart.mock.calls[0];
    expect(calledWith).toHaveLength(2);
    expect(calledWith).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ packageId: 7, quantity: 2, selectorId: undefined }),
        expect.objectContaining({ packageId: 1, selectorId: 'selector-a' }),
      ]),
    );
  });

  // ── Guard & error behavior (cases 7–9) ────────────────────────────────────

  it('case 7 — isApplyingRef guard: skips swapCart when already applying', async () => {
    const selected = makeCard('card-a', 1, 1);
    const swapCart = mockCartStore([]);
    const ctx = makeCtx({ isApplyingRef: { value: true } });

    await applyBundle(null, selected, ctx);

    expect(swapCart).not.toHaveBeenCalled();
    expect(ctx.isApplyingRef.value).toBe(true);
  });

  it('case 8 — swapCart throws, previous exists: reverts visual to previous card', async () => {
    const previous = makeCard('card-a', 2, 1);
    const selected = makeCard('card-b', 1, 1);
    const swapCart = mockCartStore([], vi.fn().mockRejectedValue(new Error('api error')));
    const ctx = makeCtx();

    await applyBundle(previous, selected, ctx);

    expect(swapCart).toHaveBeenCalledOnce();
    expect(ctx.selectCard).toHaveBeenCalledWith(previous);
    expect(ctx.logger.error).toHaveBeenCalled();
    expect(ctx.isApplyingRef.value).toBe(false);
  });

  it('case 9 — swapCart throws, no previous: removes selected class from selected card', async () => {
    const selected = makeCard('card-a', 1, 1);
    mockCartStore([], vi.fn().mockRejectedValue(new Error('api error')));
    const ctx = makeCtx();

    await applyBundle(null, selected, ctx);

    expect(selected.element.classList.contains('next-selected')).toBe(false);
    expect(selected.element.getAttribute('data-next-selected')).toBe('false');
    expect(ctx.selectCard).not.toHaveBeenCalled();
    expect(ctx.logger.error).toHaveBeenCalled();
    expect(ctx.isApplyingRef.value).toBe(false);
  });
});
