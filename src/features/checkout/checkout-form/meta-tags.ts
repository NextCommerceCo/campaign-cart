/**
 * Where the checkout sends the visitor next, written as `<meta>` tags.
 *
 * A page normally declares its success and failure destinations in its own HTML. This is
 * the programmatic door to the same thing — `next.setSuccessUrl(...)` on a page that
 * decides its destination at runtime (a split test, a per-offer thank-you page) — and it
 * works by writing the very tags the page would otherwise have carried, so **the rest of
 * the SDK reads one source either way**.
 *
 * Each destination has more than one accepted tag name: the current `next-` spelling, the
 * `os-` spelling from the previous SDK, and for success an intermediate `next-next-url`.
 * Every name for a destination is written, because a page may have been built against any
 * of them and whichever the reader looks for has to be there.
 *
 * Timing is the one trap: the redirect is resolved when the order completes, so a URL set
 * any time before that wins over the markup. Setting it *after* the order has completed
 * changes nothing — the browser has already been sent.
 *
 * Extracted from `checkout-form.enhancer.ts`; the public `setSuccessUrl` / `setFailureUrl`
 * methods now delegate here. It needs nothing from the form — hence the plain arguments
 * rather than a context object.
 */

import { setOrCreateMetaTag } from '../utils/meta-tag-utils';

/**
 * Points every success-URL meta tag at `url`.
 *
 * Writes all three accepted names — `next-success-url`, `next-next-url` and the legacy
 * `os-next-page` — so the reader finds it whichever it was built to look for.
 *
 * @example
 * ```ts
 * applySuccessUrlMetaTags('/thank-you/');
 * // <meta name="next-success-url" content="/thank-you/">
 * // <meta name="next-next-url" content="/thank-you/">
 * // <meta name="os-next-page" content="/thank-you/">
 * ```
 */
export function applySuccessUrlMetaTags(url: string): void {
  setOrCreateMetaTag('next-success-url', url);
  setOrCreateMetaTag('next-next-url', url);
  setOrCreateMetaTag('os-next-page', url);
}

/**
 * Points every failure-URL meta tag at `url` — where a declined payment goes back to.
 *
 * @example
 * ```ts
 * applyFailureUrlMetaTags('/checkout/?failed=1');
 * // <meta name="next-failure-url" content="/checkout/?failed=1">
 * // <meta name="os-failure-url" content="/checkout/?failed=1">
 * ```
 */
export function applyFailureUrlMetaTags(url: string): void {
  setOrCreateMetaTag('next-failure-url', url);
  setOrCreateMetaTag('os-failure-url', url);
}
