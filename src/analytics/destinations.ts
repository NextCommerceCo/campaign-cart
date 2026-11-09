import { startLegacyDataLayer } from '../compat/analytics';
import type { LegacyAnalytics } from '../compat/legacy/globals';
import type { Engine } from '../engine/engine';
import type { EngineEvent } from '../engine/events/bus';

type Switch = { enabled?: boolean } | undefined;

interface DestinationsConfig {
  gtm?: Switch;
  ga4?: Switch;
  meta?: Switch & { storeName?: string };
  rudderstack?: Switch;
}

/** Where tracking events go: each built-in destination, on or off. */
export interface Destinations {
  gtm: boolean;
  ga4: boolean;
  meta: boolean;
  rudderstack: boolean;
  storeName?: string;
}

/** `nextConfig.analytics.destinations`, over what the 0.4.x options asked for. GTM is on unless turned off. */
export function readDestinations(
  legacy: Partial<Pick<LegacyAnalytics, 'dataLayer' | 'meta' | 'rudderstack' | 'storeName'>> = {},
) {
  const win = window as unknown as { nextConfig?: { analytics?: { destinations?: DestinationsConfig } } };
  const config = win.nextConfig?.analytics?.destinations ?? {};
  const storeName = config.meta?.storeName ?? legacy.storeName;
  const destinations: Destinations = {
    gtm: config.gtm?.enabled ?? legacy.dataLayer !== false,
    ga4: config.ga4?.enabled === true,
    meta: config.meta?.enabled ?? legacy.meta === true,
    rudderstack: config.rudderstack?.enabled ?? legacy.rudderstack === true,
    ...(storeName && { storeName }),
  };
  return destinations;
}

/**
 * Starts the `dl_*` data layer, which is always on (`gtm` only decides `window.dataLayer`), and loads the
 * chunk of each other destination that is on; one that is off never loads. Returns the data layer's
 * exit-intent handler, for the caller to run in event order.
 */
export function startDestinations(
  engine: Engine,
  destinations: Destinations,
  options: { apiKey: string; version: string },
): (e: EngineEvent) => void {
  const exitIntent = startLegacyDataLayer(engine, { ...options, dataLayer: destinations.gtm });
  if (destinations.ga4) void import('../destinations/ga4').then((m) => m.startGa4(engine));
  if (destinations.meta)
    void import('../destinations/meta').then((m) => m.startMeta(engine, { storeName: destinations.storeName }));
  if (destinations.rudderstack)
    void import('../destinations/rudderstack').then((m) => m.startRudderStack(engine, { apiKey: options.apiKey }));
  return exitIntent;
}
