import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../src/analytics';
import { bindAll } from '../src/bindings';
import { buildAttribution } from '../src/engine/attribution';
import { flush, makeEngine } from './fixtures';

type Win = Window & { NextDataLayer?: any[]; dataLayer?: any[]; NextDataLayerTransformFn?: unknown; nextCampaign?: unknown };
const win = window as Win;
const options = { apiKey: 'pk_test', version: '1.0.0', nextCampaign: false };
const names = () => (win.NextDataLayer ?? []).map((e) => e.event);

async function ready(html = '', params: Record<string, string> = {}) {
  document.body.innerHTML = html;
  const { engine } = makeEngine({ params, visit: { landingPage: 'https://shop.test/lp', referrer: '', device: 'UA', deviceType: 'desktop' } });
  engine.restore();
  await engine.load();
  return engine;
}

beforeEach(() => {
  delete win.NextDataLayer;
  delete win.dataLayer;
  delete win.NextDataLayerTransformFn;
  delete win.nextCampaign;
});

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('analytics', () => {
  it('sends dl_user_data on ready with the old envelope and no personal data', async () => {
    const engine = await ready('', { utm_source: 'fb', email: 'jane@x.com' });
    startAnalytics(engine, options);
    engine.events.emit('ready', { lines: [] });
    const [event] = win.NextDataLayer!;
    expect(event).toMatchObject({
      event: 'dl_user_data',
      user_properties: { visitor_type: 'guest' },
      campaign_name: 'Olympus',
      campaign_currency: 'USD',
      cart_total: '0',
      ecommerce: { currency: 'USD', value: 0, items: [] },
      attribution: { utm_source: 'fb', funnel: 'Olympus' },
    });
    expect(event.event_id).toMatch(/^\w+_1$/);
    expect(JSON.stringify(event)).not.toContain('jane@x.com');
    expect(win.dataLayer).toEqual([{ ecommerce: null }, event]);
  });

  it('replays ready when it attaches late, and reports what the page shows', async () => {
    const engine = await ready(`<div data-next-package-id="1"></div><div data-next-package-id="9"></div><div data-next-package-id="1"></div>`);
    engine.events.emit('ready', { lines: [] });
    startAnalytics(engine, options);
    expect(names()).toEqual(['dl_user_data', 'dl_view_item_list']);
    expect(win.NextDataLayer![1].ecommerce.items.map((i: any) => i.item_id)).toEqual(['11', '19']);
  });

  it('honours NextDataLayerTransformFn, including a forwarder-style accessor', async () => {
    const engine = await ready(`<div data-next-package-id="2"></div>`);
    const seen: string[] = [];
    Object.defineProperty(win, 'NextDataLayerTransformFn', {
      configurable: true,
      get: () => (e: any) => {
        seen.push(e.event);
        return e.event === 'dl_user_data' ? null : { ...e, forwarded: true };
      },
    });
    startAnalytics(engine, options);
    engine.events.emit('ready', { lines: [] });
    expect(seen).toEqual(['dl_user_data', 'dl_view_item']);
    expect(win.NextDataLayer).toHaveLength(1);
    expect(win.NextDataLayer![0]).toMatchObject({ event: 'dl_view_item', forwarded: true, ecommerce: { items: [{ item_id: '12', price: 44.5, quantity: 2 }] } });
    delete win.NextDataLayerTransformFn;
  });

  it('turns cart changes after ready into add, swap, remove and cart-updated events', async () => {
    const engine = await ready();
    const error = vi.spyOn(console, 'error');
    await engine.setGroup('bundle:main', { lines: [{ packageId: 1, quantity: 1 }], vouchers: [] });
    startAnalytics(engine, options);
    engine.events.emit('ready', { lines: engine.lines() });
    await engine.setGroup('toggle:9', { lines: [{ packageId: 9, quantity: 1 }], vouchers: [] });
    await engine.setGroup('bundle:main', { lines: [{ packageId: 2, quantity: 1 }], vouchers: [] });
    await engine.setGroup('toggle:9', null);
    await flush();
    expect(names()).toEqual(['dl_user_data', 'dl_add_to_cart', 'dl_cart_updated', 'dl_package_swapped', 'dl_cart_updated', 'dl_remove_from_cart', 'dl_cart_updated']);
    const swap = win.NextDataLayer!.find((e) => e.event === 'dl_package_swapped');
    expect(swap.ecommerce).toMatchObject({ value_change: 40, items_removed: [{ item_id: '11' }], items_added: [{ item_id: '12' }] });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('loads the NextCampaign script once and sends one page_view', async () => {
    const engine = await ready();
    const config = vi.fn();
    const event = vi.fn();
    startAnalytics(engine, { ...options, nextCampaign: true });
    const script = document.querySelector<HTMLScriptElement>('script[src="https://campaigns.apps.29next.com/js/v1/campaign/"]')!;
    win.nextCampaign = { config, event };
    script.onload!(new Event('load'));
    expect(config).toHaveBeenCalledWith({ apiKey: 'pk_test' });
    expect(event).toHaveBeenCalledWith('page_view', expect.objectContaining({ url: location.href }));
    startAnalytics(engine, { ...options, nextCampaign: true });
    expect(document.querySelectorAll('script[src*="js/v1/campaign"]')).toHaveLength(1);
  });
});

describe('attribution', () => {
  it('builds the object orders and events carry', () => {
    const visit = { landingPage: 'https://shop.test/lp', referrer: 'https://google.com', device: 'UA', deviceType: 'mobile' as const, fbp: 'fb.1', fbc: '' };
    expect(buildAttribution({ aff: 'A1', sub2: 'x'.repeat(300), utm_source: 'fb', fbclid: 'F', evclid: 'E', other: 'y' }, visit, 'Olympus')).toEqual({
      affiliate: 'A1',
      funnel: 'Olympus',
      utm_source: 'fb',
      subaffiliate2: 'x'.repeat(225),
      everflow_transaction_id: 'E',
      metadata: {
        landing_page: 'https://shop.test/lp',
        referrer: 'https://google.com',
        device: 'UA',
        device_type: 'mobile',
        fb_fbp: 'fb.1',
        fb_fbc: '',
        fbclid: 'F',
        everflow_transaction_id: 'E',
      },
    });
  });

  it('keeps the first landing page of the tab', async () => {
    const session = (await import('./fixtures')).MemoryStorage;
    const store = new session();
    const first = makeEngine({ session: store, visit: { landingPage: 'https://shop.test/lp', referrer: 'r', device: 'UA', deviceType: 'desktop' } }).engine;
    first.restore();
    const second = makeEngine({ session: store, visit: { landingPage: 'https://shop.test/checkout', referrer: '', device: 'UA', deviceType: 'desktop' } }).engine;
    second.restore();
    expect(second.attribution().metadata.landing_page).toBe('https://shop.test/lp');
  });
});

describe('links', () => {
  it('carries session params on same-site links only', async () => {
    const engine = await ready(`<a id="in" href="/checkout">go</a><a id="out" href="https://other.test/x">out</a>`, { utm_source: 'fb', reset: '1' });
    bindAll(document, engine, vi.fn());
    const click = (id: string) => document.getElementById(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.addEventListener('click', (e) => e.preventDefault(), { once: false });
    click('in');
    click('out');
    expect(document.querySelector<HTMLAnchorElement>('#in')!.href).toBe(`${location.origin}/checkout?utm_source=fb`);
    expect(document.querySelector<HTMLAnchorElement>('#out')!.href).toBe('https://other.test/x');
  });
});
