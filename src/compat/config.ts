import type { NextConfig } from './legacy/globals';

const meta = (doc: Document, name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
/** `legacy/globals.ts`' `nextConfig` for the loader, which shares no module with boot. */
const nextConfig = (win: Window): NextConfig => (win as { nextConfig?: NextConfig }).nextConfig ?? {};

/** @deprecated Put the key on the script tag: `data-campaign="pk_…"`. */
export function legacyApiKey(doc: Document, win: Window): string {
  return nextConfig(win).apiKey || meta(doc, 'next-api-key');
}

/** @deprecated Put the funnel on the script tag: `data-funnel="…"`. The 0.4.x tracking tag `funnel_name` names it too. */
export function legacyFunnel(doc: Document, win: Window): string {
  const tag = doc.querySelector('meta[name$="tracking-tag"][data-tag-name="funnel_name"]');
  return nextConfig(win).funnel || meta(doc, 'next-funnel') || tag?.getAttribute('data-tag-value') || '';
}

/**
 * @deprecated `nextConfig.currencyBehavior`: a 0.4.x page gets the visitor's currency unless it says `'manual'`,
 * the 0.4.x default. Put it on the script tag: `data-currency="auto"`.
 */
export function legacyAutoCurrency(doc: Document, win: Window): boolean {
  const config = (win as { nextConfig?: NextConfig }).nextConfig;
  return (!!config || !!meta(doc, 'next-api-key')) && config?.currencyBehavior !== 'manual';
}

/** @deprecated Use `?debug=1` and `?reset=1`. */
export function legacyFlags(params: URLSearchParams): { debug: boolean; reset: boolean } {
  const debug = params.get('debugger') === 'true' || params.get('debug') === 'true';
  return { debug, reset: params.get('reset') === 'true' };
}

const sanitize = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');

/** `hash` of `engine/visit/scope`, copied: the loader shares no module with boot. */
const fnv1a = (value: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
};

/**
 * @deprecated 0.4.x's `visitor_id__<scope>`: scope = `nextConfig.storageScope`, else `<meta name="next-storage-scope">`,
 * else fnv1a(key + "\n" + first folder of a page two folders deep); bare `visitor_id` with none.
 */
export function legacyVisitorKey(doc: Document, win: Window, apiKey: string): string {
  const configured = nextConfig(win).storageScope;
  const segments = win.location.pathname.split('/').filter(Boolean);
  const scope =
    (typeof configured === 'string' && sanitize(configured)) ||
    sanitize(meta(doc, 'next-storage-scope')) ||
    (apiKey && fnv1a(`${apiKey}\n${segments.length > 1 ? sanitize(segments[0]!) : ''}`));
  return scope ? `visitor_id__${scope}` : 'visitor_id';
}

/** @deprecated 0.4.x's visitor id, which pages read from localStorage as Meta's `external_id`: the campaign session id. */
export function keepLegacyVisitorId(doc: Document, win: Window, apiKey: string, sessionId: string): void {
  try {
    win.localStorage.setItem(legacyVisitorKey(doc, win, apiKey), sessionId);
  } catch {}
}

declare const __VERSION__: string;

/** @deprecated The 0.4.x loader created `window.dataLayer`; pages that push to it early keep working. */
export function legacyGlobals(win: Window): void {
  (win as unknown as { dataLayer?: unknown[] }).dataLayer ??= [];
}

/** @deprecated `window` event `next:ready`, fired when the SDK code has loaded. Use `next.on('sdk.ready')`. */
export function announceLegacyLoaded(win: Window): void {
  win.dispatchEvent(new CustomEvent('next:ready', { detail: { version: __VERSION__, mode: 'production' } }));
}
