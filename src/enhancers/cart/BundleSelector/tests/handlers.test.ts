import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCardClick,
  applyVoucherSwap,
  onVoucherApplied,
  applyVariantChange,
  applyEffectiveChange,
  handleSelectVariantChange,
} from '../BundleSelectorEnhancer.handlers';
import type { BundleCard, BundleSlot, HandlerContext } from '../BundleSelectorEnhancer.types';
import type { CartItem } from '@/types/global';
import { useCartStore } from '@/stores/cartStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { useCampaignStore } from '@/stores/campaignStore';

vi.mock('@/stores/cartStore', () => ({
  useCartStore: { getState: vi.fn() },
}));
vi.mock('@/stores/checkoutStore', () => ({
  useCheckoutStore: { getState: vi.fn() },
}));
vi.mock('@/stores/campaignStore', () => ({
  useCampaignStore: { getState: vi.fn() },
}));

// ─── Shared helpers ───────────────────────────────────────────────────────────

function makeSlot(overrides: Partial<BundleSlot> = {}): BundleSlot {
  return {
    slotIndex: 0,
    unitIndex: 0,
    originalPackageId: 1,
    activePackageId: 1,
    quantity: 1,
    configurable: false,
    variantSelected: false,
    ...overrides,
  };
}

function makeCard(bundleId: string, overrides: Partial<BundleCard> = {}): BundleCard {
  const element = document.createElement('div');
  element.setAttribute('data-next-bundle-id', bundleId);
  return {
    element,
    bundleId,
    name: bundleId,
    items: [{ packageId: 1, quantity: 1 }],
    slots: [makeSlot()],
    isPreSelected: false,
    vouchers: [],
    packageStates: new Map(),
    bundlePrice: null,
    slotVarsCache: new Map(),
    ...overrides,
  };
}

function makeCtx(overrides: Partial<HandlerContext> = {}): HandlerContext {
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
    selectorId: 'sel-1',
    selectCard: vi.fn(),
    getSelectedCard: vi.fn(() => null),
    fetchAndUpdateBundlePrice: vi.fn().mockResolvedValue(undefined),
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
  items: CartItem[] = [],
  swapCart: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
) {
  vi.mocked(useCartStore.getState).mockReturnValue({
    items,
    swapCart,
    calculateTotals: vi.fn(),
  } as any);
  return swapCart;
}

function mockCheckoutStore(
  vouchers: string[] = [],
  addVoucher = vi.fn(),
  removeVoucher = vi.fn(),
) {
  vi.mocked(useCheckoutStore.getState).mockReturnValue({
    vouchers,
    addVoucher,
    removeVoucher,
  } as any);
  return { addVoucher, removeVoucher };
}

function mockCampaignStore(packages: any[] = []) {
  vi.mocked(useCampaignStore.getState).mockReturnValue({
    packages,
    currency: 'USD',
    data: null,
  } as any);
}

// ─── handleCardClick ──────────────────────────────────────────────────────────

