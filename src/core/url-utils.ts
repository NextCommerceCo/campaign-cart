/**
 * URL Utilities
 * Helper functions for URL manipulation and parameter preservation
 */

import { useParameterStore } from '@/state/parameter';

/**
 * Query parameters that describe **this page load**, not this visitor, and so are
 * never copied onto an outbound URL.
 *
 * `preserveQueryParams` defaults to `'all'` and every in-site navigation the SDK
 * performs goes through it, so a parameter seen once follows the shopper for the
 * rest of the session. That is what attribution wants (`utm_*`, `affid`), and the
 * upsell chain depends on it too: `accept-upsell.handlers.ts` never appends
 * `ref_id` itself, it relies on arriving this way. It is wrong for a one-shot
 * signal:
 *
 * - `payment_failed` is written by the SDK onto its own default failure URL
 *   (`checkout/utils/url-utils.ts` › `getFailureUrl`) and read back as a veto on
 *   `dl_purchase` (`analytics/tracking/purchase-tracking.ts` ›
 *   `isPaymentFailureLanding`). Carried forward, a cancelled PayPal attempt
 *   suppressed the purchase event of the card order that followed it, silently —
 *   [issue #90](https://github.com/NextCommerceCo/campaign-cart/issues/90).
 * - `payment_method` is written by the platform on that same return leg. The SDK
 *   never reads it from a URL, and it describes one payment attempt.
 * - `forcePackageId`, `forceShippingId` and `forceBundleId` are commands, run at
 *   boot. `forcePackageId` empties the cart before it runs
 *   (`sdk-initializer.url-params.ts` › `processForcePackageId`), so carrying it
 *   from a lander to the checkout wipes what the shopper put in.
 * - `reset` clears storage at boot and already strips itself from the address bar
 *   (`sdk-initializer.ts` › `loadConfiguration`). It is listed here so the policy
 *   has one home rather than living in that one `delete`.
 *
 * Capture is deliberately left alone: the parameter store still records these, so
 * a `data-next-show="param.payment_failed"` block on the failure page — the only
 * way a merchant can explain a declined payment — still works.
 */
export const NON_PROPAGATING_PARAMS: readonly string[] = [
  'payment_failed',
  'payment_method',
  'forcePackageId',
  'forceShippingId',
  'forceBundleId',
  'reset',
];

/**
 * Preserves query parameters when navigating
 * @param targetUrl - The URL to navigate to
 * @param preserveParams - Array of parameter names to preserve, or 'all' to preserve all stored parameters (defaults to 'all')
 * @returns The URL with preserved parameters
 */
export function preserveQueryParams(
  targetUrl: string,
  preserveParams: string[] | 'all' = 'all'
): string {
  try {
    // Parse the target URL
    const url = new URL(targetUrl, window.location.origin);

    if (preserveParams === 'all') {
      // Get stored parameters from parameter store (persisted across page navigations)
      const paramStore = useParameterStore.getState();
      const storedParams = paramStore.params;

      // Also get current URL params (in case there are new ones not yet captured)
      const currentParams = new URLSearchParams(window.location.search);
      const currentParamsObj: Record<string, string> = {};
      currentParams.forEach((value, key) => {
        currentParamsObj[key] = value;
      });

      // Update parameter store with any new current URL params
      if (Object.keys(currentParamsObj).length > 0) {
        paramStore.mergeParams(currentParamsObj);
      }

      // Merge: current URL params take priority over stored ones (most recent)
      const allParams = { ...storedParams, ...currentParamsObj };

      // Apply all parameters to the target URL (don't override existing params in target)
      Object.entries(allParams).forEach(([key, value]) => {
        if (NON_PROPAGATING_PARAMS.includes(key)) return;
        if (!url.searchParams.has(key)) {
          url.searchParams.append(key, value);
        }
      });
    } else {
      // Preserve only specified parameters (from current URL)
      const currentParams = new URLSearchParams(window.location.search);
      preserveParams.forEach(param => {
        const value = currentParams.get(param);
        if (value && !url.searchParams.has(param)) {
          url.searchParams.append(param, value);
        }
      });
    }

    return url.href;
  } catch (error) {
    console.error('[URL Utils] Error preserving query parameters:', error);
    // Return original URL if parsing fails
    return targetUrl;
  }
}

/**
 * Navigate to a URL while preserving debug parameters
 * @param url - The URL to navigate to
 * @param options - Navigation options
 */
export function navigateWithParams(
  url: string,
  options?: { replace?: boolean; preserveParams?: string[] }
): void {
  const finalUrl = preserveQueryParams(url, options?.preserveParams);

  if (options?.replace) {
    window.location.replace(finalUrl);
  } else {
    window.location.href = finalUrl;
  }
}

/**
 * Check if debug mode is active (verbose logging)
 * @returns true if enabled via URL params or window.nextConfig
 */
export function isDebugMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  const windowConfig = (window as any).nextConfig;
  return (
    params.get('debug') === 'true' ||
    params.get('debugger') === 'true' ||
    windowConfig?.debug === true ||
    windowConfig?.debugger === true
  );
}

/**
 * Check if the debug overlay (debugger UI) is active
 * @returns true if enabled via URL params or window.nextConfig
 */
export function isDebuggerMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  const windowConfig = (window as any).nextConfig;
  return params.get('debugger') === 'true' || windowConfig?.debugger === true;
}
