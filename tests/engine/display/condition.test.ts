import { describe, expect, it } from 'vitest';
import { compare, parseCondition } from '../../../src/engine/display/condition';

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

  it('compares as text with == and !=, as numbers with > < >= <=, never ordering a missing value', () => {
    expect(compare('==', 5, '5')).toBe(true);
    expect(compare('==', undefined, '')).toBe(true);
    expect(compare('!=', 'off', 'on')).toBe(true);
    expect(compare('>', '10', 9)).toBe(true);
    expect(compare('<=', 9, 9)).toBe(true);
    expect(compare('>', undefined, -1)).toBe(false);
    expect(compare('<', 'abc', 1)).toBe(false);
  });
});
