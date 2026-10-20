export const API_BASE = 'https://campaigns.apps.29next.com';

export interface BootConfig {
  apiKey: string;
  apiBase: string;
  funnel: string;
  currency?: string;
  debug: boolean;
  reset: boolean;
}

interface LegacyConfig {
  apiKey?: string;
  funnel?: string;
}

const meta = (doc: Document, name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
const nextConfig = (win: Window) => ((win as unknown as { nextConfig?: LegacyConfig }).nextConfig ?? {}) as LegacyConfig;

/** @deprecated Put the key on the script tag: `data-campaign="pk_…"`. */
export function legacyApiKey(doc: Document, win: Window): string {
  return nextConfig(win).apiKey || meta(doc, 'next-api-key');
}

/** @deprecated Put the funnel on the script tag: `data-funnel="…"`. */
export function legacyFunnel(doc: Document, win: Window): string {
  return nextConfig(win).funnel || meta(doc, 'next-funnel');
}

/** @deprecated Use `?debug=1` and `?reset=1`. */
export function legacyFlags(params: URLSearchParams): { debug: boolean; reset: boolean } {
  return { debug: params.get('debugger') === 'true', reset: params.get('reset') === 'true' };
}

export function readConfig(doc: Document, win: Window): BootConfig {
  const script = doc.querySelector('script[data-campaign]');
  const params = new URLSearchParams(win.location.search);
  const legacy = legacyFlags(params);
  return {
    apiKey: script?.getAttribute('data-campaign') || legacyApiKey(doc, win),
    apiBase: API_BASE,
    funnel: script?.getAttribute('data-funnel') || legacyFunnel(doc, win),
    currency: params.get('currency') || undefined,
    debug: params.get('debug') === '1' || legacy.debug,
    reset: params.get('reset') === '1' || legacy.reset,
  };
}

export function campaignUrl(base: string, currency?: string): string {
  return `${base}/api/v1/campaigns/${currency ? `?currency=${encodeURIComponent(currency)}` : ''}`;
}
