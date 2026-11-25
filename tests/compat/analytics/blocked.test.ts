import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readDestinations, startDestinations } from '../../../src/analytics/destinations';
import { startLegacyDataLayer } from '../../../src/compat/analytics';
import { legacyBlocked } from '../../../src/compat/analytics/blocked';
import { readLegacyAnalytics } from '../../../src/compat/legacy/globals';
import type { Engine } from '../../../src/engine/engine';
import { OBJECTS, type TrackingEvent, type TrackingName } from '../../../src/engine/events/analytics';
import { publicOrder } from '../../../src/engine/order/order';
import { makeEngine } from '../../fixtures/engine';
import { ORDER } from '../../fixtures/order';

type Win = Window & {
  nextConfig?: unknown;
  NextDataLayer?: Array<{ event: string }>;
  dataLayer?: Array<{ event?: string }>;
  fbq?: unknown;
  rudderanalytics?: unknown;
};
type Provider = 'gtm' | 'facebook' | 'rudderstack';

const win = window as Win;
const EXAMPLES = JSON.parse(readFileSync('docs/analytics-examples.json', 'utf8')) as Record<
  TrackingName,
  { data: unknown }
>;

const track = (engine: Engine, type: TrackingName) =>
  engine.events.emit('analytics', {
    event_id: `ev-${type}`,
    event_type: type,
    object: OBJECTS[type],
    data: type === 'checkout_completed' ? publicOrder(ORDER) : EXAMPLES[type].data,
    created_at: new Date().toISOString(),
    session_id: engine.sessionId(),
    sdk_version: '1.0.0',
    context: engine.eventContext(),
  } as TrackingEvent);

/** Starts every 0.4.x provider with these `blockedEvents`, sends `type`, and returns what each destination got. */
async function send(type: TrackingName, blockedEvents: Partial<Record<Provider, string[]>>) {
  const fbq = vi.fn();
  const ra = { page: vi.fn(), track: vi.fn(), identify: vi.fn() };
  win.fbq = fbq;
  win.rudderanalytics = ra;
  const enabled = (p: Provider) => ({ enabled: true, ...(blockedEvents[p] && { blockedEvents: blockedEvents[p] }) });
  win.nextConfig = {
    analytics: {
      providers: { gtm: enabled('gtm'), facebook: enabled('facebook'), rudderstack: enabled('rudderstack') },
    },
  };
  const legacy = readLegacyAnalytics();
  const { engine } = makeEngine();
  await engine.start();
  engine.attach((ctx) => ctx.update('order', { paidOrder: ORDER }));
  startDestinations(
    engine,
    { ...readDestinations(legacy), blocked: legacyBlocked() },
    { apiKey: 'pk_test', version: '1.0.0' },
    startLegacyDataLayer,
  );
  track(engine, type);
  track(engine, 'product_viewed');
  await vi.waitFor(() => {
    expect(fbq.mock.calls.map((c) => c[1])).toContain('ViewContent');
    expect(ra.track.mock.calls.map((c) => c[0])).toContain('Product Viewed');
  });
  return {
    NextDataLayer: win.NextDataLayer!.map((p) => p.event),
    dataLayer: win.dataLayer!.flatMap((p) => p.event ?? []),
    meta: fbq.mock.calls.map((c) => c[1] as string),
    rudderstack: ra.track.mock.calls.map((c) => c[0] as string),
    skipped: engine.log.entries().flatMap((e) => ((e.data as { skipped?: string })?.skipped ? [e.data] : [])) as Array<
      Record<string, unknown>
    >,
  };
}

beforeEach(() => {
  delete win.NextDataLayer;
  delete win.dataLayer;
});
afterEach(() => {
  delete win.nextConfig;
  delete win.fbq;
  delete win.rudderanalytics;
});

describe('0.4.x blockedEvents', () => {
  it('reads each provider’s list, and none for a provider without one', () => {
    win.nextConfig = {
      analytics: {
        providers: { gtm: { enabled: true, blockedEvents: ['dl_purchase', 7] }, facebook: { blockedEvents: [] } },
      },
    };
    expect(legacyBlocked()).toEqual({ dataLayer: ['dl_purchase'] });
    win.nextConfig = { analytics: { providers: { rudderstack: { blockedEvents: ['dl_add_shipping_info'] } } } };
    expect(legacyBlocked().rudderstack).toEqual({
      checkout_shipping_address_submitted: 'dl_add_shipping_info',
      checkout_shipping_method_submitted: 'dl_add_shipping_info',
    });
  });

  it.each([
    ['gtm', 'dataLayer'],
    ['facebook', 'meta'],
    ['rudderstack', 'rudderstack'],
  ] as const)('keeps dl_begin_checkout from %s only', async (provider, place) => {
    const got = await send('checkout_started', { [provider]: ['dl_begin_checkout'] });
    const sent = {
      dataLayer: got.dataLayer.includes('dl_begin_checkout'),
      meta: got.meta.includes('InitiateCheckout'),
      rudderstack: got.rudderstack.includes('Checkout Started'),
    };
    expect(sent).toEqual({ dataLayer: true, meta: true, rudderstack: true, [place]: false });
    expect(got.NextDataLayer).toContain('dl_begin_checkout');
    expect(got.skipped).toEqual([
      expect.objectContaining({ destination: place, name: 'dl_begin_checkout', skipped: 'in blockedEvents' }),
    ]);
  });

  it('keeps dl_begin_checkout from GTM, Meta and RudderStack at once, as 0.4.43 did', async () => {
    const list = ['dl_begin_checkout'];
    const got = await send('checkout_started', { gtm: list, facebook: list, rudderstack: list });
    expect(got.dataLayer).not.toContain('dl_begin_checkout');
    expect(got.meta).not.toContain('InitiateCheckout');
    expect(got.rudderstack).not.toContain('Checkout Started');
    expect(got.NextDataLayer).toContain('dl_begin_checkout');
  });

  it('keeps dl_purchase from Meta only: no Purchase, and the other destinations still get the order', async () => {
    const got = await send('checkout_completed', { facebook: ['dl_purchase'] });
    expect(got.meta).not.toContain('Purchase');
    expect(got.dataLayer).toContain('dl_purchase');
    expect(got.rudderstack).toContain('Order Completed');
  });

  it('matches the dl_* name verbatim: "purchase" blocks nothing', async () => {
    const got = await send('checkout_completed', { facebook: ['purchase'], gtm: ['purchase'] });
    expect(got.meta).toContain('Purchase');
    expect(got.dataLayer).toContain('dl_purchase');
  });
});
