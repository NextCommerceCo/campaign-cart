import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAndUpdateTogglePrice } from '../PackageToggleEnhancer.price';
import type { ToggleCard } from '../PackageToggleEnhancer.types';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';

vi.mock('@/stores/cartStore', () => ({
  useCartStore: { getState: vi.fn() },
}));
vi.mock('@/stores/campaignStore', () => ({
  useCampaignStore: { getState: vi.fn() },
}));
vi.mock('@/stores/checkoutStore', () => ({
  useCheckoutStore: { getState: vi.fn() },
}));
vi.mock('@/utils/calculations/CartCalculator', () => ({
  calculateBundlePrice: vi.fn(),
}));
vi.mock('@/utils/currencyFormatter', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
  formatPercentage: (n: number) => `${n}%`,
}));

import { calculateBundlePrice } from '@/utils/calculations/CartCalculator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCard(packageId: number, quantity = 1): ToggleCard {
  const element = document.createElement('div');
  return {
    element,
    packageId,
    name: '',
    image: '',
    productId: null,
    variantId: null,
    variantName: '',
    productName: '',
    sku: null,
    isPreSelected: false,
    isSelected: false,
    quantity,
    isSyncMode: false,
    syncPackageIds: [],
    isUpsell: false,
    stateContainer: element,
    addText: null,
    removeText: null,
    price: 0,
    unitPrice: 0,
    originalPrice: null,
    originalUnitPrice: null,
    discountAmount: 0,
    discountPercentage: 0,
    hasDiscount: false,
    currency: 'USD',
    isRecurring: false,
    recurringPrice: null,
    originalRecurringPrice: null,
    interval: null,
    intervalCount: null,
    frequency: 'One time',
    discounts: [],
  };
}

function addPriceSlot(card: ToggleCard, type = ''): HTMLElement {
  const slot = document.createElement('span');
  slot.setAttribute('data-next-toggle-price', type);
  card.element.appendChild(slot);
  return slot;
}

function mockCampaignStore(currency = 'USD') {
  vi.mocked(useCampaignStore.getState).mockReturnValue({
    currency,
    data: null,
    packages: [],
  } as any);
}

function mockCartStore(items: { packageId: number; quantity: number }[] = []) {
  vi.mocked(useCartStore.getState).mockReturnValue({
    items,
    summary: null,
  } as any);
}

function mockCheckoutStore(vouchers: string[] = []) {
  vi.mocked(useCheckoutStore.getState).mockReturnValue({ vouchers } as any);
}

const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fetchAndUpdateTogglePrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignStore();
    mockCartStore();
    mockCheckoutStore();
  });

  it('returns early when package is already in cart (uses cart summary instead)', async () => {
    mockCartStore([{ packageId: 101, quantity: 1 }]);
    vi.mocked(useCartStore.getState).mockReturnValue({
      items: [{ packageId: 101, quantity: 1 }],
      summary: null,
    } as any);

    const card = makeCard(101);
    await fetchAndUpdateTogglePrice(card, false, logger);

    expect(calculateBundlePrice).not.toHaveBeenCalled();
  });

  it('renders price from cart summary line when package is already in cart', async () => {
    // The price shown on a selected toggle card must equal the cart line total,
    // not a separate API fetch. This ensures the displayed price is always
    // consistent with what the customer is actually paying.
    vi.mocked(useCartStore.getState).mockReturnValue({
      items: [{ packageId: 101, quantity: 1 }],
      summary: {
        lines: [
          {
            package_id: 101,
            package_price: '12.00',
            original_package_price: '15.00',
            subtotal: '15.00',
            total: '12.00',
            total_discount: '3.00',
          },
        ],
      },
    } as any);

    const card = makeCard(101);
    const priceSlot = addPriceSlot(card);

    await fetchAndUpdateTogglePrice(card, false, logger);

    expect(calculateBundlePrice).not.toHaveBeenCalled();
    expect(priceSlot.textContent).toBe('$12.00');
  });

  it('merges current cart items with this package for price calculation', async () => {
    mockCartStore([{ packageId: 99, quantity: 2 }]);
    vi.mocked(calculateBundlePrice as any).mockResolvedValue({
      summary: {
        lines: [{ package_id: 101, package_price: '5.00', original_package_price: '10.00', subtotal: '10.00', total: '5.00', total_discount: '5.00' }],
      },
    });

    const card = makeCard(101);
    await fetchAndUpdateTogglePrice(card, false, logger);

    expect(calculateBundlePrice).toHaveBeenCalledWith(
      expect.arrayContaining([
        { packageId: 99, quantity: 2 },
        { packageId: 101, quantity: 1 },
      ]),
      expect.anything(),
    );
  });

  it('passes ?upsell=true when upsell flag set', async () => {
    vi.mocked(calculateBundlePrice as any).mockResolvedValue({ summary: null });
    const card = makeCard(101);

    await fetchAndUpdateTogglePrice(card, false, logger, true);

    expect(calculateBundlePrice).toHaveBeenCalledWith(
      [{ packageId: 101, quantity: 1 }],
      expect.objectContaining({ upsell: true }),
    );
  });

  it('includes checkout vouchers in calculation', async () => {
    mockCheckoutStore(['PROMO10']);
    vi.mocked(calculateBundlePrice as any).mockResolvedValue({ summary: null });
    const card = makeCard(101);

    await fetchAndUpdateTogglePrice(card, false, logger);

    expect(calculateBundlePrice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ vouchers: ['PROMO10'] }),
    );
  });

  it('renders price into [data-next-toggle-price] slots on success', async () => {
    vi.mocked(calculateBundlePrice as any).mockResolvedValue({
      summary: {
        lines: [{ package_id: 101, package_price: '8.00', original_package_price: '10.00', subtotal: '10.00', total: '8.00', total_discount: '2.00' }],
      },
    });
    const card = makeCard(101);
    const totalSlot = addPriceSlot(card);

    await fetchAndUpdateTogglePrice(card, false, logger);

    expect(totalSlot.textContent).toBe('$8.00');
  });

  it('sets next-loading class during fetch and removes it after', async () => {
    let resolvePrice!: () => void;
    vi.mocked(calculateBundlePrice as any).mockReturnValue(
      new Promise<void>(res => { resolvePrice = res; }).then(() => ({ summary: null })),
    );
    const card = makeCard(101);

    const fetchPromise = fetchAndUpdateTogglePrice(card, false, logger);
    expect(card.element.classList.contains('next-loading')).toBe(true);

    resolvePrice();
    await fetchPromise;
    expect(card.element.classList.contains('next-loading')).toBe(false);
  });

  it('clears loading and logs warn on fetch failure', async () => {
    vi.mocked(calculateBundlePrice as any).mockRejectedValue(new Error('timeout'));
    const card = makeCard(101);

    await fetchAndUpdateTogglePrice(card, false, logger);

    expect(logger.warn).toHaveBeenCalled();
    expect(card.element.classList.contains('next-loading')).toBe(false);
  });

  it('passes exclude_shipping: true when includeShipping is false', async () => {
    vi.mocked(calculateBundlePrice as any).mockResolvedValue({ summary: null });
    const card = makeCard(101);

    await fetchAndUpdateTogglePrice(card, false, logger);

    expect(calculateBundlePrice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ exclude_shipping: true }),
    );
  });

  it('passes exclude_shipping: false when includeShipping is true', async () => {
    vi.mocked(calculateBundlePrice as any).mockResolvedValue({ summary: null });
    const card = makeCard(101);

    await fetchAndUpdateTogglePrice(card, true, logger);

    expect(calculateBundlePrice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ exclude_shipping: false }),
    );
  });
});
