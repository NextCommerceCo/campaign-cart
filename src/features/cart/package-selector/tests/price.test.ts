import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { fetchAndUpdatePrice } from '../package-selector.price';
import type { SelectorItem } from '@/types/global';
import { useCampaignStore } from '@/state/campaign';
import { useCheckoutStore } from '@/state/checkout';
import { calculateBundlePrice } from '@/state/cart/cart-calculator';

vi.mock('@/state/campaign', () => ({ useCampaignStore: { getState: vi.fn() } }));
vi.mock('@/state/checkout', () => ({ useCheckoutStore: { getState: vi.fn() } }));
vi.mock('@/state/cart/cart-calculator', () => ({ calculateBundlePrice: vi.fn() }));
vi.mock('@/core/currency-formatter', () => ({
  formatCurrency: (n: number) => `$${n}`,
  formatPercentage: (n: number) => `${Math.round(n)}%`,
}));

const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any;

function makeItem(): SelectorItem {
  const container = document.createElement('div');
  container.setAttribute('data-next-selector-id', 'main');
  const card = document.createElement('div');
  card.innerHTML = `
    <span data-next-package-price="total"></span>
    <span data-next-package-price="subtotal"></span>
    <span data-next-package-price="compare"></span>
    <span data-next-package-price="savings"></span>
    <span data-next-package-price="savingsPercentage"></span>
  `;
  container.appendChild(card);
  return { element: card, packageId: 2, quantity: 1 } as unknown as SelectorItem;
}

function slot(item: SelectorItem, field: string): string {
  return item.element.querySelector(`[data-next-package-price="${field}"]`)!.textContent ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  (useCampaignStore.getState as any).mockReturnValue({
    currency: 'USD',
    packages: [{ ref_id: 2, price_retail: '20' }],
  });
  (useCheckoutStore.getState as any).mockReturnValue({ vouchers: [] });
  (calculateBundlePrice as any).mockResolvedValue({
    subtotal: new Decimal('15'),
    total: new Decimal('16'),
  });
});

describe('fetchAndUpdatePrice', () => {
  it('fills every price slot from the calculated + retail figures', async () => {
    const item = makeItem();
    await fetchAndUpdatePrice(item, false, logger);

    expect(slot(item, 'total')).toBe('$16');
    expect(slot(item, 'subtotal')).toBe('$15');
    expect(slot(item, 'compare')).toBe('$20');
    expect(slot(item, 'savings')).toBe('$5');
    expect(slot(item, 'savingsPercentage')).toBe('25%');
  });

  it('stores raw numeric values as data attributes', async () => {
    const item = makeItem();
    await fetchAndUpdatePrice(item, false, logger);
    expect(item.element.getAttribute('data-package-price-total')).toBe('16');
    expect(item.element.getAttribute('data-package-price-compare')).toBe('20');
    expect(item.element.getAttribute('data-package-price-savings')).toBe('5');
    expect(item.element.getAttribute('data-package-price-savings-pct')).toBe('25');
  });

  it('excludes shipping when includeShipping is false', async () => {
    const item = makeItem();
    await fetchAndUpdatePrice(item, false, logger);
    expect(calculateBundlePrice).toHaveBeenCalledWith(
      [{ packageId: 2, quantity: 1 }],
      expect.objectContaining({ currency: 'USD', exclude_shipping: true }),
    );
  });

  it('dispatches selector:price-updated and clears the loading flag', async () => {
    const item = makeItem();
    const seen: any[] = [];
    item.element.addEventListener('selector:price-updated', (e: any) => seen.push(e.detail));
    await fetchAndUpdatePrice(item, false, logger);
    expect(seen[0]).toMatchObject({ selectorId: 'main', packageId: 2 });
    expect(item.element.getAttribute('data-next-loading')).toBe('false');
    expect(item.element.classList.contains('next-loading')).toBe(false);
  });

  it('warns and clears loading when the price call fails', async () => {
    (calculateBundlePrice as any).mockRejectedValue(new Error('boom'));
    const item = makeItem();
    await fetchAndUpdatePrice(item, false, logger);
    expect(logger.warn).toHaveBeenCalled();
    expect(item.element.classList.contains('next-loading')).toBe(false);
    expect(slot(item, 'total')).toBe('');
  });
});
