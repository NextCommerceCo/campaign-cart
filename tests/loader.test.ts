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
});
