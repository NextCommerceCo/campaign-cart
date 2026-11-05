import { afterEach, describe, expect, it, vi } from 'vitest';
import { readDestinations, startDestinations } from '../../src/analytics/destinations';
import type { Engine } from '../../src/engine/engine';
import { flush } from '../fixtures/engine';

const { startGa4, startMeta, startRudderStack } = vi.hoisted(() => ({
  startGa4: vi.fn(),
  startMeta: vi.fn(),
  startRudderStack: vi.fn(),
}));
vi.mock('../../src/destinations/ga4', () => ({ startGa4 }));
vi.mock('../../src/destinations/meta', () => ({ startMeta }));
vi.mock('../../src/destinations/rudderstack', () => ({ startRudderStack }));

const win = window as Window & { nextConfig?: unknown };
const configure = (destinations: object) => (win.nextConfig = { analytics: { destinations } });

describe('readDestinations', () => {
  afterEach(() => delete win.nextConfig);

  it('sends to GTM only by default', () => {
    expect(readDestinations()).toEqual({ gtm: true, ga4: false, meta: false, rudderstack: false });
  });

  it('takes nextConfig.analytics.destinations', () => {
    configure({
      gtm: { enabled: false },
      ga4: { enabled: true },
      meta: { enabled: true, storeName: 'shop' },
      rudderstack: { enabled: true },
    });
    expect(readDestinations()).toEqual({ gtm: false, ga4: true, meta: true, rudderstack: true, storeName: 'shop' });
  });

  it('follows the 0.4.x options', () => {
    expect(readDestinations({ dataLayer: false })).toMatchObject({ gtm: false });
    expect(readDestinations({ meta: true, storeName: 'legacy' })).toEqual({
      gtm: true,
      ga4: false,
      meta: true,
      rudderstack: false,
      storeName: 'legacy',
    });
    expect(readDestinations({ rudderstack: true })).toMatchObject({ rudderstack: true });
  });

  it('lets nextConfig.analytics.destinations override the 0.4.x options', () => {
    configure({ gtm: { enabled: true }, meta: { enabled: false, storeName: 'shop' }, rudderstack: { enabled: false } });
    expect(readDestinations({ dataLayer: false, meta: true, rudderstack: true, storeName: 'legacy' })).toEqual({
      gtm: true,
      ga4: false,
      meta: false,
      rudderstack: false,
      storeName: 'shop',
    });
  });
});

describe('startDestinations', () => {
  const engine = {} as Engine;
  afterEach(() => vi.clearAllMocks());

  it('loads and starts each destination that is on', async () => {
    startDestinations(
      engine,
      { gtm: true, ga4: true, meta: true, rudderstack: true, storeName: 'shop' },
      { apiKey: 'pk' },
    );
    await vi.waitFor(() => {
      expect(startGa4).toHaveBeenCalledWith(engine);
      expect(startMeta).toHaveBeenCalledWith(engine, { storeName: 'shop' });
      expect(startRudderStack).toHaveBeenCalledWith(engine, { apiKey: 'pk' });
    });
  });

  it('starts none that is off', async () => {
    startDestinations(engine, { gtm: true, ga4: false, meta: true, rudderstack: false });
    await vi.waitFor(() => expect(startMeta).toHaveBeenCalledWith(engine, { storeName: undefined }));
    await flush();
    expect(startGa4).not.toHaveBeenCalled();
    expect(startRudderStack).not.toHaveBeenCalled();

    startDestinations(engine, { gtm: true, ga4: false, meta: false, rudderstack: false });
    await flush();
    expect(startMeta).toHaveBeenCalledTimes(1);
  });
});
