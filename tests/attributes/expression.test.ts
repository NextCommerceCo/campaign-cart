import { describe, expect, it } from 'vitest';
import { evaluate, parseExpression, pathsOf, valueOf } from '../../src/attributes/expression';
import { conditionMet, parseCondition } from '../../src/engine/display/condition';

const values: Record<string, unknown> = {
  'cart.total': 80,
  'cart.lines': [{}],
  'cart.coupons': [],
  'param.banner': 'off',
  'selector.main.options.bundle-1x.total_discount': 5,
  total_discount: 0,
  price: 10,
  original_price: 12,
};
const holds = (source: string) => evaluate(parseExpression(source)!, (path) => values[path]);
const sum = (source: string) => valueOf(parseExpression(source)!, (path) => values[path]);

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

  it('reads ids with a hyphen in a path and a bare word', () => {
    expect(holds('selector.main.options.bundle-1x.total_discount > 0')).toBe(true);
    expect(holds('param.banner != on-sale')).toBe(true);
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

  it('reads every 0.4.x condition as the 0.4.x bindings do', () => {
    const sources = ['cart.hasItems', '!cart.hasItems', 'cart.hasItems()', "param.banner=='n'", 'param.banner != off'];
    for (const source of sources) {
      for (const value of [undefined, '', 'n', 'off', 0, 1, '0', 'false', true, false]) {
        const v1 = conditionMet(parseCondition(source)!, { type: 'text', value });
        expect(
          evaluate(parseExpression(source)!, () => value),
          `${source} with ${String(value)}`,
        ).toBe(v1);
      }
    }
  });

  it('adds, subtracts, multiplies and divides paths and numbers, * and / first', () => {
    expect(sum('cart.total - price')).toBe(70);
    expect(sum('price + original_price * 2')).toBe(34);
    expect(sum('(price + original_price) * 2')).toBe(44);
    expect(sum('cart.total / 4 - -1')).toBe(21);
    expect(sum('selector.main.options.bundle-1x.total_discount - 1')).toBe(4);
    expect(pathsOf(parseExpression('cart.total - price')!)).toEqual(['cart.total', 'price']);
  });

  it('comes to nothing for a value not known yet, text or a division by 0', () => {
    expect(sum('cart.total - cart.missing')).toBeUndefined();
    expect(sum('cart.total + param.banner')).toBeUndefined();
    expect(sum('cart.total / total_discount')).toBeUndefined();
    expect(parseExpression('cart.total -')).toBeNull();
    expect(parseExpression('cart.total -5')).toBeNull();
  });

  it('compares a sum, and holds for one that is not 0', () => {
    expect(holds('cart.total - price > 60')).toBe(true);
    expect(holds('cart.total >= price * 9')).toBe(false);
    expect(holds('price - 10')).toBe(false);
    expect(holds('price - 9')).toBe(true);
  });
});
