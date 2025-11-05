/**
 * URL Utilities
 * Helper functions for URL manipulation and parameter preservation
 */

import { useParameterStore } from '@/stores/parameterStore';

/**
 * Preserves query parameters when navigating
 * @param targetUrl - The URL to navigate to
 * @param preserveParams - Array of parameter names to preserve, or 'all' to preserve all stored parameters (defaults to 'all')
 * @returns The URL with preserved parameters
 */
export function preserveQueryParams(targetUrl: string, preserveParams: string[] | 'all' = 'all'): string {
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
export function navigateWithParams(url: string, options?: { replace?: boolean; preserveParams?: string[] }): void {
  const finalUrl = preserveQueryParams(url, options?.preserveParams);
  
  if (options?.replace) {
    window.location.replace(finalUrl);
  } else {
    window.location.href = finalUrl;
  }
}

/**
 * Check if debug mode is active
 * @returns true if debug mode is enabled via URL parameters
 */
export function isDebugMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === 'true' || params.get('debugger') === 'true';
}