describe('handleCardClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCartStore();
    mockCheckoutStore();
    mockCampaignStore();
  });

  it('same card — does nothing (early return)', async () => {
    const card = makeCard('a');
    const ctx = makeCtx();
    const event = new Event('click');

    await handleCardClick(event, card, card, ctx);

    expect(ctx.selectCard).not.toHaveBeenCalled();
    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it('isApplyingRef guard — skips when already applying', async () => {
    const card = makeCard('b');
    const ctx = makeCtx({ isApplyingRef: { value: true } });
    const event = new Event('click');

    await handleCardClick(event, card, null, ctx);

    expect(ctx.selectCard).not.toHaveBeenCalled();
  });

  it('upsell context — calls selectCard and emits bundle:selected, no cart write', async () => {
    const card = makeCard('c');
    const ctx = makeCtx({ isUpsellContext: true, mode: 'select' });
    const swapCart = mockCartStore();
    const event = new Event('click');

    await handleCardClick(event, card, null, ctx);

    expect(ctx.selectCard).toHaveBeenCalledWith(card);
    expect(ctx.emit).toHaveBeenCalledWith('bundle:selected', expect.objectContaining({
      selectorId: 'sel-1',
    }));
    expect(swapCart).not.toHaveBeenCalled();
  });

  it('select mode — calls selectCard and emits but does NOT call swapCart', async () => {
    const card = makeCard('d');
    const ctx = makeCtx({ mode: 'select' });
    const swapCart = mockCartStore();
    const event = new Event('click');

    await handleCardClick(event, card, null, ctx);

    expect(ctx.selectCard).toHaveBeenCalledWith(card);
    expect(swapCart).not.toHaveBeenCalled();
  });

  it('swap mode, no vouchers — calls selectCard, emits, calls swapCart', async () => {
    const card = makeCard('e');
    const ctx = makeCtx({ mode: 'swap' });
    const swapCart = mockCartStore();
    const event = new Event('click');

    await handleCardClick(event, card, null, ctx);

    expect(ctx.selectCard).toHaveBeenCalledWith(card);
    expect(ctx.emit).toHaveBeenCalledWith('bundle:selected', expect.anything());
    expect(swapCart).toHaveBeenCalledOnce();
  });

  it('swap mode, new card has vouchers — applies voucher swap before cart write', async () => {
    const card = makeCard('f', { vouchers: ['VOUCHER1'] });
    const { addVoucher } = mockCheckoutStore([]);
    const swapCart = mockCartStore();
    const ctx = makeCtx({ mode: 'swap' });
    const event = new Event('click');

    await handleCardClick(event, card, null, ctx);

    expect(addVoucher).toHaveBeenCalledWith('VOUCHER1');
    expect(swapCart).toHaveBeenCalledOnce();
  });

  it('swap mode, previous card has vouchers — removes previous vouchers', async () => {
    const previous = makeCard('prev', { vouchers: ['OLD'] });
    const next = makeCard('next', { vouchers: [] });
    const { removeVoucher } = mockCheckoutStore(['OLD']);
    mockCartStore();
    const ctx = makeCtx({ mode: 'swap' });
    const event = new Event('click');

    await handleCardClick(event, next, previous, ctx);

    expect(removeVoucher).toHaveBeenCalledWith('OLD');
  });
});

// ─── applyVoucherSwap ─────────────────────────────────────────────────────────

describe('applyVoucherSwap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCartStore();
  });

  it('null previous — adds next vouchers without removing anything', async () => {
    const { addVoucher, removeVoucher } = mockCheckoutStore([]);
    const next = makeCard('a', { vouchers: ['CODE1', 'CODE2'] });

    await applyVoucherSwap(null, next);

    expect(removeVoucher).not.toHaveBeenCalled();
    expect(addVoucher).toHaveBeenCalledWith('CODE1');
    expect(addVoucher).toHaveBeenCalledWith('CODE2');
  });

  it('previous has vouchers not in next — removes them', async () => {
    const { removeVoucher } = mockCheckoutStore(['OLD1', 'OLD2']);
    const previous = makeCard('prev', { vouchers: ['OLD1', 'OLD2'] });
    const next = makeCard('next', { vouchers: [] });

    await applyVoucherSwap(previous, next);

    expect(removeVoucher).toHaveBeenCalledWith('OLD1');
    expect(removeVoucher).toHaveBeenCalledWith('OLD2');
  });

  it('shared voucher — not removed from previous when also in next', async () => {
    const { removeVoucher } = mockCheckoutStore(['SHARED', 'OLD']);
    const previous = makeCard('prev', { vouchers: ['SHARED', 'OLD'] });
    const next = makeCard('next', { vouchers: ['SHARED'] });

    await applyVoucherSwap(previous, next);

    expect(removeVoucher).not.toHaveBeenCalledWith('SHARED');
    expect(removeVoucher).toHaveBeenCalledWith('OLD');
  });

  it('does not add vouchers already in checkout store', async () => {
    // CODE1 is already present in the checkout store; CODE2 is not.
    const addVoucher = vi.fn();
    const removeVoucher = vi.fn();
    vi.mocked(useCheckoutStore.getState).mockReturnValue({
      vouchers: ['CODE1'],
      addVoucher,
      removeVoucher,
    } as any);

    const next = makeCard('a', { vouchers: ['CODE1', 'CODE2'] });
    await applyVoucherSwap(null, next);

    expect(addVoucher).not.toHaveBeenCalledWith('CODE1');
    expect(addVoucher).toHaveBeenCalledWith('CODE2');
  });

  it('calls calculateTotals after voucher changes', async () => {
    const calculateTotals = vi.fn();
    vi.mocked(useCartStore.getState).mockReturnValue({
      items: [],
      swapCart: vi.fn(),
      calculateTotals,
    } as any);
    mockCheckoutStore([]);
    const next = makeCard('a', { vouchers: [] });

    await applyVoucherSwap(null, next);

    expect(calculateTotals).toHaveBeenCalledOnce();
  });
});

