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
const nextConfig = (win: Window) =>
  ((win as unknown as { nextConfig?: LegacyConfig }).nextConfig ?? {}) as LegacyConfig;
const scriptAttr = (doc: Document, name: string) => doc.querySelector(`script[${name}]`)?.getAttribute(name) ?? '';

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
  const debug = params.get('debugger') === 'true' || params.get('debug') === 'true';
  return { debug, reset: params.get('reset') === 'true' };
}

declare const __VERSION__: string;

/** @deprecated The 0.4.x loader created `window.nextReady` and `window.dataLayer`; pages that push to them early keep working. */
export function legacyGlobals(win: Window): void {
  const globals = win as unknown as { nextReady?: unknown[]; dataLayer?: unknown[] };
  globals.nextReady ??= [];
  globals.dataLayer ??= [];
}

/** @deprecated `window` event `next:ready`, fired when the SDK code has loaded. Use `next.on('ready')`. */
export function announceLegacyLoaded(win: Window): void {
  win.dispatchEvent(new CustomEvent('next:ready', { detail: { version: __VERSION__, mode: 'production' } }));
}

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
