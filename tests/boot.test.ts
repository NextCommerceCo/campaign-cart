import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../src/config';
import { boot } from '../src/boot';
import { LEGACY_EVENTS } from '../src/compat/legacy';
import type { Campaign } from '../src/engine/types';
import { fakeApi } from './fixtures/api';
import { campaign } from './fixtures/campaign';
import { flush } from './fixtures/engine';

const config = { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: '', debug: false, reset: false };

beforeEach(() => {
  vi.stubGlobal('fetch', fakeApi().fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-next-ready');
  document.documentElement.removeAttribute('data-next-error');
  delete (window as { nextReady?: unknown }).nextReady;
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, '', '/');
});

describe('readConfig', () => {
  it('turns debug mode on with ?debug=1 and off with ?debug=0, and leaves it as it was otherwise', () => {
    const debug = (search: string) => {
      history.replaceState(null, '', `/lp/${search}`);
      return readConfig(document, window).debug;
    };
    expect([debug('?debug=1'), debug('?debugger=true'), debug('?debug=0'), debug('')]).toEqual([
      true,
      true,
      false,
      undefined,
    ]);
  });

  it('reads the script tag first, then the deprecated config', () => {
    document.head.innerHTML = `<script data-campaign="pk_live_1"></script><script data-funnel="helloweenA"></script>`;
    expect(readConfig(document, window)).toMatchObject({ apiKey: 'pk_live_1', funnel: 'helloweenA' });
    document.head.innerHTML = `<meta name="next-api-key" content="pk_old"><meta name="next-funnel" content="f1">`;
    expect(readConfig(document, window)).toMatchObject({ apiKey: 'pk_old', funnel: 'f1' });
  });
});

