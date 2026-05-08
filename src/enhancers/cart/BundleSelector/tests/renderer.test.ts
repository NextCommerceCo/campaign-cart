import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  renderBundleTemplate,
  updateCardDisplayElements,
  isVariantValueAvailable,
} from '../BundleSelectorEnhancer.renderer';
import type { BundleCard, BundlePriceSummary } from '../BundleSelectorEnhancer.types';

vi.mock('@/stores/campaignStore', () => ({
  useCampaignStore: { getState: vi.fn(() => ({ packages: [], currency: 'USD' })) },
}));
vi.mock('@/stores/configStore', () => ({
  useConfigStore: {
    getState: vi.fn(() => ({
      selectedCurrency: 'USD',
      detectedCurrency: 'USD',
      apiKey: 'test',
    })),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockLogger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeBundlePrice(overrides: Partial<BundlePriceSummary> = {}): BundlePriceSummary {
  return {
    price: new Decimal(30),
    originalPrice: new Decimal(40),
    discountAmount: new Decimal(10),
    discountPercentage: new Decimal(25),
    unitPrice: new Decimal(10),
    originalUnitPrice: new Decimal(13.33),
    quantity: 3,
    hasDiscount: true,
    currency: 'USD',
    ...overrides,
  };
}

function makeCard(overrides: Partial<BundleCard> = {}): BundleCard {
  const element = document.createElement('div');
  element.setAttribute('data-next-selected', 'false');
  return {
    element,
    bundleId: 'bundle-a',
    name: 'Bundle A',
    items: [],
    slots: [],
    isPreSelected: false,
    vouchers: [],
    packageStates: new Map(),
    bundlePrice: null,
    slotVarsCache: new Map(),
    ...overrides,
  };
}

// ─── renderBundleTemplate ─────────────────────────────────────────────────────

describe('renderBundleTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('substitutes bundle.id, bundle.label and other top-level fields', () => {
    const template =
      '<div data-next-bundle-card>{bundle.id} — {bundle.label}</div>';
    const bundle = { id: 'trio', items: [], label: 'Triple Pack' };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('trio — Triple Pack');
  });

  it('sets data-next-bundle-id and data-next-bundle-items on card element', () => {
    const items = [{ packageId: 1, quantity: 2 }];
    const template = '<div data-next-bundle-card></div>';
    const bundle = { id: 'duo', items };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    expect(el!.getAttribute('data-next-bundle-id')).toBe('duo');
    expect(el!.getAttribute('data-next-bundle-items')).toBe(JSON.stringify(items));
  });

  it('sets data-next-selected="true" when bundle.selected is true', () => {
    const template = '<div data-next-bundle-card></div>';
    const bundle = { id: 'solo', items: [], selected: true };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    expect(el!.getAttribute('data-next-selected')).toBe('true');
  });

  it('does not set data-next-selected when bundle.selected is falsy', () => {
    const template = '<div data-next-bundle-card></div>';
    const bundle = { id: 'solo', items: [] };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    expect(el!.hasAttribute('data-next-selected')).toBe(false);
  });

  it('sets data-next-bundle-vouchers when vouchers provided', () => {
    const template = '<div data-next-bundle-card></div>';
    const bundle = { id: 'x', items: [], vouchers: ['CODE1', 'CODE2'] };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    expect(el!.getAttribute('data-next-bundle-vouchers')).toBe(
      JSON.stringify(['CODE1', 'CODE2']),
    );
  });

  it('does not set data-next-bundle-vouchers when vouchers empty or absent', () => {
    const template = '<div data-next-bundle-card></div>';
    const bundle = { id: 'x', items: [], vouchers: [] };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    expect(el!.hasAttribute('data-next-bundle-vouchers')).toBe(false);
  });

  it('computes bundle.itemCount excluding noSlot items', () => {
    const template = '<div>{bundle.itemCount}</div>';
    const bundle = {
      id: 'x',
      items: [
        { packageId: 1, quantity: 1 },
        { packageId: 2, quantity: 1, noSlot: true },
      ],
    };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    // Only 1 visible item
    expect(el!.textContent).toBe('1');
  });

  it('computes bundle.totalQuantity excluding noSlot items', () => {
    const template = '<div>{bundle.totalQuantity}</div>';
    const bundle = {
      id: 'x',
      items: [
        { packageId: 1, quantity: 3 },
        { packageId: 2, quantity: 2, noSlot: true },
      ],
    };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    // 3, not 5 — noSlot excluded
    expect(el!.textContent).toBe('3');
  });

  it('warns and returns null when template produces no root element', () => {
    const template = '';
    const bundle = { id: 'empty', items: [] };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    expect(el).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('finds [data-next-bundle-card] anywhere in template — not just root', () => {
    const template =
      '<section><article data-next-bundle-card>{bundle.id}</article></section>';
    const bundle = { id: 'nested', items: [] };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    expect(el!.getAttribute('data-next-bundle-id')).toBe('nested');
  });

  it('replaces unknown template vars with empty string', () => {
    const template = '<div data-next-bundle-card>{bundle.unknown}</div>';
    const bundle = { id: 'x', items: [] };

    const el = renderBundleTemplate(template, bundle, mockLogger as any);

    expect(el!.textContent).toBe('');
  });
});

// ─── updateCardDisplayElements ────────────────────────────────────────────────

describe('updateCardDisplayElements', () => {
  beforeEach(() => vi.clearAllMocks());

  function addDisplay(card: BundleCard, field: string): HTMLElement {
    const el = document.createElement('span');
    el.setAttribute('data-next-bundle-display', field);
    card.element.appendChild(el);
    return el;
  }

  it('sets textContent for price / total fields', () => {
    const card = makeCard();
    const el = addDisplay(card, 'price');
    const bp = makeBundlePrice({ price: new Decimal(29.99) });

    updateCardDisplayElements(card, bp);

    expect(el.textContent).toBeTruthy(); // formatted currency string
  });

  it('"compare" and "originalPrice" show originalPrice', () => {
    const card = makeCard();
    const compareEl = addDisplay(card, 'compare');
    const origEl = addDisplay(card, 'originalPrice');
    const bp = makeBundlePrice({ originalPrice: new Decimal(49.99) });

    updateCardDisplayElements(card, bp);

    expect(compareEl.textContent).toBe(origEl.textContent);
  });

  it('"savings" and "discountAmount" show discountAmount', () => {
    const card = makeCard();
    const savingsEl = addDisplay(card, 'savings');
    const discountEl = addDisplay(card, 'discountAmount');
    const bp = makeBundlePrice({ discountAmount: new Decimal(10) });

    updateCardDisplayElements(card, bp);

    expect(savingsEl.textContent).toBe(discountEl.textContent);
  });

  it('"savingsPercentage" and "discountPercentage" show discountPercentage', () => {
    const card = makeCard();
    const el1 = addDisplay(card, 'savingsPercentage');
    const el2 = addDisplay(card, 'discountPercentage');
    const bp = makeBundlePrice({ discountPercentage: new Decimal(25) });

    updateCardDisplayElements(card, bp);

    expect(el1.textContent).toBe(el2.textContent);
  });

  it('"hasDiscount" / "hasSavings" — shown when hasDiscount=true', () => {
    const card = makeCard();
    const el = addDisplay(card, 'hasDiscount');
    const bp = makeBundlePrice({ hasDiscount: true });

    updateCardDisplayElements(card, bp);

    expect(el.style.display).not.toBe('none');
  });

  it('"hasDiscount" — hidden when hasDiscount=false', () => {
    const card = makeCard();
    const el = addDisplay(card, 'hasDiscount');
    const bp = makeBundlePrice({ hasDiscount: false });

    updateCardDisplayElements(card, bp);

    expect(el.style.display).toBe('none');
  });

  it('"isSelected" — shown when data-next-selected="true"', () => {
    const card = makeCard();
    card.element.setAttribute('data-next-selected', 'true');
    const el = addDisplay(card, 'isSelected');
    const bp = makeBundlePrice();

    updateCardDisplayElements(card, bp);

    expect(el.style.display).not.toBe('none');
  });

  it('"isSelected" — hidden when data-next-selected="false"', () => {
    const card = makeCard();
    card.element.setAttribute('data-next-selected', 'false');
    const el = addDisplay(card, 'isSelected');
    const bp = makeBundlePrice();

    updateCardDisplayElements(card, bp);

    expect(el.style.display).toBe('none');
  });

  it('"name" field sets textContent to card.name', () => {
    const card = makeCard({ name: 'Starter Pack' });
    const el = addDisplay(card, 'name');

    updateCardDisplayElements(card, makeBundlePrice());

    expect(el.textContent).toBe('Starter Pack');
  });

  it('also updates legacy [data-next-bundle-price] elements', () => {
    const card = makeCard();
    const el = document.createElement('span');
    el.setAttribute('data-next-bundle-price', 'total');
    card.element.appendChild(el);
    const bp = makeBundlePrice({ price: new Decimal(15) });

    updateCardDisplayElements(card, bp);

    expect(el.textContent).toBeTruthy();
  });

  it('fires bundle:price-updated event on card.element with bundleId detail', () => {
    const card = makeCard({ bundleId: 'promo' });
    // data-next-bundle-id used in event detail
    card.element.setAttribute('data-next-bundle-id', 'promo');
    const handler = vi.fn();
    card.element.addEventListener('bundle:price-updated', handler);

    updateCardDisplayElements(card, makeBundlePrice());

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail.selectorId).toBe('promo');
  });
});

// ─── isVariantValueAvailable ──────────────────────────────────────────────────

describe('isVariantValueAvailable', () => {
  function makePkg(
    refId: number,
    attrs: Array<{ code: string; value: string }>,
    availability = 'available',
  ) {
    return {
      ref_id: refId,
      product_id: 1,
      product_purchase_availability: availability,
      product_variant_attribute_values: attrs,
    };
  }

  it('returns true when pkg has the value and all other selected attrs match', () => {
    const pkgs = [
      makePkg(1, [{ code: 'color', value: 'red' }, { code: 'size', value: 'M' }]),
    ];
    // Checking color=red with size=M already selected
    expect(isVariantValueAvailable('red', 'color', pkgs as any, { size: 'M' })).toBe(true);
  });

  it('returns false when no pkg has the attr value', () => {
    const pkgs = [
      makePkg(1, [{ code: 'color', value: 'blue' }]),
    ];
    expect(isVariantValueAvailable('red', 'color', pkgs as any, {})).toBe(false);
  });

  it('returns false when pkg is marked unavailable', () => {
    const pkgs = [
      makePkg(1, [{ code: 'color', value: 'red' }], 'unavailable'),
    ];
    expect(isVariantValueAvailable('red', 'color', pkgs as any, {})).toBe(false);
  });

  it('returns false when other selected attrs do not match', () => {
    const pkgs = [
      // Only has red in size XL, not red in size M
      makePkg(1, [{ code: 'color', value: 'red' }, { code: 'size', value: 'XL' }]),
    ];
    expect(isVariantValueAvailable('red', 'color', pkgs as any, { size: 'M' })).toBe(false);
  });

  it('returns true with no other selected attrs (unconstrained check)', () => {
    const pkgs = [
      makePkg(1, [{ code: 'color', value: 'red' }]),
    ];
    expect(isVariantValueAvailable('red', 'color', pkgs as any, {})).toBe(true);
  });

  it('ignores the currently-checked attribute code when validating other attrs', () => {
    // Checking if size=L is available — should not require size=L itself in existing selection
    const pkgs = [
      makePkg(1, [{ code: 'color', value: 'red' }, { code: 'size', value: 'L' }]),
    ];
    // allSelectedAttrs includes size=XL (checking if size=L is available given color=red)
    // The check should filter out 'size' from the constraint since that's what we're testing
    expect(isVariantValueAvailable('L', 'size', pkgs as any, { color: 'red', size: 'XL' })).toBe(true);
  });

  it('returns true when the first matching pkg is available even if others are not', () => {
    const pkgs = [
      makePkg(1, [{ code: 'color', value: 'red' }], 'unavailable'),
      makePkg(2, [{ code: 'color', value: 'red' }], 'available'),
    ];
    expect(isVariantValueAvailable('red', 'color', pkgs as any, {})).toBe(true);
  });
});
