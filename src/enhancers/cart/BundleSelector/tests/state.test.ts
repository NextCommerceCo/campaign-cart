import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  makePackageState,
  getEffectiveItems,
  parseVouchers,
  extractNestedVariantTemplates,
} from '../BundleSelectorEnhancer.state';
import type { Package } from '@/types/campaign';
import type { BundleCard, BundleSlot } from '../BundleSelectorEnhancer.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePkg(overrides: Partial<Package> = {}): Package {
  return {
    ref_id: 1,
    external_id: 1,
    name: 'Widget',
    price: '10.00',
    price_total: '10.00',
    qty: 1,
    image: 'img.jpg',
    is_recurring: false,
    ...overrides,
  };
}

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

function makeCard(slots: BundleSlot[]): BundleCard {
  return {
    element: document.createElement('div'),
    bundleId: 'bundle-a',
    name: 'Bundle A',
    items: [],
    slots,
    isPreSelected: false,
    vouchers: [],
    packageStates: new Map(),
    bundlePrice: null,
    slotVarsCache: new Map(),
  };
}

const mockLogger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

// ─── makePackageState ─────────────────────────────────────────────────────────

describe('makePackageState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps packageId, name, image, productName, variantName', () => {
    const state = makePackageState(
      makePkg({
        ref_id: 42,
        name: 'Gadget',
        image: 'gadget.png',
        product_name: 'Gadget Pro',
        product_variant_name: 'Red',
      }),
    );

    expect(state.packageId).toBe(42);
    expect(state.name).toBe('Gadget');
    expect(state.image).toBe('gadget.png');
    expect(state.productName).toBe('Gadget Pro');
    expect(state.variantName).toBe('Red');
  });

  it('maps recurring fields', () => {
    const state = makePackageState(
      makePkg({
        is_recurring: true,
        interval: 'month',
        interval_count: 3,
        price_recurring_total: '9.99',
      }),
    );

    expect(state.isRecurring).toBe(true);
    expect(state.interval).toBe('month');
    expect(state.intervalCount).toBe(3);
    expect(state.recurringPrice.toNumber()).toBe(9.99);
    expect(state.originalRecurringPrice.toNumber()).toBe(9.99);
  });

  it('sets unitPrice, originalUnitPrice, price, originalPrice all equal to price_total', () => {
    const state = makePackageState(makePkg({ price_total: '19.99' }));

    expect(state.unitPrice.toNumber()).toBe(19.99);
    expect(state.originalUnitPrice.toNumber()).toBe(19.99);
    expect(state.price.toNumber()).toBe(19.99);
    expect(state.originalPrice.toNumber()).toBe(19.99);
  });

  it('starts with zero discount — hasDiscount false, amounts zero', () => {
    const state = makePackageState(makePkg());

    expect(state.hasDiscount).toBe(false);
    expect(state.discountAmount.toNumber()).toBe(0);
    expect(state.discountPercentage.toNumber()).toBe(0);
  });

  it('uses empty strings for missing optional string fields', () => {
    const state = makePackageState(
      makePkg({ name: undefined as unknown as string, image: undefined as unknown as string }),
    );

    expect(state.name).toBe('');
    expect(state.image).toBe('');
  });

  it('defaults optional nullable fields to null', () => {
    const state = makePackageState(
      makePkg({ product_sku: undefined, interval: undefined, interval_count: undefined }),
    );

    expect(state.sku).toBeNull();
    expect(state.interval).toBeNull();
    expect(state.intervalCount).toBeNull();
  });

  it('defaults to 0 when price_total is falsy', () => {
    const state = makePackageState(makePkg({ price_total: '' }));

    expect(state.unitPrice.toNumber()).toBe(0);
    expect(state.originalUnitPrice.toNumber()).toBe(0);
  });

  it('defaults recurring price to 0 when price_recurring_total is absent', () => {
    const state = makePackageState(makePkg({ price_recurring_total: undefined }));

    expect(state.recurringPrice.toNumber()).toBe(0);
    expect(state.originalRecurringPrice.toNumber()).toBe(0);
  });

  it('maps sku correctly when present', () => {
    const state = makePackageState(makePkg({ product_sku: 'SKU-99' }));
    expect(state.sku).toBe('SKU-99');
  });
});

// ─── getEffectiveItems ────────────────────────────────────────────────────────

