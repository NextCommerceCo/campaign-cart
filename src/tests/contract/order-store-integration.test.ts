import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import type { Order } from '@/types/api';
import type { useOrderStore } from '@/state/order';

type Store = typeof useOrderStore;

// Run the literal published snippet against real Zustand store generations. Two
// module imports represent two SDK pages on the same origin; storage stays shared.
function documentedReader(): (
  store: Store,
  expectedRef: string
) => Order | null {
  const guide = readFileSync(
    resolve(__dirname, '../../..', 'docs/guides/reference/order-store.md'),
    'utf8'
  );
  const example = [...guide.matchAll(/```(?:javascript|js)\n([\s\S]*?)```/g)]
    .map(match => match[1])
    .find(code => code?.includes('function readCurrentOrder('));
  if (!example) throw new Error('Missing runnable readCurrentOrder example');
  return runInNewContext(`${example}\nreadCurrentOrder;`, { Date }) as (
    store: Store,
    expectedRef: string
  ) => Order | null;
}

async function scopedStore(scope: string): Promise<Store> {
  document.head.innerHTML = `<meta name="next-api-key" content="pk_synthetic"><meta name="next-storage-scope" content="${scope}">`;
  vi.resetModules();
  return (await import('@/state/order')).useOrderStore;
}

const order = (ref: string): Order =>
  ({ ref_id: ref, lines: [], total: '12.00' }) as unknown as Order;

function seed(store: Store, ref: string): void {
  store.getState().setRefId(ref);
  store.getState().setOrder(order(ref));
}

afterEach(() => {
  sessionStorage.clear();
  vi.resetModules();
});

describe('documented scoped public order access', () => {
  it('reads only its real SDK scope when another campaign already has an order', async () => {
    const foreign = await scopedStore('synthetic-b');
    seed(foreign, 'synthetic-ref-b');
    const current = await scopedStore('synthetic-a');
    const read = documentedReader();
    expect(read(current, 'synthetic-ref-a')).toBeNull();
    expect(sessionStorage.getItem('next-order__synthetic-b')).not.toBeNull();
    seed(current, 'synthetic-ref-a');
    expect(read(current, 'synthetic-ref-a')?.ref_id).toBe('synthetic-ref-a');
    expect(read(current, 'synthetic-ref-b')).toBeNull();
    expect(read(foreign, 'synthetic-ref-b')?.ref_id).toBe('synthetic-ref-b');
    const reloaded = await scopedStore('synthetic-a');
    expect(read(reloaded, 'synthetic-ref-a')?.ref_id).toBe('synthetic-ref-a');
  });

  it('fails closed during loading, errors, identity mismatch and expiry', async () => {
    const store = await scopedStore('synthetic-a');
    const read = documentedReader();
    seed(store, 'synthetic-ref-a');
    expect(read(store, 'synthetic-ref-a')).not.toBeNull();
    expect(read(store, '')).toBeNull();
    for (const patch of [
      { isLoading: true },
      { isProcessingUpsell: true },
      { upsellError: 'synthetic upsell failure' },
      { error: 'synthetic failure' },
      { refId: 'synthetic-ref-other' },
      { order: order('synthetic-ref-other') },
      { orderLoadedAt: Date.now() - 16 * 60 * 1000 },
      { orderLoadedAt: null },
      { orderLoadedAt: Number.NaN },
      { orderLoadedAt: Date.now() + 60_000 },
    ]) {
      seed(store, 'synthetic-ref-a');
      store.setState({
        isLoading: false,
        isProcessingUpsell: false,
        error: null,
        upsellError: null,
        ...patch,
      });
      expect(read(store, 'synthetic-ref-a')).toBeNull();
    }
  });

  it('documents the loader namespace and fails closed without that namespace', () => {
    const loader = readFileSync(
      resolve(__dirname, '../../..', 'public/loader.js'),
      'utf8'
    );
    const guide = readFileSync(
      resolve(__dirname, '../../..', 'docs/guides/reference/order-store.md'),
      'utf8'
    );
    expect(loader).toContain('window.NextCommerce = sdk');
    expect(guide).toContain('loader.js');
    expect(guide).toContain('window.NextCommerce');
    const read = documentedReader();
    expect(read(undefined as unknown as Store, 'synthetic-ref-a')).toBeNull();
  });
});
