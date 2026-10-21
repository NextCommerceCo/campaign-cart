import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../src/config';
import { boot } from '../src/core';
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

  it('maps old next.on names to the new events and passes the payload', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = `<div data-next-bundle-selector data-next-selector-id="main">
      <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'></div>
      <div id="two" data-next-bundle-card data-next-bundle-id="two" data-next-bundle-items='[{"packageId":2,"quantity":1}]'></div></div>`;
    const next = boot(config, Promise.resolve(campaign));
    const changed = vi.fn();
    next.on('bundle:selection-changed' as never, changed);
    next.on('fomo:shown' as never, vi.fn());
    document.querySelector<HTMLElement>('#two')!.click();
    expect(changed).toHaveBeenCalledWith(
      { selectorId: 'main', cardId: 'two', items: [{ packageId: 2, quantity: 1 }] },
      expect.anything(),
    );
    expect(warn).toHaveBeenCalledWith('[next] next.on: unknown event "fomo:shown"');
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
