import { describe, it, expect } from 'vitest';
import { resolveOrderTaxBasis } from '@/utils/analytics/taxBasis';

// Detects whether displayed prices include tax, by matching each line's
// PRE-discount incl/excl price to the campaign catalog price.

const packages = [{ ref_id: 3, price: '50.00' }];

const line = (over: Record<string, unknown> = {}) => ({
  package: 3,
  quantity: 2,
  // Tax-exclusive defaults: catalog 50 → excl matches, incl is higher.
  price_excl_tax_excl_discounts: '100.00', // 50 × 2
  price_incl_tax_excl_discounts: '110.00', // + 10% tax
  ...over,
});

describe('resolveOrderTaxBasis', () => {
  it('detects a tax-EXCLUSIVE store (displayed price excludes tax)', () => {
    expect(resolveOrderTaxBasis({ lines: [line()] }, packages)).toBe('excl');
  });

  it('detects a tax-INCLUSIVE store (displayed price includes tax)', () => {
    // Catalog 50 is the tax-inclusive price → incl matches, excl is lower.
    const inclusive = line({
      price_incl_tax_excl_discounts: '100.00', // 50 × 2, tax already inside
      price_excl_tax_excl_discounts: '90.91', // ex-VAT
    });
    expect(resolveOrderTaxBasis({ lines: [inclusive] }, packages)).toBe('incl');
  });

  it('is discount-proof — uses pre-discount prices to detect, not the paid price', () => {
    // A 20% line discount: paid prices differ, but *_excl_discounts still match
    // the catalog, so an inclusive store is still detected as inclusive.
    const discounted = line({
      price_incl_tax_excl_discounts: '100.00',
      price_excl_tax_excl_discounts: '90.91',
    });
    expect(resolveOrderTaxBasis({ lines: [discounted] }, packages)).toBe(
      'incl'
    );
  });

  it('returns excl when the line carries no tax (incl == excl)', () => {
    const noTax = line({
      price_incl_tax_excl_discounts: '100.00',
      price_excl_tax_excl_discounts: '100.00',
    });
    expect(resolveOrderTaxBasis({ lines: [noTax] }, packages)).toBe('excl');
  });

  it('falls back to excl when no package matches or no lines', () => {
    expect(resolveOrderTaxBasis({ lines: [line()] }, [])).toBe('excl');
    expect(resolveOrderTaxBasis({ lines: [] }, packages)).toBe('excl');
    expect(resolveOrderTaxBasis(null, packages)).toBe('excl');
  });
});