// ─── onVoucherApplied ─────────────────────────────────────────────────────────

describe('onVoucherApplied', () => {
  const fetchPrice = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => vi.clearAllMocks());

  it('user coupon added — calls fetchPrice for each card', () => {
    const cards = [makeCard('a'), makeCard('b')];
    const allBundleVouchers = new Set<string>();

    onVoucherApplied(['USER1'], [], cards, allBundleVouchers, fetchPrice);

    expect(fetchPrice).toHaveBeenCalledTimes(2);
    expect(fetchPrice).toHaveBeenCalledWith(cards[0]);
    expect(fetchPrice).toHaveBeenCalledWith(cards[1]);
  });

  it('user coupon removed — calls fetchPrice', () => {
    const cards = [makeCard('a')];
    const allBundleVouchers = new Set<string>();

    onVoucherApplied([], ['USER1'], cards, allBundleVouchers, fetchPrice);

    expect(fetchPrice).toHaveBeenCalledOnce();
  });

  it('only bundle voucher changed — does NOT call fetchPrice', () => {
    const cards = [makeCard('a')];
    const allBundleVouchers = new Set(['BUNDLE_CODE']);

    // Bundle voucher added — user-coupon set unchanged (still empty)
    onVoucherApplied(['BUNDLE_CODE'], [], cards, allBundleVouchers, fetchPrice);

    expect(fetchPrice).not.toHaveBeenCalled();
  });

  it('bundle voucher removed — does NOT call fetchPrice', () => {
    const cards = [makeCard('a')];
    const allBundleVouchers = new Set(['BUNDLE_CODE']);

    onVoucherApplied([], ['BUNDLE_CODE'], cards, allBundleVouchers, fetchPrice);

    expect(fetchPrice).not.toHaveBeenCalled();
  });

  it('user coupon and bundle voucher both changed — fetchPrice still fires (user coupon changed)', () => {
    const cards = [makeCard('a')];
    const allBundleVouchers = new Set(['BUNDLE_CODE']);

    onVoucherApplied(['USER1', 'BUNDLE_CODE'], [], cards, allBundleVouchers, fetchPrice);

    expect(fetchPrice).toHaveBeenCalledOnce();
  });

  it('no change at all — does NOT call fetchPrice', () => {
    const cards = [makeCard('a')];
    const allBundleVouchers = new Set<string>();

    onVoucherApplied(['USER1'], ['USER1'], cards, allBundleVouchers, fetchPrice);

    expect(fetchPrice).not.toHaveBeenCalled();
  });
});

// ─── applyEffectiveChange ─────────────────────────────────────────────────────

