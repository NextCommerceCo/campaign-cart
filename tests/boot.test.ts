import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../src/config';
import { boot, type NextApi } from '../src/boot';
import { createCheckout } from '../src/checkout/state/checkout';
import type { TrackingEvent } from '../src/engine/events/analytics';
import { funnelFromPath, storageScope } from '../src/engine/scope';
import type { Campaign } from '../src/engine/types';
import { fakeApi, json } from './fixtures/api';
import { campaign } from './fixtures/campaign';
import { flush, makeEngine } from './fixtures/engine';
import { fakeRules } from './fixtures/rules';

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

  it('runs a nextReady callback pushed after the page is ready at once, with window.next', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const late = vi.fn();

    (window as unknown as { nextReady: { push(fn: unknown): void } }).nextReady.push(late);

    expect(late).toHaveBeenCalledWith(next);
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

  it('loads the order on any page with ?ref_id, as 0.4.x did, so a plain thank-you page reports it', async () => {
    history.replaceState(null, '', '/thank-you/?ref_id=R1');
    const api = fakeApi();
    vi.stubGlobal('fetch', api.fetch);
    const next = boot(config, Promise.resolve(campaign));
    const paid = vi.fn();
    next.on('order.paid', (data) => paid(data));
    await vi.waitFor(() => expect(paid).toHaveBeenCalledTimes(1));
    expect(paid.mock.calls[0]![0]).toMatchObject({ ref_id: 'R1' });
    history.replaceState(null, '', '/');
  });

  it('gives a page script that listens once the page is up the events it missed, and of 0.4.x names only those 0.4.x pages heard late', async () => {
    history.replaceState(null, '', '/thank-you/?ref_id=R1');
    const seen: Record<string, string[]> = { loaded: [], paid: [], all: [], ready: [], legacy: [] };
    const listen = (next: NextApi) => {
      next.on('order.loaded', (data) => seen.loaded!.push(data.ref_id));
      next.on('order.paid', (data) => seen.paid!.push(data.ref_id));
      next.on('*', (_, e) => seen.all!.push(e.event_type));
      next.on('ready', (_, e) => seen.ready!.push(e.event_type));
      next.on('sdk:url-parameters-processed' as never, () => seen.legacy!.push('sdk:url-parameters-processed'));
      next.on('order:completed' as never, () => seen.legacy!.push('order:completed'));
    };
    (window as unknown as { nextReady: unknown[] }).nextReady = [listen];
    boot(config, Promise.resolve(campaign));
    await vi.waitFor(() => expect(seen.paid).toEqual(['R1']));
    expect(seen).toEqual({
      loaded: ['R1'],
      paid: ['R1'],
      all: ['sdk.ready', 'order.loaded', 'order.paid'],
      ready: ['sdk.ready'],
      legacy: ['sdk:url-parameters-processed'],
    });
  });

  it('sends payment.failed for the gateway order when a failed payment comes back without a ref_id', async () => {
    const api = fakeApi({
      order: () => json({ ref_id: 'R1', payment_complete_url: 'https://pay.test/R1' }),
      getOrder: () => json({ message: 'Not found' }, 400),
    });
    const { engine } = makeEngine({
      fetch: api.fetch,
      local: localStorage,
      session: sessionStorage,
      storagePrefix: `next:${storageScope(config.apiKey, funnelFromPath('/checkout/'))}`,
    });
    await engine.start();
    await engine.cart.addItem(1);
    const checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, fakeRules().api));
    ['email', 'first_name', 'last_name'].forEach((f, i) =>
      checkout.setField(f, ['jane@example.com', 'Jane', 'Doe'][i]!),
    );
    const pageUrl = `${location.origin}/checkout/`;
    await checkout.placeOrder({ expressMethod: 'paypal', failureUrl: `${pageUrl}?payment_failed=true`, pageUrl });

    history.replaceState(null, '', '/checkout/?payment_failed=true&payment_method=paypal');
    vi.stubGlobal('fetch', api.fetch);
    const next = boot(config, Promise.resolve(campaign));
    const failed = vi.fn();
    next.on('payment.failed', (data) => failed(data));
    await vi.waitFor(() =>
      expect(failed).toHaveBeenCalledWith({ method: 'paypal', ref_id: 'R1', error: { code: 'payment_failed' } }),
    );
    expect(Object.values(next.getState().cart.groups).flatMap((g) => g.lines)).toHaveLength(1);
    expect(api.calls.filter((c) => c.method === 'GET' && c.url.includes('/orders/'))).toHaveLength(0);
  });

  it('takes payment_failed and payment_method off the URL once read, so a reload after a retry sends nothing', async () => {
    const storagePrefix = `next:${storageScope(config.apiKey, funnelFromPath('/checkout/'))}`;
    const pending = async (pendingRef: string, pendingMethod: string) => {
      const { engine } = makeEngine({ local: localStorage, session: sessionStorage, storagePrefix });
      await engine.start();
      engine.attach((ctx) => ctx.update('checkout', { pendingRef, pendingMethod }));
    };
    await pending('R1', 'paypal');
    history.replaceState(null, '', '/checkout/?payment_failed=true&payment_method=paypal&utm_source=fb#form');
    const next = boot(config, Promise.resolve(campaign));
    const failed = vi.fn();
    next.on('payment.failed', (data) => failed(data));
    await vi.waitFor(() => expect(failed).toHaveBeenCalledWith(expect.objectContaining({ ref_id: 'R1' })));
    expect(`${location.search}${location.hash}`).toBe('?utm_source=fb#form');
    expect(next.getState().visit.params).toMatchObject({ payment_failed: 'true', payment_method: 'paypal' });

    await pending('R2', 'klarna');
    const reloaded = boot(config, Promise.resolve(campaign));
    await flush();
    await flush();
    const again = vi.fn();
    reloaded.on('payment.failed', again);
    expect(again).not.toHaveBeenCalled();
  });

  it('marks the page when the campaign cannot load, even with a snapshot', async () => {
    boot(config, Promise.resolve(campaign));
    await flush();
    boot(config, Promise.reject(new Error('down')));
    await flush();
    expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true);
    expect(document.documentElement.getAttribute('data-next-error')).toBe('campaign');
  });

  it('gives a listener added after a failed campaign load that sdk.error', async () => {
    const next = boot(config, Promise.reject(new Error('down')));
    await flush();
    const error = vi.fn();
    next.on('sdk.error', error);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ action: 'campaign.load' }), expect.anything());
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
      { selectorId: 'main', items: [{ packageId: 2, quantity: 1 }] },
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
    const snapshot = {
      campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
      cart: expect.objectContaining({ lines: expect.any(Array), currency: 'USD' }),
      selectors: [],
    };
    expect(ready).toHaveBeenCalledWith(snapshot, {
      event_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      event_type: 'sdk.ready',
      object: 'sdk',
      data: snapshot,
      created_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      session_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      sdk_version: expect.any(String),
    });
    const session = ready.mock.calls[0]![1].session_id;
    expect(document.cookie).toContain(`ncsid=${session}`);
    expect(next.context()).toEqual({
      page_location: location.origin + location.pathname,
      page_title: document.title,
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
    await vi.waitFor(() => expect(shipping).toHaveBeenCalledTimes(1));
    expect(cart.mock.calls.map(([data]) => data.isCalculating)).not.toContain(true);
    expect(cart.mock.calls.at(-1)![0]).toMatchObject({
      items: [{ packageId: 1, quantity: 1, title: 'Earbuds ×1', total: '49.00' }],
      totalQuantity: 1,
      isEmpty: false,
      vouchers: [],
      shippingMethod: { id: 1, code: 'standard' },
    });
    expect(cart.mock.calls.at(-1)![0].total.toNumber()).toBe(49);
    expect(shipping).toHaveBeenCalledWith(
      { methodId: 1, method: { ref_id: 1, code: 'standard', price: '0.00' } },
      expect.anything(),
    );
  });

  it('fires 0.4.x checkout:started on each checkout page, for a script that listens once the page is up', async () => {
    history.replaceState(null, '', '/checkout/?forcePackageId=2:1');
    document.body.innerHTML = `<form data-next-checkout="form"><input data-next-checkout-field="email"></form>`;
    const started: unknown[] = [];
    const page = () => {
      (window as unknown as { nextReady: unknown[] }).nextReady = [
        (next: NextApi) => next.on('checkout:started' as never, (data) => started.push(data)),
      ];
      boot(config, Promise.resolve(campaign));
    };
    page();
    await vi.waitFor(() => expect(started).toHaveLength(1));
    await flush();
    expect(started).toHaveLength(1);
    history.replaceState(null, '', '/checkout/');
    page();
    await vi.waitFor(() => expect(started).toHaveLength(2));
    expect(started[1]).toEqual({
      formData: expect.any(Object),
      paymentMethod: 'credit-card',
      isProcessing: false,
      step: 1,
    });
  });

  it('fires 0.4.x checkout:payment-ready once the card fields are ready', async () => {
    class NextPayment {
      onReady = () => {};
      constructor() {
        queueMicrotask(() => this.onReady());
      }
      destroy() {}
    }
    vi.stubGlobal('NextPayment', NextPayment);
    document.body.innerHTML = `<form data-next-checkout="form"><input data-next-checkout-field="email">
      <div data-next-checkout-field="cc-number"></div><div data-next-checkout-field="cvv"></div></form>`;
    const ready: unknown[] = [];
    (window as unknown as { nextReady: unknown[] }).nextReady = [
      (next: NextApi) => {
        next.on('checkout:payment-ready' as never, (data) => ready.push(data));
        next.on('checkout:spreedly-ready' as never, (data) => ready.push(data));
      },
    ];
    boot(config, Promise.resolve({ ...campaign, payment_env_key: 'env_test' }));
    await vi.waitFor(() => expect(ready).toEqual([{}, {}]));
    expect(document.querySelector('form')!.classList).not.toContain('next-loading-spreedly');
  });

  it('sends no checkout:payment-ready when the card fields cannot load', async () => {
    document.body.innerHTML = `<form data-next-checkout="form"><input data-next-checkout-field="email">
      <div data-next-checkout-field="cc-number"></div><div data-next-checkout-field="cvv"></div></form>`;
    const form = document.querySelector('form')!;
    const next = boot(config, Promise.resolve({ ...campaign, payment_env_key: 'env_test' }));
    const ready = vi.fn();
    next.on('checkout:payment-ready' as never, ready);
    await vi.waitFor(() => expect(form.noValidate).toBe(true));
    await vi.waitFor(() => expect(form.classList).not.toContain('next-loading-spreedly'));
    await flush();
    expect(ready).not.toHaveBeenCalled();
  });

  it('lets page scripts listen to one tracking event by name, in the SDK event envelope', async () => {
    document.title = 'Olympus Earbuds';
    const next = boot(config, Promise.resolve(campaign));
    const views: TrackingEvent[] = [];
    next.analytics.on('page_viewed', (e) => views.push(e));
    await vi.waitFor(() => expect(views.map((e) => e.event_type)).toEqual(['page_viewed']));
    expect(views[0]).toEqual({
      event_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      event_type: 'page_viewed',
      object: 'page',
      data: {},
      created_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT.*Z$/),
      session_id: next.context().session_id,
      sdk_version: next.version,
      context: expect.objectContaining({
        page_title: 'Olympus Earbuds',
        page_location: location.origin + location.pathname,
      }),
    });
    const all: string[] = [];
    next.analytics.on('*', (e) => all.push(e.event_type));
    expect(all).toContain('page_viewed');
  });

  it('keeps the SDK’s internal events off next.on: tracking events come through next.analytics.on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const next = boot(config, Promise.resolve(campaign));
    const early: string[] = [];
    next.on('*', (_, e) => early.push(e.event_type));
    const tracked = vi.fn();
    next.on('analytics' as never, tracked);
    const views: string[] = [];
    next.analytics.on('page_viewed', (e) => views.push(e.event_type));
    await vi.waitFor(() => expect(views).toEqual(['page_viewed']));
    const late: string[] = [];
    next.on('*', (_, e) => late.push(e.event_type));
    expect(early).toContain('sdk.ready');
    expect(early.filter((name) => name === 'campaign.loaded' || name === 'analytics')).toEqual([]);
    expect(late).toEqual(early);
    expect(tracked).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([['[next] next.on: unknown event "analytics"']]);
  });

  it('shows what the page shows now through next.snapshot(), the same objects the events carry', async () => {
    document.body.innerHTML = `<div data-next-bundle-selector data-next-selector-id="main">
      <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'></div></div>`;
    const next = boot(config, Promise.resolve(campaign));
    const calculated = vi.fn();
    next.on('cart.calculated', calculated);
    await next.actions.addItem(2);
    await vi.waitFor(() => expect(next.getState().cart.calculating).toBe(false));
    const snapshot = next.snapshot();
    expect(snapshot).toEqual({
      campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
      cart: calculated.mock.calls.at(-1)![0],
      selectors: [expect.objectContaining({ selector_id: 'main', option_id: 'one' })],
    });
    expect(snapshot.campaign).toEqual(next.context().campaign);
  });

  it('reads the object model through next.query and next.watch once their code loads, as data-next-query does', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
    const seen = vi.fn();
    next.watch('cart.quantity', seen);
    next.define('Cart', 'doubled', (c: { quantity: number }) => c.quantity * 2);
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith(0));
    await next.actions.addItem(1, 2);
    await flush();
    expect(await next.query('cart.quantity')).toBe(2);
    expect(await next.query('cart.doubled')).toBe(4);
    expect(await next.query('package.2.price')).toBe(89);
    expect(seen.mock.calls.map(([v]) => v)).toEqual([0, 2]);
  });

  it('takes one object of field names on every action, and the 0.5 positional calls still', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
    expect(await next.actions.addItem({ items: '1x2' })).toEqual({ ok: true });
    expect(await next.actions.setQuantity({ package_id: 1, quantity: '+1' })).toEqual({ ok: true });
    expect(await next.query('cart.quantity')).toBe(3);
    expect(await next.actions.applyCoupon('nope')).toBe(false);
    await next.actions.removeItem(1);
    expect(await next.query('cart.quantity')).toBe(0);
    expect(await next.actions.addItem({})).toMatchObject({ ok: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await (next.actions as unknown as Record<string, () => Promise<unknown>>).nope!()).toMatchObject({
      ok: false,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown action "nope"'), ...[]);
  });

  it('loads attributes v2 for a page that has one, and binds it before the page is ready', async () => {
    document.body.innerHTML = `
      <div data-next-selector="main"><div data-next-option="one" data-next-items="1" data-next-selected>
        <span id="price" data-next-query="total"></span></div></div>
      <p id="saved" data-next-show="cart.quantity > 0">In your cart</p>
      <p id="old" data-next-show="cart.hasItems">Old</p>`;
    boot(config, Promise.resolve(campaign));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
    await vi.waitFor(() => expect(document.querySelector('#price')!.textContent).toBe('$49.00'));
    expect(document.querySelector<HTMLElement>('#saved')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('#old')!.style.display).toBe('');
  });

  it('accepts a v2 offer on a page opened with ?ref_id, and announces it like a 0.4.x offer', async () => {
    history.replaceState(null, '', '/upsell/?ref_id=R1');
    vi.stubGlobal('IntersectionObserver', undefined);
    document.body.innerHTML = `<div data-next-option="offer" data-next-items="9">
      <span id="offer-price" data-next-query="total"></span>
      <button id="yes" data-next-action="acceptUpsell">Yes</button></div>`;
    const next = boot(config, Promise.resolve(campaign));
    const seen: string[] = [];
    next.on('*', (_, e) => void seen.push(e.event_type));
    await vi.waitFor(() => expect(document.querySelector('#offer-price')!.textContent).toBe('$4.50'));
    await vi.waitFor(() => expect(seen).toContain('upsell.viewed'));
    document.querySelector<HTMLElement>('#yes')!.click();
    await vi.waitFor(() => expect(seen).toContain('upsell.accepted'));
    expect(await next.query('order.lines.1.upsell')).toBe(true);
  });

  it('leaves legacy pages without v2 markup on the 0.4.x bindings alone', async () => {
    document.body.innerHTML = `<span data-next-display="cart.total"></span><p data-next-show="cart.hasItems">x</p>`;
    const imports = vi.spyOn(console, 'warn').mockImplementation(() => {});
    boot(config, Promise.resolve(campaign));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true));
    expect(imports).not.toHaveBeenCalled();
    expect(document.querySelector('p')!.hasAttribute('hidden')).toBe(false);
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
    await next.addItem({ packageId: 1 });
    await next.actions.applyCoupon('SAVE10');
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
