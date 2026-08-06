/**
 * URL utility functions for checkout forms
 */

import { preserveQueryParams } from '@/core/url-utils';

/**
 * The parameters that survive onto the URLs the orders API sends the shopper
 * back to, so a debugging session is not lost the moment a payment gateway takes
 * over the page.
 *
 * A redirect payment leaves the site entirely — PayPal, or a bank's 3-D Secure
 * step — and comes back through `success_url` or `payment_failed_url`. Those two
 * are built here and handed to the API, so nothing on the client gets a say in
 * them: without this the return leg always boots with debugging off, which is the
 * half of the journey hardest to reproduce any other way.
 *
 * **An explicit list, deliberately, not `preserveQueryParams`'s default of
 * `'all'`.** These two URLs are not an in-site navigation: they go to the orders
 * API as part of the order payload, so they carry only what the return leg needs
 * rather than whatever the session happens to have captured. Widening this list
 * widens the order payload — change it on purpose, not by switching to `'all'`.
 *
 * `debugger` also re-arms test mode on the page that receives it, because
 * `TestModeManager.checkUrlTestMode` reads the same parameter — expected, and the
 * reason `test` is not on this list: it would put a page into test mode from a URL
 * the shopper never chose.
 */
const DEBUG_PARAMS = ['debug', 'debugger'];

/** The parameters above, copied from the current URL onto an outbound one. */
function withDebugParams(url: string): string {
  return preserveQueryParams(url, DEBUG_PARAMS);
}

export function getSuccessUrl(): string {
  // Check for meta tag first (support both new and legacy names)
  const metaTag = document.querySelector('meta[name="next-success-url"]') as HTMLMetaElement ||
                 document.querySelector('meta[name="next-next-url"]') as HTMLMetaElement ||
                 document.querySelector('meta[name="os-next-page"]') as HTMLMetaElement;

  if (metaTag?.content) {
    // Check if it's already an absolute URL
    if (metaTag.content.startsWith('http://') || metaTag.content.startsWith('https://')) {
      return withDebugParams(metaTag.content);
    }
    // Convert to absolute URL if it's a relative path
    // Add leading slash if not present for relative paths
    const path = metaTag.content.startsWith('/') ? metaTag.content : '/' + metaTag.content;
    return withDebugParams(window.location.origin + path);
  }

  // Fallback to default success page
  return withDebugParams(window.location.origin + '/success');
}

export function getFailureUrl(): string {
  // Check for meta tag first (support both new and legacy names)
  const metaTag = document.querySelector('meta[name="next-failure-url"]') as HTMLMetaElement ||
                 document.querySelector('meta[name="os-failure-url"]') as HTMLMetaElement;

  if (metaTag?.content) {
    // Check if it's already an absolute URL
    if (metaTag.content.startsWith('http://') || metaTag.content.startsWith('https://')) {
      return withDebugParams(metaTag.content);
    }
    // Convert to absolute URL if it's a relative path
    // Add leading slash if not present for relative paths
    const path = metaTag.content.startsWith('/') ? metaTag.content : '/' + metaTag.content;
    return withDebugParams(window.location.origin + path);
  }

  // Fallback to current checkout page with error parameters. This branch already
  // carries the whole current query string, debug parameters included, because it
  // is built from the page's own URL.
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('payment_failed', 'true');
  return currentUrl.href;
}
