import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../src/boot';
import { fakeApi } from './fixtures/api';
import { campaign } from './fixtures/campaign';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('debug panel', () => {
  it('opens with ?debug=1 and shows state, events and the storage scope', async () => {
    vi.stubGlobal('fetch', fakeApi().fetch);
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const next = boot(
      { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: 'f1', debug: true, reset: false },
      Promise.resolve(campaign),
    );
    await vi.waitFor(() => expect(document.querySelector('.next-debug__toggle')).not.toBeNull());
    await next.actions.addItem(1);
    document.querySelector<HTMLElement>('.next-debug__toggle')!.click();
    const pre = () => document.querySelector('.next-debug pre')!.textContent!;
    expect(JSON.parse(pre()).cart.groups.items.lines).toEqual([{ packageId: 1, quantity: 1 }]);
    document.querySelector<HTMLElement>('[data-tab="events"]')!.click();
    expect(pre()).toContain('cart.updated');
    document.querySelector<HTMLElement>('[data-tab="storage"]')!.click();
    expect(pre()).toContain('funnel  f1');
  });
});