describe('getEffectiveItems', () => {
  it('single slot → single item with matching packageId and quantity', () => {
    const card = makeCard([makeSlot({ activePackageId: 5, quantity: 1 })]);

    const items = getEffectiveItems(card);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ packageId: 5, quantity: 1 });
  });

  it('two slots with the same packageId → one item with summed quantity', () => {
    const card = makeCard([
      makeSlot({ slotIndex: 0, activePackageId: 3, quantity: 1 }),
      makeSlot({ slotIndex: 1, activePackageId: 3, quantity: 1 }),
    ]);

    const items = getEffectiveItems(card);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ packageId: 3, quantity: 2 });
  });

  it('two slots with different packageIds → two separate items', () => {
    const card = makeCard([
      makeSlot({ slotIndex: 0, activePackageId: 1, quantity: 1 }),
      makeSlot({ slotIndex: 1, activePackageId: 2, quantity: 1 }),
    ]);

    const items = getEffectiveItems(card);

    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        { packageId: 1, quantity: 1 },
        { packageId: 2, quantity: 1 },
      ]),
    );
  });

  it('configurable slots expanded into 3 units → quantity 3 for same packageId', () => {
    const card = makeCard([
      makeSlot({ slotIndex: 0, unitIndex: 0, activePackageId: 10, quantity: 1, configurable: true }),
      makeSlot({ slotIndex: 1, unitIndex: 1, activePackageId: 10, quantity: 1, configurable: true }),
      makeSlot({ slotIndex: 2, unitIndex: 2, activePackageId: 10, quantity: 1, configurable: true }),
    ]);

    const items = getEffectiveItems(card);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ packageId: 10, quantity: 3 });
  });

  it('configurable slots with variant changes → correct grouping after activePackageId update', () => {
    // Slot 0 changed to package 11 via variant selection
    const card = makeCard([
      makeSlot({ slotIndex: 0, activePackageId: 11, quantity: 1, configurable: true }),
      makeSlot({ slotIndex: 1, activePackageId: 10, quantity: 1, configurable: true }),
      makeSlot({ slotIndex: 2, activePackageId: 10, quantity: 1, configurable: true }),
    ]);

    const items = getEffectiveItems(card);

    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        { packageId: 11, quantity: 1 },
        { packageId: 10, quantity: 2 },
      ]),
    );
  });

  it('returns empty array for a card with no slots', () => {
    const card = makeCard([]);
    expect(getEffectiveItems(card)).toEqual([]);
  });

  it('non-configurable slot with quantity > 1 → item with that quantity', () => {
    const card = makeCard([makeSlot({ activePackageId: 7, quantity: 3 })]);

    const items = getEffectiveItems(card);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ packageId: 7, quantity: 3 });
  });

  // ─── Bundle-level quantity multiplier ───────────────────────────────────────

  it('applies bundleQuantity multiplier to a single slot', () => {
    const card = makeCard([makeSlot({ activePackageId: 5, quantity: 1 })]);
    (card as any).bundleQuantity = 4;

    const items = getEffectiveItems(card);

    expect(items).toEqual([{ packageId: 5, quantity: 4 }]);
  });

  it('multiplies bundleQuantity after slot aggregation (configurable slots share packageId)', () => {
    const card = makeCard([
      makeSlot({ slotIndex: 0, activePackageId: 9, quantity: 1, configurable: true }),
      makeSlot({ slotIndex: 1, activePackageId: 9, quantity: 1, configurable: true }),
    ]);
    (card as any).bundleQuantity = 3;

    const items = getEffectiveItems(card);

    // Per-slot aggregation collapses to {9,2}; multiplier then gives {9,6}.
    expect(items).toEqual([{ packageId: 9, quantity: 6 }]);
  });

  it('multiplies bundleQuantity across a mixed bundle', () => {
    const card = makeCard([
      makeSlot({ slotIndex: 0, activePackageId: 1, quantity: 1 }),
      makeSlot({ slotIndex: 1, activePackageId: 2, quantity: 2 }),
    ]);
    (card as any).bundleQuantity = 5;

    const items = getEffectiveItems(card);

    expect(items).toEqual([
      { packageId: 1, quantity: 5 },
      { packageId: 2, quantity: 10 },
    ]);
  });

  it('is an identity when bundleQuantity is 1 (regression)', () => {
    const card = makeCard([
      makeSlot({ slotIndex: 0, activePackageId: 1, quantity: 2 }),
      makeSlot({ slotIndex: 1, activePackageId: 2, quantity: 1 }),
    ]);
    (card as any).bundleQuantity = 1;

    const items = getEffectiveItems(card);

    expect(items).toEqual([
      { packageId: 1, quantity: 2 },
      { packageId: 2, quantity: 1 },
    ]);
  });

  it('falls back to multiplier=1 when bundleQuantity is undefined/0 (safety net)', () => {
    const card = makeCard([makeSlot({ activePackageId: 4, quantity: 2 })]);
    // Not setting bundleQuantity at all — simulates older code paths.

    const items = getEffectiveItems(card);

    expect(items).toEqual([{ packageId: 4, quantity: 2 }]);
  });
});

