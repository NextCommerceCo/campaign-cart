// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    expect(storageScope('pk_x', 'hu')).not.toBe(storageScope('pk_xhu', ''));
  });
});

describe('storage adapter', () => {
  const adapter = (store: Storage, version = 1, now?: () => number) =>
    new StorageAdapter({ prefix: 'p', version, backends: [store], now });

  it('drops a value written by another schema version', () => {
    const local = new MemoryStorage();
    adapter(local, 1).set('cart', 1);
    expect(adapter(local, 2).get('cart')).toBeUndefined();
  });

  it('drops an expired value', () => {
    let now = 0;
    const s = adapter(new MemoryStorage(), 1, () => now);
    s.set('x', 1);
    now = 1000;
    expect(s.get('x', 500)).toBeUndefined();
  });

  it('ignores a corrupt stored value', () => {
    const local = new MemoryStorage();
    local.setItem('p:cart', '{not json');
    expect(adapter(local).get('cart')).toBeUndefined();
  });

  it('clears only its own prefix', () => {
    const local = new MemoryStorage();
    local.setItem('other', 'keep');
    const s = adapter(local);
    s.set('cart', 1);
    s.clear();
    expect([...local.data.keys()]).toEqual(['other']);
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
  it('formats by type in the campaign currency', async () => {
    const { engine } = makeEngine();
    await engine.load();
    await engine.addItem(2);
    expect(format(resolve(engine, 'cart.total')!, 'USD', 'en')).toBe('$89.00');
    expect(format(resolve(engine, 'cart.savingsPercentage')!, 'USD', 'en')).toBe('55%');
    expect(format(resolve(engine, 'package.2.savingsPercentage')!, 'USD', 'en')).toBe('55%');
    expect(format(resolve(engine, 'package.price', { packageId: 1 })!, 'USD', 'en')).toBe('$49.00');
    expect(resolve(engine, 'shipping.isFree')).toEqual({ type: 'bool', value: true });
    expect(resolve(engine, 'campaign.name')).toEqual({ type: 'text', value: 'Olympus' });
  });

  it('shows the local dollar sign, not CA$ or A$', () => {
    expect(format({ type: 'money', value: 10 }, 'CAD', 'en')).toBe('$10.00');
    expect(format({ type: 'money', value: 10 }, 'AUD', 'en')).toBe('$10.00');
  });

  it('knows a path from a typo', () => {
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

describe('chunk boundary', () => {
  it('only the loader imports config at runtime, so core never re-evaluates the loader', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)],
      );
    const offenders = files('src')
      .filter((f) => !f.endsWith('loader.ts') && !f.endsWith('config.ts'))
      .filter((f) => /^import (?!type)[^;]*from '\.{1,2}\/(\.\.\/)?(config|loader)'/m.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
