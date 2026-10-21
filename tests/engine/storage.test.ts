import { describe, expect, it } from 'vitest';
import { StorageAdapter } from '../../src/engine/storage';
import { MemoryStorage } from '../fixtures/storage';

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
  it('never reads back an older copy after a full store falls back', () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const adapter = new StorageAdapter({ prefix: 'p', version: 1, backends: [local, session] });
    adapter.set('reported', ['A']);
    local.failWrites = 'after-probe';
    adapter.set('reported', ['A', 'B']);
    const fresh = new StorageAdapter({ prefix: 'p', version: 1, backends: [local, session] });
    expect(fresh.get('reported')).toEqual(['A', 'B']);
  });
});
