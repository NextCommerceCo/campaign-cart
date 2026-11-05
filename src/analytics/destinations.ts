import type { Engine } from '../engine/engine';
import type { LegacyAnalytics } from '../compat/legacy/globals';

type Switch = { enabled?: boolean } | undefined;

interface DestinationsConfig {
  gtm?: Switch;
  ga4?: Switch;
  meta?: Switch & { storeName?: string };
}

/** Where tracking events go: each built-in destination, on or off. */
export interface Destinations {
  gtm: boolean;
  ga4: boolean;
  meta: boolean;
  storeName?: string;
}

/** `nextConfig.analytics.destinations`, over what the 0.4.x options asked for. GTM is on unless turned off. */
export function readDestinations(legacy: Partial<Pick<LegacyAnalytics, 'dataLayer' | 'meta' | 'storeName'>> = {}) {
  const win = window as unknown as { nextConfig?: { analytics?: { destinations?: DestinationsConfig } } };
  const config = win.nextConfig?.analytics?.destinations ?? {};
  const storeName = config.meta?.storeName ?? legacy.storeName;
  const destinations: Destinations = {
    gtm: config.gtm?.enabled ?? legacy.dataLayer !== false,
    ga4: config.ga4?.enabled === true,
    meta: config.meta?.enabled ?? legacy.meta === true,
    ...(storeName && { storeName }),
  };
  return destinations;
}

/** Loads the chunk of each destination that is on; one that is off never loads. */
export function startDestinations(engine: Engine, destinations: Destinations): void {
  if (destinations.ga4) void import('../destinations/ga4').then((m) => m.startGa4(engine));
  if (destinations.meta)
    void import('../destinations/meta').then((m) => m.startMeta(engine, { storeName: destinations.storeName }));
}
