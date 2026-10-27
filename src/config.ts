import { legacyApiKey, legacyFlags, legacyFunnel } from './compat/config';

export const API_BASE = 'https://campaigns.apps.29next.com';

export interface BootConfig {
  apiKey: string;
  apiBase: string;
  funnel: string;
  currency?: string;
  debug: boolean;
  reset: boolean;
}

const scriptAttr = (doc: Document, name: string) => doc.querySelector(`script[${name}]`)?.getAttribute(name) ?? '';

export function readConfig(doc: Document, win: Window): BootConfig {
  const params = new URLSearchParams(win.location.search);
  const legacy = legacyFlags(params);
  return {
    apiKey: scriptAttr(doc, 'data-campaign') || legacyApiKey(doc, win),
    apiBase: API_BASE,
    funnel: scriptAttr(doc, 'data-funnel') || legacyFunnel(doc, win),
    currency: params.get('currency') || undefined,
    debug: params.get('debug') === '1' || legacy.debug,
    reset: params.get('reset') === '1' || legacy.reset,
  };
}

export function campaignUrl(base: string, currency?: string): string {
  return `${base}/api/v1/campaigns/${currency ? `?currency=${encodeURIComponent(currency)}` : ''}`;
}
