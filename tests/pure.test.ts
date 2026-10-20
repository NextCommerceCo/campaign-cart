// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseCondition } from '../src/engine/condition';
import { funnelFromPath, storageScope } from '../src/engine/scope';
import { StorageAdapter } from '../src/engine/storage';
import { format, resolve } from '../src/engine/values';
import { parseForcePackages } from '../src/core';
import { makeEngine, MemoryStorage } from './fixtures';

describe('storage scope', () => {
  it('keeps a funnel together at any depth and separates top folders', () => {
    expect(funnelFromPath('/helloweenA/landing')).toBe('helloweena');
    expect(funnelFromPath('/helloweenA/checkout/step2')).toBe('helloweena');
    expect(funnelFromPath('/landing')).toBe('');
  });

  it('gives two funnels on one key different scopes', () => {
    expect(storageScope('pk_1', 'helloweena')).not.toBe(storageScope('pk_1', 'helloweenb'));
    expect(storageScope('pk_1', 'a')).toBe(storageScope('pk_1', 'a'));
    // The separator keeps (pk_x, hu) and (pk_xhu, '') apart.
    expect(storageScope('pk_x', 'hu')).not.toBe(storageScope('pk_xhu', ''));
  });
});

describe('storage adapter', () => {
  it('drops a value written by another schema version', () => {
    const local = new MemoryStorage();
    new StorageAdapter({ prefix: 'p', version: 1, local }).set('cart', 1, 'local');
    expect(new StorageAdapter({ prefix: 'p', version: 2, local }).get('cart', 'local')).toBeUndefined();
  });

  it('drops an expired value', () => {
    let now = 0;
    const s = new StorageAdapter({ prefix: 'p', version: 1, local: new MemoryStorage(), now: () => now });
    s.set('x', 1, 'local');
    now = 1000;
    expect(s.get('x', 'local', 500)).toBeUndefined();
  });

  it('clears only its own prefix', () => {
    const local = new MemoryStorage();
    local.setItem('other', 'keep');
    const s = new StorageAdapter({ prefix: 'next:a', version: 1, local });
    s.set('cart', 1, 'local');
    s.clear();
    expect(local.getItem('other')).toBe('keep');
    expect(local.length).toBe(1);
  });
});

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

describe('display values', () => {
  it('formats money by type, in the campaign currency', async () => {
    const { engine } = makeEngine();
    await engine.load();
    await engine.addItem(2);
    expect(format(resolve(engine, 'cart.total')!, 'USD', 'en')).toBe('$89.00');
    expect(format(resolve(engine, 'package.2.savingsPercentage')!, 'USD', 'en')).toBe('55%');
    expect(format(resolve(engine, 'package.price', { packageId: 1 })!, 'USD', 'en')).toBe('$49.00');
  });

  it('knows a path from a typo', async () => {
    const { engine } = makeEngine();
    expect(resolve(engine, 'cart.totl')).toBeUndefined();
    expect(resolve(engine, 'cart.total')).toEqual({ type: 'money', value: undefined });
  });
});

describe('forcePackageId', () => {
  it('reads ids with optional quantities', () => {
    expect(parseForcePackages('2')).toEqual([{ packageId: 2, quantity: 1 }]);
    expect(parseForcePackages('2:3,5')).toEqual([
      { packageId: 2, quantity: 3 },
      { packageId: 5, quantity: 1 },
    ]);
    expect(parseForcePackages('abc')).toEqual([]);
  });
});