describe('applyEffectiveChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignStore();
  });

  it('isApplyingRef guard — skips swapCart when already applying', async () => {
    const card = makeCard('a');
    const swapCart = mockCartStore();
    const ctx = makeCtx({ isApplyingRef: { value: true } });

    await applyEffectiveChange(card, ctx);

    expect(swapCart).not.toHaveBeenCalled();
  });

  it('success — calls swapCart with effective items tagged with selectorId', async () => {
    const card = makeCard('a', {
      slots: [makeSlot({ activePackageId: 5, quantity: 2 })],
    });
    const swapCart = mockCartStore([]);
    const ctx = makeCtx({ selectorId: 'sel-x' });

    await applyEffectiveChange(card, ctx);

    expect(swapCart).toHaveBeenCalledWith([
      expect.objectContaining({ packageId: 5, quantity: 2, selectorId: 'sel-x' }),
    ]);
    expect(ctx.isApplyingRef.value).toBe(false);
  });

  it('success — retains unrelated cart items', async () => {
    const card = makeCard('a', {
      slots: [makeSlot({ activePackageId: 5, quantity: 1 })],
    });
    const swapCart = mockCartStore([makeCartItem(99, 1, 'other-sel')]);
    const ctx = makeCtx({ selectorId: 'sel-x' });

    await applyEffectiveChange(card, ctx);

    const [payload] = swapCart.mock.calls[0];
    expect(payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ packageId: 99, selectorId: 'other-sel' }),
        expect.objectContaining({ packageId: 5, selectorId: 'sel-x' }),
      ]),
    );
  });

  it('error — reverts slot activePackageIds to snapshot values', async () => {
    const slots = [
      makeSlot({ slotIndex: 0, activePackageId: 10 }),
      makeSlot({ slotIndex: 1, activePackageId: 11 }),
    ];
    const card = makeCard('a', { slots });
    mockCartStore([], vi.fn().mockRejectedValue(new Error('network error')));
    const ctx = makeCtx();

    // Simulate slots already mutated to new packages before the cart call
    slots[0].activePackageId = 20;
    slots[1].activePackageId = 21;

    await applyEffectiveChange(card, ctx);

    // Must revert to the snapshot captured before swapCart
    expect(slots[0].activePackageId).toBe(20); // snapshot was 20 (the mutated value)
    expect(ctx.logger.error).toHaveBeenCalled();
    expect(ctx.isApplyingRef.value).toBe(false);
  });

  it('error — emits bundle:selection-changed with effective items after revert', async () => {
    const card = makeCard('a', {
      slots: [makeSlot({ activePackageId: 5 })],
    });
    mockCartStore([], vi.fn().mockRejectedValue(new Error('fail')));
    const ctx = makeCtx({ selectorId: 'sel-1' });

    await applyEffectiveChange(card, ctx);

    expect(ctx.emit).toHaveBeenCalledWith('bundle:selection-changed', expect.objectContaining({
      selectorId: 'sel-1',
    }));
  });

  it('isApplyingRef.value is false after success', async () => {
    const card = makeCard('a');
    mockCartStore();
    const ctx = makeCtx();

    await applyEffectiveChange(card, ctx);

    expect(ctx.isApplyingRef.value).toBe(false);
  });
});

// ─── applyVariantChange ───────────────────────────────────────────────────────

