import { afterEach, describe, expect, it, vi } from 'vitest';
import { readDestinations, startDestinations } from '../../src/analytics/destinations';
import type { Engine } from '../../src/engine/engine';
import { flush } from '../fixtures/engine';

const { startGa4, startMeta } = vi.hoisted(() => ({ startGa4: vi.fn(), startMeta: vi.fn() }));
vi.mock('../../src/destinations/ga4', () => ({ startGa4 }));
vi.mock('../../src/destinations/meta', () => ({ startMeta }));

const win = window as Window & { nextConfig?: unknown };
const configure = (destinations: object) => (win.nextConfig = { analytics: { destinations } });

describe('readDestinations', () => {
  afterEach(() => delete win.nextConfig);

  it('sends to GTM only by default', () => {
    expect(readDestinations()).toEqual({ gtm: true, ga4: false, meta: false });
  });

  it('takes nextConfig.analytics.destinations', () => {
    configure({ gtm: { enabled: false }, ga4: { enabled: true }, meta: { enabled: true, storeName: 'shop' } });
    expect(readDestinations()).toEqual({ gtm: false, ga4: true, meta: true, storeName: 'shop' });
  });

  it('follows the 0.4.x options', () => {
    expect(readDestinations({ dataLayer: false })).toMatchObject({ gtm: false });
    expect(readDestinations({ meta: true, storeName: 'legacy' })).toEqual({
      gtm: true,
      ga4: false,
      meta: true,
      storeName: 'legacy',
    });
  });

  it('lets nextConfig.analytics.destinations override the 0.4.x options', () => {
    configure({ gtm: { enabled: true }, meta: { enabled: false, storeName: 'shop' } });
    expect(readDestinations({ dataLayer: false, meta: true, storeName: 'legacy' })).toEqual({
      gtm: true,
      ga4: false,
      meta: false,
      storeName: 'shop',
    });
  });
});

describe('startDestinations', () => {
  const engine = {} as Engine;
  afterEach(() => vi.clearAllMocks());

  it('loads and starts each destination that is on', async () => {
    startDestinations(engine, { gtm: true, ga4: true, meta: true, storeName: 'shop' });
    await vi.waitFor(() => {
      expect(startGa4).toHaveBeenCalledWith(engine);
      expect(startMeta).toHaveBeenCalledWith(engine, { storeName: 'shop' });
    });
  });

  it('starts none that is off', async () => {
    startDestinations(engine, { gtm: true, ga4: false, meta: true });
    await vi.waitFor(() => expect(startMeta).toHaveBeenCalledWith(engine, { storeName: undefined }));
    await flush();
    expect(startGa4).not.toHaveBeenCalled();

    startDestinations(engine, { gtm: true, ga4: false, meta: false });
    await flush();
    expect(startMeta).toHaveBeenCalledTimes(1);
  });
});
