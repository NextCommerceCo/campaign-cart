import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { buildSlotVars } from '../BundleSelectorEnhancer.renderer';
import { formatCurrency, formatPercentage } from '@/utils/currencyFormatter';
import type { BundlePackageState, BundleSlot } from '../BundleSelectorEnhancer.types';

vi.mock('@/stores/campaignStore', () => ({
  useCampaignStore: { getState: vi.fn(() => ({ currency: 'USD' })) },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSlot(overrides?: Partial<BundleSlot>): BundleSlot {
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

function makePkgState(overrides?: Partial<BundlePackageState>): BundlePackageState {
  const unitPrice = new Decimal(10);
  const originalUnitPrice = new Decimal(10);
  return {
    packageId: 1,
    name: 'Test Product',
    image: '',
    productName: 'Test Product',
    variantName: '',
    sku: null,
    isRecurring: false,
    interval: null,
    intervalCount: null,
    recurringPrice: new Decimal(0),
    originalRecurringPrice: new Decimal(0),
    unitPrice,
    originalUnitPrice,
    discountAmount: new Decimal(0),
    discountPercentage: new Decimal(0),
    originalPrice: originalUnitPrice,
    price: unitPrice,
    hasDiscount: false,
    currency: 'USD',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('buildSlotVars — slot price correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('single slot qty 1: item.price equals unitPrice', () => {
    const slot = makeSlot({ quantity: 1 });
    const pkg = makePkgState({ unitPrice: new Decimal(10) });

    const vars = buildSlotVars(slot, pkg);

    expect(vars['item.price']).toBe(formatCurrency(10));
    expect(vars['item.unitPrice']).toBe(formatCurrency(10));
  });

  it('single slot qty 2 (non-configurable): item.price is unitPrice × 2, unitPrice stays per-unit', () => {
    const slot = makeSlot({ quantity: 2 });
    const pkg = makePkgState({
      unitPrice: new Decimal(10),
      // price = line.total from API (aggregate for all units)
      price: new Decimal(20),
    });

    const vars = buildSlotVars(slot, pkg);

    expect(vars['item.price']).toBe(formatCurrency(20));
    expect(vars['item.unitPrice']).toBe(formatCurrency(10));
  });

  it('3 configurable slots of same package: each slot shows per-unit price, not aggregate', () => {
    // Simulates a 3-pack where API returns line.total = 30 (all units combined)
    const pkg = makePkgState({
      unitPrice: new Decimal(10),
      price: new Decimal(30), // aggregate from line.total
    });

    const slot0 = makeSlot({ slotIndex: 0, unitIndex: 0, quantity: 1 });
    const slot1 = makeSlot({ slotIndex: 1, unitIndex: 1, quantity: 1 });
    const slot2 = makeSlot({ slotIndex: 2, unitIndex: 2, quantity: 1 });

    const vars0 = buildSlotVars(slot0, pkg);
    const vars1 = buildSlotVars(slot1, pkg);
    const vars2 = buildSlotVars(slot2, pkg);

    // Each slot must show $10, not the $30 aggregate
    expect(vars0['item.price']).toBe(formatCurrency(10));
    expect(vars1['item.price']).toBe(formatCurrency(10));
    expect(vars2['item.price']).toBe(formatCurrency(10));

    // Regression guard: must not equal the aggregate
    expect(vars0['item.price']).not.toBe(formatCurrency(30));
  });

  it('with discount: item.discountAmount is (originalUnitPrice − unitPrice) × slot.quantity', () => {
    const slot = makeSlot({ quantity: 2 });
    const pkg = makePkgState({
      unitPrice: new Decimal(8),
      originalUnitPrice: new Decimal(10),
      discountAmount: new Decimal(4), // aggregate from line.total_discount
      discountPercentage: new Decimal(20),
      price: new Decimal(16),
      originalPrice: new Decimal(20),
      hasDiscount: true,
    });

    const vars = buildSlotVars(slot, pkg);

    // slot discount = (10 - 8) × 2 = 4
    expect(vars['item.discountAmount']).toBe(formatCurrency(4));
    expect(vars['item.price']).toBe(formatCurrency(16));
    expect(vars['item.originalPrice']).toBe(formatCurrency(20));
    expect(vars['item.hasDiscount']).toBe('show');
  });

  it('single slot with discount: item.discountAmount is per-slot, not aggregate', () => {
    // 3 units total in bundle; API returns line.total_discount = 6 (all units)
    // This slot only represents 1 unit, so discount should be 2
    const slot = makeSlot({ quantity: 1 });
    const pkg = makePkgState({
      unitPrice: new Decimal(8),
      originalUnitPrice: new Decimal(10),
      discountAmount: new Decimal(6), // aggregate for 3 units
      price: new Decimal(24), // aggregate for 3 units
      originalPrice: new Decimal(30), // aggregate for 3 units
      hasDiscount: true,
    });

    const vars = buildSlotVars(slot, pkg);

    // This slot: (10 - 8) × 1 = 2
    expect(vars['item.discountAmount']).toBe(formatCurrency(2));
    expect(vars['item.price']).toBe(formatCurrency(8));
    expect(vars['item.originalPrice']).toBe(formatCurrency(10));
  });

  it('no discount: item.discountAmount is zero, item.hasDiscount is hide', () => {
    const slot = makeSlot({ quantity: 1 });
    const pkg = makePkgState({
      unitPrice: new Decimal(10),
      originalUnitPrice: new Decimal(10),
      discountAmount: new Decimal(0),
      discountPercentage: new Decimal(0),
      hasDiscount: false,
    });

    const vars = buildSlotVars(slot, pkg);

    expect(vars['item.discountAmount']).toBe(formatCurrency(0));
    expect(vars['item.hasDiscount']).toBe('hide');
  });

  it('item.unitPrice and item.originalUnitPrice are always per-unit regardless of slot.quantity', () => {
    const slot = makeSlot({ quantity: 3 });
    const pkg = makePkgState({
      unitPrice: new Decimal(8),
      originalUnitPrice: new Decimal(10),
      price: new Decimal(24),
      originalPrice: new Decimal(30),
    });

    const vars = buildSlotVars(slot, pkg);

    expect(vars['item.unitPrice']).toBe(formatCurrency(8));
    expect(vars['item.originalUnitPrice']).toBe(formatCurrency(10));
  });

  it('item.discountPercentage is per-unit percentage (not affected by quantity)', () => {
    const slot = makeSlot({ quantity: 3 });
    const pkg = makePkgState({
      discountPercentage: new Decimal(20),
      hasDiscount: true,
    });

    const vars = buildSlotVars(slot, pkg);

    expect(vars['item.discountPercentage']).toBe(formatPercentage(20));
  });
});