describe('applyVariantChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCartStore();
  });

  function makeVariantPkg(refId: number, productId: number, attrs: Array<{ code: string; value: string }>) {
    return {
      ref_id: refId,
      product_id: productId,
      product_variant_attribute_values: attrs,
    };
  }

  it('isApplyingRef guard — no-op when applying', async () => {
    const card = makeCard('a');
    const ctx = makeCtx({ isApplyingRef: { value: true } });

    await applyVariantChange(card, 0, { color: 'red' }, ctx);

    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it('slot not found — no-op', async () => {
    const card = makeCard('a');
    const ctx = makeCtx();

    await applyVariantChange(card, 99, { color: 'red' }, ctx);

    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it('current package has no product_id — no-op', async () => {
    mockCampaignStore([{ ref_id: 1, product_id: undefined }]);
    const card = makeCard('a', { slots: [makeSlot({ activePackageId: 1 })] });
    const ctx = makeCtx();

    await applyVariantChange(card, 0, { color: 'red' }, ctx);

    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it('no matching package — logs warn, does not update slot', async () => {
    mockCampaignStore([
      makeVariantPkg(1, 100, [{ code: 'color', value: 'blue' }]),
    ]);
    const card = makeCard('a', { slots: [makeSlot({ activePackageId: 1 })] });
    const ctx = makeCtx();

    await applyVariantChange(card, 0, { color: 'green' }, ctx);

    expect(ctx.logger.warn).toHaveBeenCalledWith(
      'No package found for variant combination',
      { color: 'green' },
    );
    expect(card.slots[0].variantSelected).toBe(false);
  });

  it('same package already selected — marks variantSelected, emits selection-changed, no cart write', async () => {
    mockCampaignStore([
      makeVariantPkg(1, 100, [{ code: 'color', value: 'red' }]),
    ]);
    const swapCart = mockCartStore();
    const card = makeCard('a', { slots: [makeSlot({ activePackageId: 1 })] });
    const ctx = makeCtx({ selectorId: 'sel-1' });

    await applyVariantChange(card, 0, { color: 'red' }, ctx);

    expect(card.slots[0].variantSelected).toBe(true);
    expect(ctx.emit).toHaveBeenCalledWith('bundle:selection-changed', expect.anything());
    expect(swapCart).not.toHaveBeenCalled();
  });

  it('different package — updates slot.activePackageId, emits, fetches price', async () => {
    mockCampaignStore([
      makeVariantPkg(1, 100, [{ code: 'color', value: 'blue' }]),
      makeVariantPkg(2, 100, [{ code: 'color', value: 'red' }]),
    ]);
    const card = makeCard('a', { slots: [makeSlot({ activePackageId: 1 })] });
    const ctx = makeCtx({ mode: 'select' }); // select mode — no cart write

    await applyVariantChange(card, 0, { color: 'red' }, ctx);

    expect(card.slots[0].activePackageId).toBe(2);
    expect(card.slots[0].variantSelected).toBe(true);
    expect(ctx.fetchAndUpdateBundlePrice).toHaveBeenCalledWith(card);
    expect(ctx.emit).toHaveBeenCalledWith('bundle:selection-changed', expect.anything());
  });

  it('different package in swap mode — calls applyEffectiveChange (swapCart called)', async () => {
    mockCampaignStore([
      makeVariantPkg(1, 100, [{ code: 'color', value: 'blue' }]),
      makeVariantPkg(2, 100, [{ code: 'color', value: 'red' }]),
    ]);
    const swapCart = mockCartStore();
    const card = makeCard('a', { slots: [makeSlot({ activePackageId: 1 })] });
    const ctx = makeCtx({ mode: 'swap' });

    await applyVariantChange(card, 0, { color: 'red' }, ctx);

    expect(swapCart).toHaveBeenCalledOnce();
  });

  it('new packageId not yet in packageStates — adds provisional entry', async () => {
    mockCampaignStore([
      makeVariantPkg(1, 100, [{ code: 'color', value: 'blue' }]),
      {
        ref_id: 2,
        product_id: 100,
        name: 'Widget Red',
        image: '',
        product_name: 'Widget',
        product_variant_name: 'Red',
        price_total: '10.00',
        price_recurring_total: '0',
        is_recurring: false,
        product_variant_attribute_values: [{ code: 'color', value: 'red' }],
      },
    ]);
    mockCartStore();
    const card = makeCard('a', { slots: [makeSlot({ activePackageId: 1 })] });
    const ctx = makeCtx({ mode: 'select' });

    await applyVariantChange(card, 0, { color: 'red' }, ctx);

    expect(card.packageStates.has(2)).toBe(true);
  });
});

// ─── handleSelectVariantChange ────────────────────────────────────────────────

describe('handleSelectVariantChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCartStore();
  });

  it('card not found — no-op', async () => {
    mockCampaignStore([]);
    const ctx = makeCtx();

    const select = document.createElement('select');
    select.dataset.nextVariantCode = 'color';
    select.value = 'red';

    await handleSelectVariantChange(select, 'nonexistent', 0, [], ctx);

    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it('slot element not found in card — no-op', async () => {
    mockCampaignStore([]);
    const card = makeCard('bundle-a');
    // card.element has no [data-next-slot-index="0"] child
    const ctx = makeCtx();

    const select = document.createElement('select');
    select.dataset.nextVariantCode = 'color';
    select.value = 'red';

    await handleSelectVariantChange(select, 'bundle-a', 0, [card], ctx);

    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it('collects attrs from selects in slotEl and delegates to applyVariantChange', async () => {
    // Set up packages so applyVariantChange can match a package
    mockCampaignStore([
      {
        ref_id: 1,
        product_id: 100,
        product_variant_attribute_values: [{ code: 'color', value: 'red' }],
      },
    ]);

    const card = makeCard('bundle-a', {
      slots: [makeSlot({ slotIndex: 0, activePackageId: 1 })],
    });

    // Build a slot element inside card.element with a select that has an <option>
    const slotEl = document.createElement('div');
    slotEl.setAttribute('data-next-slot-index', '0');
    const colorSelect = document.createElement('select');
    colorSelect.dataset.nextVariantCode = 'color';
    const opt = document.createElement('option');
    opt.value = 'red';
    colorSelect.appendChild(opt);
    colorSelect.value = 'red';
    slotEl.appendChild(colorSelect);
    card.element.appendChild(slotEl);

    const ctx = makeCtx({ mode: 'select' });

    await handleSelectVariantChange(colorSelect, 'bundle-a', 0, [card], ctx);

    // applyVariantChange should run — same package so emits selection-changed
    expect(card.slots[0].variantSelected).toBe(true);
    expect(ctx.emit).toHaveBeenCalledWith('bundle:selection-changed', expect.anything());
  });

  it('changed select value overrides any value collected from slotEl DOM', async () => {
    // Two selects: size in slotEl, color passed via _select (not in slotEl)
    mockCampaignStore([
      {
        ref_id: 1,
        product_id: 100,
        product_variant_attribute_values: [
          { code: 'size', value: 'L' },
          { code: 'color', value: 'blue' },
        ],
      },
    ]);

    const card = makeCard('bundle-a', {
      slots: [makeSlot({ slotIndex: 0, activePackageId: 1 })],
    });

    const slotEl = document.createElement('div');
    slotEl.setAttribute('data-next-slot-index', '0');
    const sizeSelect = document.createElement('select');
    sizeSelect.dataset.nextVariantCode = 'size';
    const sizeOpt = document.createElement('option');
    sizeOpt.value = 'L';
    sizeSelect.appendChild(sizeOpt);
    sizeSelect.value = 'L';
    slotEl.appendChild(sizeSelect);
    card.element.appendChild(slotEl);

    // _select represents the color dropdown (outside slotEl) — its value overrides
    const colorSelect = document.createElement('select');
    colorSelect.dataset.nextVariantCode = 'color';
    const colorOpt = document.createElement('option');
    colorOpt.value = 'blue';
    colorSelect.appendChild(colorOpt);
    colorSelect.value = 'blue';

    const ctx = makeCtx({ mode: 'select' });

    await handleSelectVariantChange(colorSelect, 'bundle-a', 0, [card], ctx);

    // Should match the package with size=L and color=blue
    expect(card.slots[0].variantSelected).toBe(true);
  });
});
