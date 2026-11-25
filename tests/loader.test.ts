import { afterAll, describe, expect, it, vi } from 'vitest';
import type { NextApi } from '../src/boot';
import { campaign } from './fixtures/campaign';
import { flush } from './fixtures/engine';

afterAll(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('loader', () => {
  it('links the 0.4.x stylesheet beside itself and keeps the old globals and event', async () => {
    document.head.innerHTML = '<script data-campaign="pk_test"></script>';
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(campaign)));
    const loaded = vi.fn();
    window.addEventListener('next:ready', loaded);
    await import('../src/loader');
    const css = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]');
    expect(css?.href).toMatch(/\/src\/campaign-cart\.css$/);
    expect((window as unknown as { nextReady: unknown }).nextReady).toBeDefined();
    await vi.waitFor(() => expect(loaded).toHaveBeenCalled());
    await vi.waitFor(() => expect((window as unknown as { NextDataLayer?: unknown[] }).NextDataLayer).toBeDefined());
    await flush();
  });

  it.each([
    ['a refused key as auth, with its status', { status: 401 }, { code: 'auth', status: 401 }],
    ['no answer as network', undefined, { code: 'network' }],
  ])('reports %s when the campaign request fails', async (_, answer, expected) => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    const win = window as unknown as { next?: NextApi };
    delete win.next;
    let settle!: () => void;
    const request = new Promise<Response>((resolve, reject) => {
      settle = () => (answer ? resolve(new Response(null, answer)) : reject(new TypeError('Failed to fetch')));
    });
    vi.stubGlobal('fetch', () => request);
    await import('../src/loader');
    await vi.waitFor(() => expect(win.next).toBeDefined());
    const error = vi.fn();
    win.next!.on('sdk.error', error);
    settle();
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(error.mock.calls[0]![0]).toEqual({ action: 'campaign.load', ...expected, message: expect.any(String) });
  });

  it('has the 0.4.x visitor id in localStorage before ready callbacks, with analytics off', async () => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    const win = window as unknown as { next?: NextApi; nextReady?: unknown[]; nextConfig?: unknown };
    delete win.next;
    win.nextConfig = { analytics: { enabled: false } };
    document.head.innerHTML = '<script data-campaign="pk_test"></script>';
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(campaign)));
    const atReady = vi.fn();
    win.nextReady = [() => atReady(localStorage.getItem('visitor_id__q38pip'))];
    await import('../src/loader');
    await vi.waitFor(() => expect(atReady).toHaveBeenCalled());
    expect(atReady.mock.calls[0]![0]).toMatch(/^visitor_[0-9a-z]+_[0-9a-z]{1,9}$/);
    delete win.nextConfig;
    await flush();
  });

  it('asks the campaign for the visitor’s currency with data-currency="auto"', async () => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    delete (window as unknown as { next?: NextApi }).next;
    document.head.innerHTML = '<script data-campaign="pk_test" data-currency="auto"></script>';
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(String(url));
      return new Response(JSON.stringify(String(url).includes('/v1/geo') ? { currency: 'CAD' } : campaign));
    });
    await import('../src/loader');
    await vi.waitFor(() => expect(urls.some((u) => u.includes('/api/v1/campaigns/'))).toBe(true));
    expect(urls.slice(0, 2)).toEqual([
      'https://i18n-rules.nextcommerce.com/v1/geo',
      'https://campaigns.apps.29next.com/api/v1/campaigns/?currency=CAD',
    ]);
    const win = window as unknown as { next?: NextApi };
    await vi.waitFor(() => expect(win.next).toBeDefined());
    expect(win.next!.getState().currency).toBe('CAD');
    await flush();
  });

  describe('the tab’s currency', () => {
    const open = async (search: string, head = '<script data-campaign="pk_test"></script>', answers = 'CAD,EUR') => {
      vi.resetModules();
      localStorage.clear();
      delete (window as unknown as { next?: NextApi }).next;
      history.replaceState(null, '', `/lp/${search}`);
      document.head.innerHTML = head;
      const urls: string[] = [];
      vi.stubGlobal('fetch', async (url: string) => {
        urls.push(String(url));
        if (String(url).includes('/v1/geo')) return new Response(JSON.stringify({ currency: 'GBP' }));
        const asked = new URL(url).searchParams.get('currency') ?? '';
        return new Response(JSON.stringify({ ...campaign, currency: answers.includes(asked) ? asked : 'USD' }));
      });
      await import('../src/loader');
      const win = window as unknown as { next?: NextApi };
      await vi.waitFor(() => expect(win.next?.getState().campaign).toBeDefined());
      await flush();
      return urls.filter((u) => !u.includes('/v1/geo') && u.includes('/api/v1/campaigns/'))[0];
    };
    const asked = (currency?: string) =>
      `https://campaigns.apps.29next.com/api/v1/campaigns/${currency ? `?currency=${currency}` : ''}`;

    afterAll(() => history.replaceState(null, '', '/'));

    it('keeps ?currency= for a page opened without it in the same tab, and a new one replaces it', async () => {
      sessionStorage.clear();
      expect(await open('?currency=CAD')).toBe(asked('CAD'));
      expect(await open('')).toBe(asked('CAD'));
      expect(await open('?currency=EUR')).toBe(asked('EUR'));
      expect(await open('')).toBe(asked('EUR'));
      sessionStorage.clear();
      expect(await open('')).toBe(asked());
    });

    it('keeps a ?currency= choice over the visitor’s currency', async () => {
      sessionStorage.clear();
      const auto = '<script data-campaign="pk_test" data-currency="auto"></script>';
      expect(await open('', auto)).toBe(asked('GBP'));
      expect(await open('?currency=CAD', auto)).toBe(asked('CAD'));
      expect(await open('', auto)).toBe(asked('CAD'));
    });

    it('keeps the campaign’s answer for a currency it does not sell in', async () => {
      sessionStorage.clear();
      expect(await open('?currency=JPY')).toBe(asked('JPY'));
      expect((window as unknown as { next: NextApi }).next.getState().campaign!.currency).toBe('USD');
      expect(await open('')).toBe(asked('USD'));
    });
  });
});
