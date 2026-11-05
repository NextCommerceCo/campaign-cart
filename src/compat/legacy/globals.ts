import type { Logger } from '../../engine/log';

interface LegacyAnalyticsConfig {
  enabled?: boolean;
  providers?: Record<string, { enabled?: boolean } | undefined>;
}

export interface LegacyAnalytics {
  enabled: boolean;
  nextCampaign: boolean;
  dataLayer: boolean;
  unsupported: string[];
}

/** @deprecated `nextConfig.analytics`. GTM reads `dataLayer`; other vendors use GTM or the page's forwarder. */
export function readLegacyAnalytics(): LegacyAnalytics {
  const config = (window as unknown as { nextConfig?: { analytics?: LegacyAnalyticsConfig } }).nextConfig?.analytics;
  const providers = config?.providers ?? {};
  return {
    enabled: config?.enabled !== false,
    nextCampaign: providers.nextCampaign?.enabled !== false,
    dataLayer: providers.gtm?.enabled !== false,
    unsupported: ['facebook', 'rudderstack', 'custom'].filter((name) => providers[name]?.enabled),
  };
}

/** @deprecated {@link readLegacyAnalytics}, warning once for each provider that is no longer built in. */
export function legacyAnalytics(log: Logger): LegacyAnalytics {
  const analytics = readLegacyAnalytics();
  for (const name of analytics.unsupported)
    log.warn(`analytics provider "${name}" is no longer built in; send it through GTM or a forwarder`);
  return analytics;
}

/** @deprecated Removes the old SDK's plain-text personal-data cookie and stored profile. */
export function removeLegacyPersonalData(): void {
  document.cookie = 'next_user_data=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  try {
    localStorage.removeItem('nextDataLayer_userProperties');
  } catch {}
}
