import { afterAll, describe, expect, it, vi } from 'vitest';
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
});
