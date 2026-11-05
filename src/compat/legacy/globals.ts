import type { Logger } from '../../engine/log';

interface LegacyAnalyticsConfig {
  enabled?: boolean;
  providers?: Record<string, { enabled?: boolean } | undefined>;
}

export interface LegacyAnalytics {
  enabled: boolean;
  nextCampaign: boolean;
  dataLayer: boolean;
  /** `providers.facebook`: the Meta destination. */
  meta: boolean;
  /** `providers.rudderstack`: the RudderStack destination. */
  rudderstack: boolean;
  /** `nextConfig.storeName`, for Meta's `Purchase` event id. */
  storeName?: string;
  unsupported: string[];
}

/** @deprecated `nextConfig.analytics`. GTM reads `dataLayer`; other vendors use GTM or the page's forwarder. */
export function readLegacyAnalytics(): LegacyAnalytics {
  const next = (window as unknown as { nextConfig?: { analytics?: LegacyAnalyticsConfig; storeName?: string } })
    .nextConfig;
  const config = next?.analytics;
  const providers = config?.providers ?? {};
  return {
    enabled: config?.enabled !== false,
    nextCampaign: providers.nextCampaign?.enabled !== false,
    dataLayer: providers.gtm?.enabled !== false,
    meta: providers.facebook?.enabled === true,
    rudderstack: providers.rudderstack?.enabled === true,
    ...(next?.storeName && { storeName: next.storeName }),
    unsupported: ['custom'].filter((name) => providers[name]?.enabled),
  };
}

/** @deprecated {@link readLegacyAnalytics}, warning once for each provider that is not built in. */
export function legacyAnalytics(log: Logger): LegacyAnalytics {
  const analytics = readLegacyAnalytics();
  for (const name of analytics.unsupported)
    log.warn(
      `analytics provider "${name}" is not built in: send events to your endpoint from next.analytics.on("*", fn)`,
    );
  return analytics;
}

/** @deprecated Removes the old SDK's plain-text personal-data cookie and stored profile. */
export function removeLegacyPersonalData(): void {
  document.cookie = 'next_user_data=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  try {
    localStorage.removeItem('nextDataLayer_userProperties');
  } catch {}
}
