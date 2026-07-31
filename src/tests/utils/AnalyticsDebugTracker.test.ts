import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnalyticsDebugTracker,
  type ProviderDebugInfo,
} from '@/core/analytics/debug/AnalyticsDebugTracker';
import type { ProviderAdapter } from '@/core/analytics/providers/ProviderAdapter';

// Minimal stand-in for a registered adapter — only getDebugInfo is read.
function fakeProvider(info: ProviderDebugInfo): ProviderAdapter {
  return { getDebugInfo: () => info } as unknown as ProviderAdapter;
}

describe('AnalyticsDebugTracker', () => {
  let tracker: AnalyticsDebugTracker;

  beforeEach(() => {
    // Fresh instance per test (bypass the shared singleton).
    tracker = new (AnalyticsDebugTracker as unknown as {
      new (): AnalyticsDebugTracker;
    })();
  });

  it('records a delivery and returns an id', () => {
    const id = tracker.record('GTM', 'dl_purchase', 'pending', {
      eventId: 'evt_1',
    });
    expect(id).toMatch(/^dlv_/);

    const [record] = tracker.getDeliveries();
    expect(record).toMatchObject({
      provider: 'GTM',
      eventName: 'dl_purchase',
      eventId: 'evt_1',
      status: 'pending',
    });
  });

  it('resolves a pending delivery via update()', () => {
    const id = tracker.record('Custom', 'dl_add_to_cart', 'pending');
    tracker.update(id, 'failed', { error: '500 endpoint' });

    const [record] = tracker.getDeliveries();
    expect(record.status).toBe('failed');
    expect(record.error).toBe('500 endpoint');
  });

  it('stores the event payload and stamps duration on resolution', () => {
    const payload = { event: 'dl_purchase', ecommerce: { value: 49.99 } };
    const id = tracker.record('GTM', 'dl_purchase', 'pending', { payload });

    let [record] = tracker.getDeliveries();
    expect(record.payload).toEqual(payload);
    expect(record.durationMs).toBeUndefined();

    tracker.update(id, 'sent');
    [record] = tracker.getDeliveries();
    expect(record.status).toBe('sent');
    expect(typeof record.durationMs).toBe('number');
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('ignores update() for an unknown id', () => {
    tracker.record('GTM', 'dl_view_item', 'sent');
    expect(() => tracker.update('missing', 'failed')).not.toThrow();
    expect(tracker.getDeliveries()[0].status).toBe('sent');
  });

  it('caps the delivery buffer at 250 records (drops oldest)', () => {
    for (let i = 0; i < 300; i++) {
      tracker.record('GTM', `evt_${i}`, 'sent');
    }
    const deliveries = tracker.getDeliveries();
    expect(deliveries.length).toBe(250);
    // Oldest 50 dropped → first retained is evt_50.
    expect(deliveries[0].eventName).toBe('evt_50');
    expect(deliveries[deliveries.length - 1].eventName).toBe('evt_299');
  });

  it('maps registered providers through getDebugInfo()', () => {
    const info: ProviderDebugInfo = {
      name: 'Facebook',
      enabled: true,
      ready: false,
      blockedEvents: ['dl_user_data'],
      details: { fbqLoaded: false },
    };
    tracker.registerProvider(fakeProvider(info));

    expect(tracker.getProviders()).toEqual([info]);
  });

  it('clear() empties deliveries but keeps provider registrations', () => {
    tracker.registerProvider(
      fakeProvider({
        name: 'GTM',
        enabled: true,
        ready: true,
        blockedEvents: [],
        details: {},
      })
    );
    tracker.record('GTM', 'dl_purchase', 'sent');

    tracker.clear();

    expect(tracker.getDeliveries()).toHaveLength(0);
    expect(tracker.getProviders()).toHaveLength(1);
  });
});
