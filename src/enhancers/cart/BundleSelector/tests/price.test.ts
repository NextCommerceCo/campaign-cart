import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { fetchAndUpdateBundlePrice } from '../BundleSelectorEnhancer.price';
import type { BundleCard, BundleSlot, PriceContext } from '../BundleSelectorEnhancer.types';

vi.mock('@/stores/campaignStore', () => ({
  useCampaignStore: { getState: vi.fn() },
}));
vi.mock('@/stores/checkoutStore', () => ({
  useCheckoutStore: { getState: vi.fn() },
}));
vi.mock('@/utils/calculations/CartCalculator', () => ({
  calculateBundlePrice: vi.fn(),
}));

import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { calculateBundlePrice } from '@/utils/calculations/CartCalculator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function makeCard(overrides: Partial<BundleCard> = {}): BundleCard {
  return {
    element: document.createElement('div'),
    bundleId: 'bundle-a',
    name: 'Bundle A',
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

function makeCtx(overrides: Partial<PriceContext> = {}): PriceContext {
  return {
    includeShipping: false,
    allBundleVouchers: new Set(),
    isUpsellContext: false,
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
    ...overrides,
  };
}

function makeApiResult(overrides: Partial<{
  total: Decimal;
  subtotal: Decimal;
  totalDiscount: Decimal;
  totalDiscountPercentage: Decimal;
  summary: any;
}> = {}) {
  return {
    total: new Decimal(20),
    subtotal: new Decimal(25),
    totalDiscount: new Decimal(5),
    totalDiscountPercentage: new Decimal(20),
    summary: {
      lines: [],
    },
    ...overrides,
  };
}

function mockStores(vouchers: string[] = []) {
  vi.mocked(useCampaignStore.getState).mockReturnValue({
    currency: 'USD',
    packages: [],
    data: null,
  } as any);
  vi.mocked(useCheckoutStore.getState).mockReturnValue({
    vouchers,
  } as any);
}

// ─── fetchAndUpdateBundlePrice ────────────────────────────────────────────────

describe('fetchAndUpdateBundlePrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets next-loading class and data-next-loading="true" before fetch, clears after', async () => {
    mockStores();
    vi.mocked(calculateBundlePrice).mockResolvedValue(makeApiResult() as any);
    const card = makeCard();

    const promise = fetchAndUpdateBundlePrice(card, makeCtx());
    // Loading state should be set synchronously before the await resolves
    expect(card.element.classList.contains('next-loading')).toBe(true);
    expect(card.element.getAttribute('data-next-loading')).toBe('true');

    await promise;

    expect(card.element.classList.contains('next-loading')).toBe(false);
    expect(card.element.getAttribute('data-next-loading')).toBe('false');
  });

  it('clears loading state even on error', async () => {
    mockStores();
    vi.mocked(calculateBundlePrice).mockRejectedValue(new Error('network fail'));
    const card = makeCard();
    const ctx = makeCtx();

    await fetchAndUpdateBundlePrice(card, ctx);

    expect(card.element.classList.contains('next-loading')).toBe(false);
    expect(card.element.getAttribute('data-next-loading')).toBe('false');
  });

  it('logs a warning on error and does not throw', async () => {
    mockStores();
    vi.mocked(calculateBundlePrice).mockRejectedValue(new Error('timeout'));
    const card = makeCard();
    const ctx = makeCtx();

    await expect(fetchAndUpdateBundlePrice(card, ctx)).resolves.toBeUndefined();
    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  it('populates card.bundlePrice after a successful fetch', async () => {
    mockStores();
    vi.mocked(calculateBundlePrice).mockResolvedValue(
      makeApiResult({
        total: new Decimal(30),
        subtotal: new Decimal(40),
        totalDiscount: new Decimal(10),
        totalDiscountPercentage: new Decimal(25),
      }) as any,
    );
    const card = makeCard({ slots: [makeSlot({ quantity: 1 })] });

    await fetchAndUpdateBundlePrice(card, makeCtx());

    expect(card.bundlePrice).not.toBeNull();
    expect(card.bundlePrice!.price.toNumber()).toBe(30);
    expect(card.bundlePrice!.originalPrice.toNumber()).toBe(40);
    expect(card.bundlePrice!.discountAmount.toNumber()).toBe(10);
    expect(card.bundlePrice!.hasDiscount).toBe(true);
  });

  it('bundlePrice.hasDiscount is false when totalDiscount is 0', async () => {
    mockStores();
    vi.mocked(calculateBundlePrice).mockResolvedValue(
      makeApiResult({
        totalDiscount: new Decimal(0),
        totalDiscountPercentage: new Decimal(0),
      }) as any,
    );
    const card = makeCard();

    await fetchAndUpdateBundlePrice(card, makeCtx());

    expect(card.bundlePrice!.hasDiscount).toBe(false);
  });

  it('bundlePrice.unitPrice = price / totalQuantity', async () => {
    mockStores();
    vi.mocked(calculateBundlePrice).mockResolvedValue(
      makeApiResult({ total: new Decimal(30) }) as any,
    );
    // 3 slots of quantity 1 each = totalQuantity 3
    const card = makeCard({
      slots: [
        makeSlot({ slotIndex: 0, quantity: 1 }),
        makeSlot({ slotIndex: 1, quantity: 1 }),
        makeSlot({ slotIndex: 2, quantity: 1 }),
      ],
    });

    await fetchAndUpdateBundlePrice(card, makeCtx());

    // 30 / 3 = 10
    expect(card.bundlePrice!.unitPrice.toNumber()).toBe(10);
    expect(card.bundlePrice!.quantity).toBe(3);
  });

  it('noSlot slots are excluded from totalQuantity calculation', async () => {
    mockStores();
    vi.mocked(calculateBundlePrice).mockResolvedValue(
      makeApiResult({ total: new Decimal(20) }) as any,
    );
    const card = makeCard({
      slots: [
        makeSlot({ slotIndex: 0, quantity: 2 }),
        makeSlot({ slotIndex: 1, quantity: 1, noSlot: true }),
      ],
    });

    await fetchAndUpdateBundlePrice(card, makeCtx());

    // noSlot excluded: quantity = 2, not 3
    expect(card.bundlePrice!.quantity).toBe(2);
    expect(card.bundlePrice!.unitPrice.toNumber()).toBe(10); // 20 / 2
  });

  it('updates card.packageStates from result.summary.lines', async () => {
    mockStores();
    const packageState = {
      packageId: 1,
      name: 'Widget',
      image: '',
      productName: '',
      variantName: '',
      sku: null,
      isRecurring: false,
      interval: null,
      intervalCount: null,
      recurringPrice: new Decimal(0),
      originalRecurringPrice: new Decimal(0),
      unitPrice: new Decimal(10),
      originalUnitPrice: new Decimal(10),
      discountAmount: new Decimal(0),
      discountPercentage: new Decimal(0),
      originalPrice: new Decimal(10),
      price: new Decimal(10),
      hasDiscount: false,
      currency: 'USD',
    };
    const card = makeCard();
    card.packageStates.set(1, packageState);

    vi.mocked(calculateBundlePrice).mockResolvedValue(
      makeApiResult({
        summary: {
          lines: [{
            package_id: 1,
            total_discount: '5',
            subtotal: '25',
            price_recurring_total: '0',
            package_price: '20',
            original_package_price: '25',
            total: '20',
          }],
        },
      }) as any,
    );

    await fetchAndUpdateBundlePrice(card, makeCtx());

    const updated = card.packageStates.get(1)!;
    expect(updated.unitPrice.toNumber()).toBe(20);
    expect(updated.originalUnitPrice.toNumber()).toBe(25);
    expect(updated.hasDiscount).toBe(true);
    expect(updated.discountAmount.toNumber()).toBe(5);
  });

  it('passes upsell=true to calculateBundlePrice when isUpsellContext=true', async () => {
    mockStores();
    vi.mocked(calculateBundlePrice).mockResolvedValue(makeApiResult() as any);
    const card = makeCard();
    const ctx = makeCtx({ isUpsellContext: true });

    await fetchAndUpdateBundlePrice(card, ctx);

    expect(calculateBundlePrice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ upsell: true }),
    );
  });

  it('excludes bundle-managed vouchers from the user-coupon merge', async () => {
    vi.mocked(useCampaignStore.getState).mockReturnValue({ currency: 'USD', packages: [], data: null } as any);
    vi.mocked(useCheckoutStore.getState).mockReturnValue({ vouchers: ['USER1', 'BUNDLE_A'] } as any);
    vi.mocked(calculateBundlePrice).mockResolvedValue(makeApiResult() as any);

    const card = makeCard({ vouchers: ['BUNDLE_B'] });
    const ctx = makeCtx({ allBundleVouchers: new Set(['BUNDLE_A', 'BUNDLE_B']) });

    await fetchAndUpdateBundlePrice(card, ctx);

    const [, opts] = vi.mocked(calculateBundlePrice).mock.calls[0];
    // BUNDLE_A excluded from userCoupons, BUNDLE_B added as card.vouchers
    // merged = ['USER1', 'BUNDLE_B']
    expect(opts.vouchers).toEqual(expect.arrayContaining(['USER1', 'BUNDLE_B']));
    expect(opts.vouchers).not.toContain('BUNDLE_A');
  });

  it('passes undefined vouchers when no coupons and no card vouchers', async () => {
    mockStores([]);
    vi.mocked(calculateBundlePrice).mockResolvedValue(makeApiResult() as any);
    const card = makeCard({ vouchers: [] });

    await fetchAndUpdateBundlePrice(card, makeCtx());

    const [, opts] = vi.mocked(calculateBundlePrice).mock.calls[0];
    expect(opts.vouchers).toBeUndefined();
  });

  it('skips stale results when effective items changed while fetch was in-flight', async () => {
    mockStores();
    let resolveFetch!: (v: any) => void;
    vi.mocked(calculateBundlePrice).mockReturnValue(
      new Promise(r => { resolveFetch = r; }) as any,
    );

    const card = makeCard({
      slots: [makeSlot({ activePackageId: 1, quantity: 1 })],
    });

    const promise = fetchAndUpdateBundlePrice(card, makeCtx());

    // Mutate slots while fetch is in-flight → effective items changed
    card.slots[0].activePackageId = 2;

    resolveFetch(makeApiResult({ total: new Decimal(99) }));
    await promise;

    // bundlePrice must NOT be updated with stale result
    expect(card.bundlePrice).toBeNull();
  });

  it('does not skip result when effective items are unchanged', async () => {
    mockStores();
    vi.mocked(calculateBundlePrice).mockResolvedValue(
      makeApiResult({ total: new Decimal(20) }) as any,
    );
    const card = makeCard({ slots: [makeSlot({ activePackageId: 1, quantity: 1 })] });

    await fetchAndUpdateBundlePrice(card, makeCtx());

    expect(card.bundlePrice).not.toBeNull();
    expect(card.bundlePrice!.price.toNumber()).toBe(20);
  });
});
