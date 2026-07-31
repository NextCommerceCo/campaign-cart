import { describe, it, expect } from 'vitest';
import { PriceCalculator } from '../price-calculator';

describe('calculateSavings', () => {
  it('returns the positive difference', () => {
    expect(PriceCalculator.calculateSavings(100, 60)).toBe(40);
  });
  it('never goes negative when the current price is higher', () => {
    expect(PriceCalculator.calculateSavings(60, 100)).toBe(0);
  });
  it('is zero when prices are equal', () => {
    expect(PriceCalculator.calculateSavings(50, 50)).toBe(0);
  });
});

describe('calculateSavingsPercentage', () => {
  it('rounds the percentage saved', () => {
    expect(PriceCalculator.calculateSavingsPercentage(100, 60)).toBe(40);
    expect(PriceCalculator.calculateSavingsPercentage(30, 20)).toBe(33); // 33.33 → 33
  });
  it('is zero when there is no saving', () => {
    expect(PriceCalculator.calculateSavingsPercentage(50, 50)).toBe(0);
    expect(PriceCalculator.calculateSavingsPercentage(50, 80)).toBe(0);
  });
  it('is zero when the retail price is non-positive', () => {
    expect(PriceCalculator.calculateSavingsPercentage(0, 0)).toBe(0);
    expect(PriceCalculator.calculateSavingsPercentage(-10, -20)).toBe(0);
  });
});

describe('calculateUnitPrice', () => {
  it('divides total by quantity', () => {
    expect(PriceCalculator.calculateUnitPrice(30, 3)).toBe(10);
  });
  it('guards against divide-by-zero', () => {
    expect(PriceCalculator.calculateUnitPrice(30, 0)).toBe(0);
  });
});

describe('calculateLineTotal', () => {
  it('multiplies unit price by quantity', () => {
    expect(PriceCalculator.calculateLineTotal(9.99, 2)).toBeCloseTo(19.98);
  });
});

describe('calculatePackageMetrics', () => {
  it('derives totals from per-unit price × quantity when no explicit totals', () => {
    const m = PriceCalculator.calculatePackageMetrics({
      price: 10,
      retailPrice: 20,
      quantity: 3,
    });
    expect(m.totalPrice).toBe(30);
    expect(m.totalRetailPrice).toBe(60);
    expect(m.totalSavings).toBe(30);
    expect(m.totalSavingsPercentage).toBe(50);
    expect(m.unitPrice).toBe(10);
    expect(m.unitRetailPrice).toBe(20);
    expect(m.unitSavings).toBe(10);
    expect(m.hasSavings).toBe(true);
  });

  it('prefers explicit priceTotal / retailPriceTotal when provided', () => {
    const m = PriceCalculator.calculatePackageMetrics({
      price: 10,
      retailPrice: 20,
      quantity: 3,
      priceTotal: 25,
      retailPriceTotal: 60,
    });
    expect(m.totalPrice).toBe(25);
    expect(m.unitPrice).toBeCloseTo(25 / 3);
    expect(m.totalSavings).toBe(35);
  });

  it('reports no savings when there is no retail price', () => {
    const m = PriceCalculator.calculatePackageMetrics({
      price: 10,
      retailPrice: 0,
      quantity: 1,
    });
    expect(m.hasSavings).toBe(false);
    expect(m.totalSavings).toBe(0);
    expect(m.totalSavingsPercentage).toBe(0);
  });
});
