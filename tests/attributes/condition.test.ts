import { describe, expect, it } from 'vitest';
import { evaluate, parseExpression, pathsOf } from '../../src/attributes/condition';

const values: Record<string, unknown> = {
  'cart.total': 80,
  'cart.lines': [{}],
  'cart.coupons': [],
  'param.banner': 'off',
  total_discount: 0,
  price: 10,
  original_price: 12,
};
const holds = (source: string) => evaluate(parseExpression(source)!, (path) => values[path]);

describe('conditions', () => {
  it('reads a path as set or not, a list as set when it has items', () => {
    expect(holds('cart.lines')).toBe(true);
    expect(holds('cart.coupons')).toBe(false);
    expect(holds('!cart.coupons')).toBe(true);
    expect(holds('total_discount')).toBe(false);
    expect(holds('cart.hasItems()')).toBe(false);
  });

  it('compares with a number, a quoted or bare word, or another path', () => {
    expect(holds('cart.total >= 75')).toBe(true);
    expect(holds('cart.total < 75')).toBe(false);
    expect(holds("param.banner == 'off'")).toBe(true);
    expect(holds('param.banner == off')).toBe(true);
    expect(holds('param.banner != off')).toBe(false);
    expect(holds('original_price > price')).toBe(true);
    expect(holds('missing > 0')).toBe(false);
  });

  it('combines with && and ||, ! and parentheses, && before ||', () => {
    expect(holds('cart.lines && cart.total > 50')).toBe(true);
    expect(holds('cart.coupons || total_discount > 0')).toBe(false);
    expect(holds('cart.coupons || cart.lines && price == 10')).toBe(true);
    expect(holds('!(cart.total > 50)')).toBe(false);
  });

  it('refuses what it cannot read, and lists the paths it reads', () => {
    expect(parseExpression('cart.total >')).toBeNull();
    expect(parseExpression('a = b')).toBeNull();
    expect(parseExpression('(cart.total')).toBeNull();
    expect(parseExpression('')).toBeNull();
    expect(pathsOf(parseExpression('a > b.c && !d || 3 == "x"')!)).toEqual(['a', 'b.c', 'd']);
  });
});
