import { describe, expect, it } from 'vitest';
import { triedConfig, withTried } from '../../../src/engine/visit/debug-config';

const session = (entries: Record<string, unknown>) => {
  const data = new Map(Object.entries(entries).map(([k, d]) => [k, JSON.stringify({ v: 1, t: 0, d })]));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: data.size,
  } as Storage;
};

describe('triedConfig', () => {
  const tried = { analytics: { destinations: { ga4: { enabled: true } } } };

  it('reads the nextConfig the debug panel tries while debug mode is on', () => {
    expect(triedConfig(session({ 'next:debugging': true, 'next:debug': { config: tried } }), undefined)).toEqual(tried);
    expect(triedConfig(session({ 'next:debug': { config: tried } }), true)).toEqual(tried);
  });

  it('reads nothing when debug mode is off or there is no session', () => {
    expect(triedConfig(session({ 'next:debug': { config: tried } }), undefined)).toBeUndefined();
    expect(triedConfig(session({ 'next:debugging': true, 'next:debug': { config: tried } }), false)).toBeUndefined();
    expect(triedConfig(null, true)).toBeUndefined();
  });
});

describe('withTried', () => {
  it('puts the tried config over the page, keeping the keys the loader read', () => {
    const page = { apiKey: 'pk_page', locale: 'en', analytics: { enabled: true } };
    expect(withTried(page, { apiKey: 'pk_other', funnel: 'f2', locale: 'fr' })).toEqual({
      apiKey: 'pk_page',
      locale: 'fr',
      analytics: { enabled: true },
    });
  });
});
