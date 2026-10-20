import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../src/config';
import { boot } from '../src/core';
import { campaign, fakeApi, flush } from './fixtures';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-next-ready');
  localStorage.clear();
  history.replaceState(null, '', '/');
});

describe('boot', () => {
  it('reads the key and funnel from the script tag, then old config as fallback', () => {
    document.head.innerHTML = `<script data-campaign="pk_live_1" data-funnel="helloweenA"></script>`;
    expect(readConfig(document, window)).toMatchObject({ apiKey: 'pk_live_1', funnel: 'helloweenA' });
    document.head.innerHTML = `<meta name="next-api-key" content="pk_old"><meta name="next-funnel" content="f1">`;
    expect(readConfig(document, window)).toMatchObject({ apiKey: 'pk_old', funnel: 'f1' });
  });

  it('starts a forced cart, exposes window.next and fires next:initialized', async () => {
    history.replaceState(null, '', '/lp/checkout?forcePackageId=2:1');
    const api = fakeApi();
    vi.stubGlobal('fetch', api.fetch);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    document.body.innerHTML = `<span id="total" data-next-display="cart.total"></span>`;
    const initialized = vi.fn();
    document.addEventListener('next:initialized', initialized);
    const queued = vi.fn();
    (window as unknown as { nextReady: unknown[] }).nextReady = [queued];

    const { next } = boot(
      { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: '', debug: false, reset: false },
      Promise.resolve(campaign),
    );
    await flush();
    await flush();

    expect(next.getState().cart.groups.items?.lines).toEqual([{ packageId: 2, quantity: 1 }]);
    expect(document.querySelector('#total')!.textContent).toBe('$89.00');
    expect(document.documentElement.hasAttribute('data-next-ready')).toBe(true);
    expect(initialized).toHaveBeenCalledTimes(1);
    expect(queued).toHaveBeenCalledWith(next);
    expect((window as unknown as { next: unknown }).next).toBe(next);
    vi.unstubAllGlobals();
  });
});
