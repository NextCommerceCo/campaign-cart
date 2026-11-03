import { describe, expect, it } from 'vitest';
import { variantChoices } from '../../../src/engine/cart/selectors';
import type { Package } from '../../../src/engine/types';

const tee = (ref_id: number, size: string, color: string, availability = 'available'): Package => ({
  ref_id,
  external_id: ref_id,
  name: `Tee ${size} ${color}`,
  price: '10.00',
  price_total: '10.00',
  qty: 1,
  image: '',
  is_recurring: false,
  product_id: 7,
  product_purchase_availability: availability,
  product_variant_attribute_values: [
    { code: 'size', name: 'Size', value: size },
    { code: 'color', name: 'Color', value: color },
  ],
});

describe('variant choices', () => {
  it('offers each attribute of the product, each value with the package that keeps the others', () => {
    const packages = [
      tee(1, 'S', 'White'),
      tee(2, 'M', 'White'),
      tee(3, 'S', 'Black'),
      tee(4, 'M', 'Black', 'unavailable'),
    ];
    expect(variantChoices(packages, 1)).toEqual([
      {
        code: 'size',
        name: 'Size',
        value: 'S',
        options: [
          { value: 'S', packageId: 1 },
          { value: 'M', packageId: 2 },
        ],
      },
      {
        code: 'color',
        name: 'Color',
        value: 'White',
        options: [
          { value: 'White', packageId: 1 },
          { value: 'Black', packageId: 3 },
        ],
      },
    ]);
    expect(variantChoices(packages, 3)[0]!.options).toEqual([
      { value: 'S', packageId: 3 },
      { value: 'M', packageId: undefined },
    ]);
    expect(variantChoices([{ ...tee(9, 'S', 'White'), product_variant_attribute_values: [] }], 9)).toEqual([]);
  });
});
