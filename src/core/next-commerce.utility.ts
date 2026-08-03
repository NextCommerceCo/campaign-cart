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

export function getVersion(): string {
  // Return the runtime detected version from loader, or fallback to build version
  if (typeof window !== 'undefined' && window.__NEXT_SDK_VERSION__) {
    return window.__NEXT_SDK_VERSION__;
  }
  return __VERSION__; // Replaced at build time with the package.json version
}

export function formatPrice(amount: number, currency?: string): string {
  const { formatCurrency } = require('@/core/currency-formatter');
  const campaignStore = useCampaignStore.getState();
  const useCurrency = currency ?? campaignStore.currency ?? 'USD';

  return formatCurrency(amount, useCurrency);
}

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
