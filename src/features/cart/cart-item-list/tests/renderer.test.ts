import { describe, it, expect } from 'vitest';
import {
  groupIdenticalItems,
  renderCartItem,
  getDefaultItemTemplate,
} from '../cart-item-list.renderer';
import type { CartItem } from '@/types/global';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    packageId: 10,
    quantity: 1,
    price: 29.99,
    image: 'img.png',
    title: 'Widget',
    sku: 'SKU1',
    is_upsell: false,
    ...overrides,
  } as CartItem;
}

describe('groupIdenticalItems', () => {
  it('merges items with the same packageId and sums their quantity', () => {
    const result = groupIdenticalItems([
      makeItem({ id: 1, packageId: 10, quantity: 1 }),
      makeItem({ id: 2, packageId: 10, quantity: 2 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.quantity).toBe(3);
    expect(result[0]!.groupedItemIds).toEqual([1, 2]);
  });

  it('keeps items with different packageIds separate', () => {
    const result = groupIdenticalItems([
      makeItem({ id: 1, packageId: 10 }),
      makeItem({ id: 2, packageId: 20 }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.packageId).sort()).toEqual([10, 20]);
  });

  it('leaves a single item untouched (no groupedItemIds)', () => {
    const result = groupIdenticalItems([makeItem({ id: 5, packageId: 10, quantity: 2 })]);
    expect(result).toHaveLength(1);
    expect(result[0]!.quantity).toBe(2);
    expect(result[0]!.groupedItemIds).toBeUndefined();
  });

  it('does not mutate the input items', () => {
    const input = makeItem({ id: 1, packageId: 10, quantity: 1 });
    groupIdenticalItems([input, makeItem({ id: 2, packageId: 10, quantity: 2 })]);
    expect(input.quantity).toBe(1);
  });

  it('returns an empty array for an empty cart', () => {
    expect(groupIdenticalItems([])).toEqual([]);
  });
});

describe('renderCartItem', () => {
  it('interpolates item fields into a template', () => {
    const html = renderCartItem(makeItem({ title: 'Widget', quantity: 2 }), '{item.name} x{item.quantity}');
    expect(html).toContain('Widget');
    expect(html).toContain('x2');
  });

  it('applies a custom title from the title map', () => {
    const html = renderCartItem(
      makeItem({ packageId: 10, title: 'Widget' }),
      '{item.name}',
      { 10: 'Deluxe Widget' },
    );
    expect(html).toContain('Deluxe Widget');
  });
});

describe('getDefaultItemTemplate', () => {
  it('returns a non-empty template with item tokens', () => {
    const tpl = getDefaultItemTemplate();
    expect(tpl).toContain('{item.name}');
    expect(tpl).toContain('data-next-remove-item');
  });
});
