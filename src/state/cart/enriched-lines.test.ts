import { describe, it, expect } from 'vitest';
import { toEnrichedCartLines } from './enriched-lines';
import type { CartItem } from '@/types/global';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    packageId: 1,
    quantity: 1,
    price: 49.99,
    title: 'Starter Pack',
    sku: 'SKU-1',
    image: 'https://cdn.example.com/pack.jpg',
    is_upsell: false,
    ...overrides,
  } as CartItem;
}

describe('toEnrichedCartLines', () => {
  it('returns no lines for an empty cart', () => {
    expect(toEnrichedCartLines([])).toEqual([]);
  });

  it('prices a line the calculate API has already answered for', () => {
    const [line] = toEnrichedCartLines([
      makeItem({
        quantity: 2,
        price: 100,
        price_total: '100.00',
        price_retail_total: '150.00',
        package_price: '90.00',
        total: '180.00',
        total_discount: '20.00',
      }),
    ]);

    // final = item.total (the API line total)
    expect(line?.price.excl_tax.value).toBe(180);
    // original = price_retail_total × quantity = 150 × 2
    expect(line?.price.original.value).toBe(300);
    expect(line?.price.savings.value).toBe(120);
    // no tax breakdown from the cart calculate API — both hold the line total
    expect(line?.price.incl_tax.value).toBe(line?.price.excl_tax.value);
  });

  it('prices a line added but not yet calculated', () => {
    // The regression behind issue #36: an integrator calling getCartData()
    // straight after addItem() must still see the line.
    const lines = toEnrichedCartLines([
      makeItem({ quantity: 3, price: 25, price_total: '25.00' }),
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.price.excl_tax.value).toBe(75);
    expect(lines[0]?.price.original.value).toBe(75);
    expect(lines[0]?.price.savings.value).toBe(0);
  });

  it('never reports negative savings when retail is below the charged price', () => {
    const [line] = toEnrichedCartLines([
      makeItem({ price: 100, price_retail_total: '80.00', total: '100.00' }),
    ]);

    expect(line?.price.original.value).toBe(100);
    expect(line?.price.savings.value).toBe(0);
  });

  it('formats every amount in the line', () => {
    const [line] = toEnrichedCartLines([makeItem({ price: 49.99 })]);

    expect(line?.price.excl_tax.formatted).toMatch(/49\.99/);
    expect(line?.price.original.formatted).toMatch(/49\.99/);
  });

  it('keeps one line per cart item, in cart order', () => {
    const lines = toEnrichedCartLines([
      makeItem({ id: 11, packageId: 1 }),
      makeItem({ id: 22, packageId: 4, title: 'Expert Pack' }),
      // Same package, different personalisation — two rows, not one.
      makeItem({ id: 33, packageId: 4, properties: { slot: '2' } }),
    ]);

    expect(lines.map(l => l.id)).toEqual([11, 22, 33]);
    expect(lines.map(l => l.packageId)).toEqual([1, 4, 4]);
  });

  it('carries the product fields, falling back to the variant SKU', () => {
    const [line] = toEnrichedCartLines([
      makeItem({ sku: undefined, variantSku: 'VAR-9', image: undefined }),
    ]);

    expect(line?.product).toEqual({
      title: 'Starter Pack',
      sku: 'VAR-9',
      image: '',
    });
  });

  it('passes a billing interval through only when it is one the type allows', () => {
    const [monthly] = toEnrichedCartLines([
      makeItem({ is_recurring: true, interval: 'month' }),
    ]);
    expect(monthly?.is_recurring).toBe(true);
    expect(monthly?.interval).toBe('month');

    const [odd] = toEnrichedCartLines([
      makeItem({ is_recurring: true, interval: 'week' }),
    ]);
    expect(odd?.interval).toBeUndefined();

    const [oneOff] = toEnrichedCartLines([makeItem()]);
    expect(oneOff?.is_recurring).toBe(false);
    expect(oneOff?.interval).toBeUndefined();
  });

  it('marks the lines one selector added together as a bundle', () => {
    const lines = toEnrichedCartLines([
      makeItem({ id: 5, packageId: 1, selectorId: 'builder' }),
      makeItem({ id: 6, packageId: 2, selectorId: 'builder' }),
      makeItem({ id: 7, packageId: 3, selectorId: 'builder' }),
    ]);

    expect(lines.map(l => l.is_bundle)).toEqual([true, true, true]);
    // Each line names the bundle's *other* lines.
    expect(lines[0]?.bundleComponents).toEqual([6, 7]);
    expect(lines[2]?.bundleComponents).toEqual([5, 6]);
  });

  it('does not call a lone selector line, or a plain add, a bundle', () => {
    const lines = toEnrichedCartLines([
      // A package selector writes exactly one line under its own selectorId.
      makeItem({ id: 8, packageId: 1, selectorId: 'upgrade' }),
      // A direct add-to-cart button writes none at all.
      makeItem({ id: 9, packageId: 2 }),
    ]);

    expect(lines.map(l => l.is_bundle)).toEqual([false, false]);
    expect(lines[0]?.bundleComponents).toBeUndefined();
    expect(lines[1]?.bundleComponents).toBeUndefined();
  });

  it('flags an upsell line', () => {
    const [line] = toEnrichedCartLines([makeItem({ is_upsell: true })]);
    expect(line?.is_upsell).toBe(true);
  });
});
