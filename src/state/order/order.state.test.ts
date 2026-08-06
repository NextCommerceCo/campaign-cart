import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '@/core/events';
import { useOrderStore } from './order.state';
import type { IApiClient } from '@/api/client.types';
import type { Order } from '@/types/api';

/**
 * `order:loaded` is what `dl_purchase` hangs on (issue #71): for express checkout
 * and 3-D Secure, the order created on the checkout page was still unpaid, and
 * the receipt page loading it back from the API is the first point the SDK knows
 * the shopper paid. So the store emitting it is load-bearing, not incidental.
 */

const ORDER = {
  ref_id: 'ord_abc',
  number: 'NX-10428',
  currency: 'USD',
  total_incl_tax: '49.99',
  lines: [],
  supports_post_purchase_upsells: true,
} as unknown as Order;

const apiReturning = (order: Order): IApiClient =>
  ({ getOrder: vi.fn().mockResolvedValue(order) }) as unknown as IApiClient;

describe('order store loadOrder', () => {
  let loaded: Order[];
  let unsubscribe: () => void;

  beforeEach(() => {
    useOrderStore.getState().reset();
    loaded = [];
    unsubscribe = EventBus.getInstance().on('order:loaded', order => {
      loaded.push(order);
    });
  });

  afterEach(() => {
    unsubscribe();
    useOrderStore.getState().reset();
  });

  it('emits order:loaded with the fetched order', async () => {
    await useOrderStore.getState().loadOrder('ord_abc', apiReturning(ORDER));

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.number).toBe('NX-10428');
    expect(useOrderStore.getState().order?.number).toBe('NX-10428');
  });

  it('does not emit when the fetch fails', async () => {
    const failing = {
      getOrder: vi.fn().mockRejectedValue(new Error('404')),
    } as unknown as IApiClient;

    await useOrderStore.getState().loadOrder('ord_missing', failing);

    expect(loaded).toEqual([]);
    expect(useOrderStore.getState().error).toBe('404');
  });

  it('does not emit again for an order already in the store', async () => {
    const getOrder = vi.fn().mockResolvedValue(ORDER);
    const api = { getOrder } as unknown as IApiClient;
    await useOrderStore.getState().loadOrder('ord_abc', api);
    await useOrderStore.getState().loadOrder('ord_abc', api);

    // The second call is served from the store's 15-minute cache — one fetch,
    // one event. Re-reporting the purchase on a receipt reload is exactly what
    // the dedupe in the data layer also guards, belt and braces.
    expect(getOrder).toHaveBeenCalledTimes(1);
    expect(loaded).toHaveLength(1);
  });
});
