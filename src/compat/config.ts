import type { NextConfig } from './legacy/globals';

const meta = (doc: Document, name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
/** `legacy/globals.ts`' `nextConfig` for the loader, which shares no module with boot. */
const nextConfig = (win: Window): NextConfig => (win as { nextConfig?: NextConfig }).nextConfig ?? {};

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

/** @deprecated The 0.4.x loader created `window.dataLayer`; pages that push to it early keep working. */
export function legacyGlobals(win: Window): void {
  (win as unknown as { dataLayer?: unknown[] }).dataLayer ??= [];
}

/** @deprecated `window` event `next:ready`, fired when the SDK code has loaded. Use `next.on('sdk.ready')`. */
export function announceLegacyLoaded(win: Window): void {
  win.dispatchEvent(new CustomEvent('next:ready', { detail: { version: __VERSION__, mode: 'production' } }));
}
