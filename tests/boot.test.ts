import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../src/config';
import { boot } from '../src/core';
import type { Campaign } from '../src/engine/types';
import { campaign, fakeApi, flush } from './fixtures';

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
    (window as unknown as { nextReady: unknown[] }).nextReady = [() => { throw new Error('page bug'); }, queued];
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

  it('marks the page when the campaign cannot load and there is no snapshot', async () => {
    boot(config, Promise.reject(new Error('down')));
    await flush();
    expect(document.documentElement.getAttribute('data-next-error')).toBe('campaign');
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
