/**
 * `NextCommerce`'s Utility category — extracted verbatim from
 * `next-commerce.ts`. None of these read instance state (`this`).
 */

import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';

declare global {
  interface Window {
    __NEXT_SDK_VERSION__?: string;
  }
}

/**
 * The resolved SDK version (runtime loader value if present, else build-time).
 * @category Utility
 */
export function getVersion(): string {
  // Return the runtime detected version from loader, or fallback to build version
  if (typeof window !== 'undefined' && window.__NEXT_SDK_VERSION__) {
    return window.__NEXT_SDK_VERSION__;
  }
  return __VERSION__; // Replaced at build time with the package.json version
}

/**
 * Formats an amount using the campaign currency (or an override), e.g. `$19.99`.
 * @category Utility
 */
export function formatPrice(amount: number, currency?: string): string {
  const { formatCurrency } = require('@/core/currency-formatter');
  const campaignStore = useCampaignStore.getState();
  const useCurrency = currency ?? campaignStore.currency ?? 'USD';

  return formatCurrency(amount, useCurrency);
}

/**
 * Lightweight pre-checkout validation (currently: cart must not be empty).
 * @category Utility
 */
export function validateCheckout(): { valid: boolean; errors: string[] } {
  const cartStore = useCartStore.getState();
  const errors: string[] = [];

  if (cartStore.items.length === 0) {
    errors.push('Cart is empty');
  }

  // Add more validation logic as needed

  return {
    valid: errors.length === 0,
    errors,
  };
}
