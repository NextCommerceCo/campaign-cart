import { useConfigStore } from '@/state/config';
import { useCampaignStore } from '@/state/campaign';
import { DataLayerEvent } from '../types';

/**
 * Forward the campaign_* identifiers stamped on the event by DataLayerManager
 * (issue #473) onto the RudderStack payload, keeping their snake_case names.
 * Empty values omitted.
 */
export function buildContextProps(
  event: DataLayerEvent
): Record<string, string> {
  const keys = [
    'campaign_name',
    'campaign_api_key',
    'campaign_currency',
    'campaign_language',
    'campaign_id',
    'campaign_session_id',
  ];
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = (event as Record<string, any>)[key];
    if (value !== undefined && value !== null && value !== '') {
      out[key] = String(value);
    }
  }
  return out;
}

/**
 * Resolve the page type and a human page name.
 *
 * `pageType` comes from the config store (set from `meta[name="next-page-type"]`
 * / `window.nextConfig`, default `product`) — the canonical source, so it is
 * never `unknown` on a configured page. `pageName` has no dedicated field in
 * the SDK: an optional `meta[name="next-page-name"]` wins, otherwise the
 * document title, falling back to the page type. Empty strings are treated as
 * absent so a value is always returned.
 */
export function getPageMetadata(): { pageType: string; pageName: string } {
  let pageType = '';
  try {
    pageType = useConfigStore.getState().pageType || '';
  } catch {
    // Store unavailable (SSR/tests) — fall back to the meta tag.
    pageType =
      document
        .querySelector('meta[name="next-page-type"]')
        ?.getAttribute('content') || '';
  }
  if (!pageType) pageType = 'unknown';

  const pageNameMeta = document
    .querySelector('meta[name="next-page-name"]')
    ?.getAttribute('content');
  const pageName = pageNameMeta || document.title || pageType;

  return { pageType, pageName };
}

/**
 * Get campaign data from event or SDK
 */
export function getCampaignData(data: any): any {
  // Explicit values on the event win.
  if (data?.campaignName) {
    return {
      campaignName: data.campaignName,
      campaignApiKey: data.campaignApiKey || '',
      campaignCurrency: data.campaignCurrency || 'USD',
      campaignLanguage: data.campaignLanguage || '',
    };
  }

  // Read the stores directly. They are populated when the campaign loads and
  // are available before the `window.next` global is set, so these fields are
  // not empty just because a page view fired early in init.
  try {
    const campaign = useCampaignStore.getState().data;
    if (campaign) {
      return {
        campaignName: campaign.name || '',
        campaignApiKey: useConfigStore.getState().apiKey || '',
        campaignCurrency: campaign.currency || 'USD',
        campaignLanguage: campaign.language || '',
      };
    }
  } catch {
    // Stores unavailable (SSR/tests) — fall back to the window.next SDK global.
  }

  // Last resort: the public SDK global.
  if (typeof window !== 'undefined' && (window as any).next) {
    const sdk = (window as any).next;
    const campaignData = sdk.getCampaignData?.();
    if (campaignData) {
      return {
        campaignName: campaignData.name || '',
        campaignApiKey:
          (window as any).nextDebug?.stores?.config?.getState()?.apiKey || '',
        campaignCurrency: campaignData.currency || 'USD',
        campaignLanguage: campaignData.language || '',
      };
    }
  }

  return {
    campaignName: '',
    campaignApiKey: '',
    campaignCurrency: 'USD',
    campaignLanguage: '',
  };
}
