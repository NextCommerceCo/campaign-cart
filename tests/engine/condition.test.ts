import { describe, expect, it } from 'vitest';
import { parseCondition } from '../../src/engine/condition';

describe('condition grammar', () => {
  it.each([
    ['cart.hasItems', { kind: 'path', path: 'cart.hasItems', negate: false }],
    ['!cart.hasCoupon', { kind: 'path', path: 'cart.hasCoupon', negate: true }],
    ['cart.hasCoupon()', { kind: 'path', path: 'cart.hasCoupon', negate: false }],
    ["param.banner=='n'", { kind: 'compare', path: 'param.banner', op: '==', literal: 'n' }],
    ["param.reviews == 'n'", { kind: 'compare', path: 'param.reviews', op: '==', literal: 'n' }],
    ['param.seen != "y"', { kind: 'compare', path: 'param.seen', op: '!=', literal: 'y' }],
  ])('%s', (source, expected) => {
    expect(parseCondition(source)).toEqual(expected);
  });

  it('rejects what it does not support instead of guessing', () => {
    expect(parseCondition('cart.total > 50 && cart.hasItems')).toBeNull();
  });
});