// ─── parseVouchers ────────────────────────────────────────────────────────────

describe('parseVouchers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array for null input', () => {
    expect(parseVouchers(null, mockLogger as any)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseVouchers('', mockLogger as any)).toEqual([]);
  });

  it('parses comma-separated string into trimmed codes', () => {
    expect(parseVouchers('CODE1,CODE2,CODE3', mockLogger as any)).toEqual([
      'CODE1',
      'CODE2',
      'CODE3',
    ]);
  });

  it('trims whitespace around comma-separated codes', () => {
    expect(parseVouchers(' CODE1 , CODE2 ', mockLogger as any)).toEqual(['CODE1', 'CODE2']);
  });

  it('filters out empty strings from comma-separated input', () => {
    expect(parseVouchers('CODE1,,CODE2', mockLogger as any)).toEqual(['CODE1', 'CODE2']);
  });

  it('parses JSON array of strings', () => {
    expect(parseVouchers('["SUMMER","FALL"]', mockLogger as any)).toEqual(['SUMMER', 'FALL']);
  });

  it('filters non-string values from JSON array', () => {
    expect(parseVouchers('["CODE1", 42, null, "CODE2"]', mockLogger as any)).toEqual([
      'CODE1',
      'CODE2',
    ]);
  });

  it('logs warn and returns empty array for invalid JSON', () => {
    const result = parseVouchers('[invalid json', mockLogger as any);

    expect(result).toEqual([]);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Invalid JSON in data-next-bundle-vouchers',
      '[invalid json',
    );
  });

  it('returns empty array when JSON array is empty', () => {
    expect(parseVouchers('[]', mockLogger as any)).toEqual([]);
  });

  it('single code without comma → single-element array', () => {
    expect(parseVouchers('SINGLE', mockLogger as any)).toEqual(['SINGLE']);
  });
});

// ─── extractNestedVariantTemplates ────────────────────────────────────────────

describe('extractNestedVariantTemplates', () => {
  it('pulls variant-selector and variant-option templates out of a slot template', () => {
    const slotTemplate = `
      <div class="slot">
        <div data-next-variant-selectors>
          <template>
            <div class="group">
              <span>{attr.name}</span>
              <div data-next-variant-options>
                <template>
                  <button>{option.value}</button>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
    `;

    const { slot, variantSelector, variantOption } = extractNestedVariantTemplates(slotTemplate);

    expect(variantOption).toContain('<button>{option.value}</button>');
    expect(variantSelector).toContain('{attr.name}');
    expect(variantSelector).toContain('data-next-variant-options');
    expect(variantSelector).not.toContain('<template>');
    expect(slot).toContain('data-next-variant-selectors');
    expect(slot).not.toContain('<template>');
  });

  it('returns empty variant strings when slot template has no nested templates', () => {
    const slotTemplate = '<div class="slot">plain</div>';
    const { slot, variantSelector, variantOption } = extractNestedVariantTemplates(slotTemplate);

    expect(variantSelector).toBe('');
    expect(variantOption).toBe('');
    expect(slot.trim()).toBe('<div class="slot">plain</div>');
  });

  it('extracts only variant-selector when no option template is nested', () => {
    const slotTemplate = `
      <div data-next-variant-selectors>
        <template><div>{attr.name}</div></template>
      </div>
    `;

    const { variantSelector, variantOption } = extractNestedVariantTemplates(slotTemplate);

    expect(variantSelector).toContain('{attr.name}');
    expect(variantOption).toBe('');
  });
});