describe('boot', () => {
  it('starts a forced cart and announces itself the old and new ways', async () => {
    history.replaceState(null, '', '/lp/checkout?forcePackageId=2:1');
    document.body.innerHTML = `<span id="total" data-next-display="cart.total"></span>`;
    const onWindow = vi.fn();
    window.addEventListener('next:initialized', onWindow);
    const queued = vi.fn();
    (window as unknown as { nextReady: unknown[] }).nextReady = [
      () => {
        throw new Error('page bug');
      },
      queued,
    ];
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const next = boot(config, Promise.resolve(campaign));
    await flush();

    expect(next.getState().cart.groups.items?.lines).toEqual([{ packageId: 2, quantity: 1 }]);
    expect(document.querySelector('#total')!.textContent).toBe('$89.00');
    expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true);
    expect(onWindow).toHaveBeenCalledTimes(1);
    expect(queued).toHaveBeenCalledWith(next);
    expect(next.version).toMatch(/^\d+\.\d+\.\d+$/);
    window.removeEventListener('next:initialized', onWindow);
  });

  it('notes the domain and the page’s Meta pixel for order attribution, like 0.4.x', async () => {
    document.head.innerHTML = `<script>!function(){}(); fbq('init', '1234567890'); fbq('track', 'PageView');</script>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    expect(next.getState().visit.landing).toMatchObject({ domain: location.hostname, pixelId: '1234567890' });
  });

  it('is ready from the snapshot before the campaign request returns', async () => {
    boot(config, Promise.resolve(campaign));
    await flush();
    document.documentElement.removeAttribute('data-next-ready');
    let resolve!: (c: Campaign) => void;
    boot(config, new Promise((r) => (resolve = r)));
    expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true);
    resolve(campaign);
  });

  it('fires a late next.on("ready") and works with detached actions', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const ready = vi.fn();
    next.on('ready', ready);
    expect(ready).toHaveBeenCalledTimes(1);
    const { addItem } = next.actions;
    await addItem(1);
    expect(next.getState().cart.summary?.total).toBe('49.00');
  });

  it('marks the page when the campaign cannot load, even with a snapshot', async () => {
    boot(config, Promise.resolve(campaign));
    await flush();
    boot(config, Promise.reject(new Error('down')));
    await flush();
    expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true);
    expect(document.documentElement.getAttribute('data-next-error')).toBe('campaign');
  });

  it('leaves campaign off the envelope while the campaign has not loaded', async () => {
    const next = boot(config, Promise.reject(new Error('down')));
    const error = vi.fn();
    next.on('sdk.error', error);
    await flush();
    expect(error.mock.calls[0]![1]).toMatchObject({ data: { action: 'campaign.load' } });
    expect(error.mock.calls[0]![1]).not.toHaveProperty('campaign');
  });

  it('maps old next.on names to the new events and passes the payload', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = `<div data-next-bundle-selector data-next-selector-id="main">
      <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'></div>
      <div id="two" data-next-bundle-card data-next-bundle-id="two" data-next-bundle-items='[{"packageId":2,"quantity":1}]'></div></div>`;
    const next = boot(config, Promise.resolve(campaign));
    const changed = vi.fn();
    next.on('bundle:selection-changed' as never, changed);
    next.on('fomo:shown' as never, vi.fn());
    next.on('nope:event' as never, vi.fn());
    document.querySelector<HTMLElement>('#two')!.click();
    expect(changed).toHaveBeenCalledWith(
      { selectorId: 'main', cardId: 'two', items: [{ packageId: 2, quantity: 1 }] },
      expect.anything(),
    );
    expect(warn.mock.calls).toEqual([['[next] next.on: unknown event "nope:event"']]);
  });

  it('hands each event with an envelope like a webhook, and keeps ready for scripts that listen late', async () => {
    const api = fakeApi();
    vi.stubGlobal('fetch', api.fetch);
    const next = boot(config, Promise.resolve(campaign));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
    const ready = vi.fn();
    next.on('ready', ready);
    expect(ready).toHaveBeenCalledWith(
      { lines: expect.any(Array) },
      {
        event_id: expect.stringMatching(/^[0-9a-f]{32}$/),
        event_type: 'sdk.ready',
        object: 'sdk',
        data: { lines: expect.any(Array) },
        created_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
        session_id: expect.stringMatching(/^[0-9a-f]{32}$/),
        sdk_version: expect.any(String),
      },
    );
    const session = ready.mock.calls[0]![1].session_id;
    expect(document.cookie).toContain(`ncsid=${session}`);
    expect(next.context()).toEqual({
      page_location: location.origin + location.pathname,
      page_referrer: '',
      campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
      session_id: session,
      attribution: expect.any(Object),
      browser: {
        user_agent: navigator.userAgent,
        language: navigator.language,
        device_type: expect.stringMatching(/^(mobile|desktop)$/),
      },
    });
    const added = vi.fn();
    next.on('cart.added', added);
    await next.actions.addItem(1);
    await vi.waitFor(() => expect(added).toHaveBeenCalledTimes(1));
    expect(added.mock.calls[0]![1]).toMatchObject({ event_type: 'cart.added', object: 'cart', session_id: session });
    expect(api.calls.at(-1)!.headers['X-Next-Campaign-Session-Id']).toBe(session);
    const shipped = vi.fn();
    next.on('shipping.selected', shipped);
    await next.actions.setShipping(1);
    expect(shipped.mock.calls[0]![1]).toMatchObject({ event_type: 'shipping.selected', object: 'shipping' });
    document.cookie = 'ncsid=; path=/; max-age=0';
  });

  it('gives 0.4.x names the payload they had, only for the moment they meant', async () => {
    const next = boot(config, Promise.resolve(campaign));
    const cart = vi.fn();
    const shipping = vi.fn();
    next.on('cart:updated' as never, cart);
    next.on('shipping:method-changed' as never, shipping);
    await next.actions.addItem(1);
    await next.actions.setShipping(1);
    expect(cart.mock.calls.at(-1)![0]).toMatchObject({ groups: expect.any(Object), coupons: [] });
    expect(shipping).toHaveBeenCalledWith(
      { methodId: 1, method: { ref_id: 1, code: 'standard', price: '0.00' } },
      expect.anything(),
    );
    const popup = (name: string, data: Record<string, unknown>) => {
      const alias = LEGACY_EVENTS[name]!;
      return alias.when && !alias.when(data) ? 'skipped' : (alias.data?.(data, next.getState()) ?? data);
    };
    const click = { source: 'exit_intent', image_url: 'x.png' };
    const used = { source: 'exit_intent', template: 'exit', action: 'apply-coupon', coupon_code: 'EXIT10' };
    expect([popup('exit-intent:clicked', click), popup('exit-intent:clicked', used)]).toEqual([
      { imageUrl: 'x.png', template: undefined },
      'skipped',
    ]);
    expect(popup('exit-intent:action', used)).toEqual({
      imageUrl: undefined,
      template: 'exit',
      action: 'apply-coupon',
      couponCode: 'EXIT10',
    });
    expect(
      ['dismissed', 'closed'].map((reason) =>
        popup('exit-intent:dismissed', { source: 'exit_intent', template: 'exit', reason }),
      ),
    ).toEqual([{ imageUrl: undefined, template: 'exit' }, 'skipped']);
  });

  it('lets page scripts listen to one tracking event by its GA4 name', async () => {
    const next = boot(config, Promise.resolve(campaign));
    const views: string[] = [];
    next.analytics.on('page_view', (e) => views.push(e.name));
    await vi.waitFor(() => expect(views).toEqual(['page_view']));
    const all: string[] = [];
    next.analytics.on('*', (e) => all.push(e.name));
    expect(all).toContain('page_view');
  });

  it('lets page scripts listen to analytics events under GA4 names, including ones sent before they listened', async () => {
    const warn = vi.spyOn(console, 'warn');
    const next = boot(config, Promise.resolve(campaign));
    const early: string[] = [];
    next.on('analytics', (e) => void early.push(e.name));
    await vi.waitFor(() => expect(early).toContain('page_view'));
    const late: string[] = [];
    next.on('analytics', (e) => void late.push(e.name));
    expect(late).toEqual(early);
    expect(warn).not.toHaveBeenCalled();
  });

  it('lets page scripts quiet the console and read the log stream', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const next = boot(config, Promise.resolve(campaign));
    const streamed: string[] = [];
    next.log.stream((e) => streamed.push(e.message));
    next.log.level = 'silent';
    next.on('nope:event' as never, vi.fn());
    expect(warn).not.toHaveBeenCalled();
    expect(streamed).toEqual(['next.on: unknown event "nope:event"']);
    expect(next.log.entries().at(-1)).toMatchObject({ level: 'warn', message: 'next.on: unknown event "nope:event"' });
  });

  it('keeps old clearCart and swapCart working the way the variant picker uses them', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await next.actions.applyCoupon('SAVE10');
    await next.addItem({ packageId: 1 });
    await next.clearCart();
    expect(next.getState().cart.coupons).toEqual(['SAVE10']);
    await next.swapCart([{ packageId: 2, quantity: 2 }]);
    expect(next.getState().cart.groups).toEqual({ items: { lines: [{ packageId: 2, quantity: 2 }], vouchers: [] } });
  });

  it('reveals a receipt only after its order has loaded', async () => {
    vi.stubGlobal('fetch', fakeApi({ delays: [50] }).fetch);
    history.replaceState(null, '', '/receipt/?ref_id=R1');
    document.body.innerHTML = `<div data-next-order-items><div class="line">{item.name}</div></div>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    expect(document.documentElement.hasAttribute('data-next-ready')).toBe(false);
    await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
    expect(next.getState().order?.status).toBe('ready');
    expect(document.querySelector('.line')!.textContent).toBe('Earbuds');
  });

  it('lets page scripts set a cart group and hear about upsells', async () => {
    const warn = vi.spyOn(console, 'warn');
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    next.on('upsell.accepted', vi.fn());
    await next.actions.setGroup('gift', { lines: [{ packageId: 9, quantity: 1 }] });
    expect(next.getState().cart.groups.gift?.lines).toEqual([{ packageId: 9, quantity: 1 }]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('binds the checkout chunk on a checkout page', async () => {
    document.body.innerHTML = `<form data-next-checkout="form"><input data-next-checkout-field="email"></form>`;
    const form = document.querySelector('form')!;
    boot(config, Promise.resolve(campaign));
    await vi.waitFor(() => expect(form.noValidate).toBe(true));
  });

  it('removes the old SDK’s plain-text personal-data cookie', () => {
    document.cookie = 'next_user_data=%7B%22email%22%3A%22a%40b.c%22%7D; path=/';
    boot(config, Promise.resolve(campaign));
    expect(document.cookie).not.toContain('next_user_data');
  });

  it('clears storage once on ?reset=1 and removes it from the URL', async () => {
    const first = boot(config, Promise.resolve(campaign));
    await first.actions.addItem(1);
    history.replaceState(null, '', '/lp?reset=1&utm_source=fb');
    const next = boot({ ...config, reset: true }, Promise.resolve(campaign));
    expect(next.getState().cart.groups).toEqual({});
    expect(location.search).toBe('?utm_source=fb');
  });
});
