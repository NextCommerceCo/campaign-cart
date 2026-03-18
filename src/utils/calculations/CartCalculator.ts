/**
 * CartCalculator - standalone utility for calling the calculate API and
 * transforming the response into CartTotals.
 *
 * Useful for:
 * - Cart total calculation (used by cartStore)
 * - Bundle price preview (send arbitrary items without touching the cart)
 * - Voucher recalculation (pass updated vouchers, get new totals back)
 */

import type { CartCalculateSummary, CartSummary, LineWithUpsell } from '@/types/api';
import type { CartTotals } from '@/types/global';
import { formatCurrency, formatPercentage } from '@/utils/currencyFormatter';
import { sessionStorageManager } from '@/utils/storage';

// ─── Bundle price cache ───────────────────────────────────────────────────────

const BUNDLE_PRICE_CACHE_PREFIX = 'next-bundle-price-';
/** Default TTL matches the campaign cache (10 minutes). */
const BUNDLE_PRICE_CACHE_TTL_MS = 10 * 60 * 1000;

export interface BundlePriceItem {
  packageId: number;
  quantity: number;
}

export interface BundlePriceOptions {
  vouchers?: string[];
  currency?: string | null;
  shippingMethod?: number;
  /** Cache TTL in milliseconds. Defaults to 10 minutes. Pass 0 to skip cache. */
  ttl?: number;
  /** When true, shipping is excluded from the returned total. Default false. */
  exclude_shipping?: boolean;
}

interface CachedBundlePrice {
  result: CalculateCartResult;
  expiresAt: number;
}

async function bundleCacheKey(
  items: BundlePriceItem[],
  currency?: string | null,
  vouchers?: string[],
  apiKey?: string,
): Promise<string> {
  const data = JSON.stringify({
    items: [...items].sort((a, b) => a.packageId - b.packageId),
    currency: currency ?? null,
    vouchers: vouchers ? [...vouchers].sort() : [],
    apiKey: apiKey ?? '',
  });
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const hex = Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
  return BUNDLE_PRICE_CACHE_PREFIX + hex;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CalculateCartParams {
  lines: LineWithUpsell[];
  vouchers?: string[];
  currency?: string | null;
  shippingMethod?: number;
  exclude_shipping?: boolean;
}

export interface CalculateCartResult {
  totals: CartTotals;
  summary: CartSummary;
}

/**
 * Call the /calculate API with arbitrary lines and return totals + raw summary.
 * Lazily imports ApiClient and configStore to avoid circular dependencies.
 */
export async function calculateCart(
  params: CalculateCartParams
): Promise<CalculateCartResult> {
  const { ApiClient } = await import('@/api/client');
  const { useConfigStore } = await import('@/stores/configStore');

  const client = new ApiClient(useConfigStore.getState().apiKey);

  const cartData: CartCalculateSummary = {
    lines: params.lines,
    vouchers: params.vouchers,
    currency: params.currency ?? null,
    shipping_method: params.shippingMethod,
  };

  const summary = await client.calculateSummary(cartData);

  return { totals: buildCartTotals(summary, { exclude_shipping: params.exclude_shipping }), summary };
}

/**
 * Calculate the price for a set of bundle items and cache the result in
 * sessionStorage.
 *
 * - Subsequent calls with the same items + currency return the cached result
 *   without hitting the API (10-minute TTL by default).
 * - Pass `ttl: 0` to bypass the cache entirely.
 * - The cache key is derived from the sorted packageId/quantity pairs so that
 *   item order does not matter.
 */
export async function calculateBundlePrice(
  items: BundlePriceItem[],
  options: BundlePriceOptions = {}
): Promise<CalculateCartResult> {
  const { useConfigStore } = await import('@/stores/configStore');
  const apiKey = useConfigStore.getState().apiKey;
  const ttl = options.ttl ?? BUNDLE_PRICE_CACHE_TTL_MS;
  const cacheKey = await bundleCacheKey(items, options.currency, options.vouchers, apiKey);

  if (ttl > 0) {
    const cached = sessionStorageManager.get<CachedBundlePrice>(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
  }

  const lines: LineWithUpsell[] = items.map(item => ({
    package_id: item.packageId,
    quantity: item.quantity,
  }));

  const result = await calculateCart({
    lines,
    vouchers: options.vouchers,
    currency: options.currency,
    shippingMethod: options.shippingMethod,
    exclude_shipping: options.exclude_shipping,
  });

  if (ttl > 0) {
    sessionStorageManager.set<CachedBundlePrice>(cacheKey, {
      result,
      expiresAt: Date.now() + ttl,
    });
  }

  return result;
}

/**
 * Evict a specific bundle's cached price (e.g. after a coupon is applied).
 */
export async function clearBundlePriceCache(items: BundlePriceItem[], currency?: string | null, apiKey?: string): Promise<void> {
  sessionStorageManager.remove(await bundleCacheKey(items, currency, undefined, apiKey));
}

/**
 * Transform a raw CartSummary API response into a CartTotals object.
 * Pure function – no side effects, easy to test.
 */
export function buildCartTotals(
  response: CartSummary,
  options?: { exclude_shipping?: boolean; compareTotal?: number }
): CartTotals {
  const subtotal = parseFloat(response.subtotal);
  const total = parseFloat(response.total);
  const discount = parseFloat(response.total_discount);

  const shippingPrice = parseFloat(response.shipping_method?.price ?? '0');
  const shippingOriginalPrice = parseFloat(response.shipping_method?.original_price ?? '0');
  const shippingDiscount = shippingOriginalPrice > shippingPrice
    ? shippingOriginalPrice - shippingPrice
    : 0;

  const effectiveTotal = options?.exclude_shipping ? total - shippingPrice : total;

  // compareTotal: use provided retail/compare-at total when available (e.g. from
  // campaign package price_retail fields), otherwise fall back to the undiscounted
  // campaign subtotal so savings only reflects coupon/offer discounts.
  const compareTotal = options?.compareTotal ?? subtotal;
  const retailSavings = Math.max(0, compareTotal - subtotal);
  const totalSavingsValue = Math.max(0, compareTotal - effectiveTotal);
  const savingsPercentage = compareTotal > 0 ? (retailSavings / compareTotal) * 100 : 0;
  const totalSavingsPercentage = compareTotal > 0 ? (totalSavingsValue / compareTotal) * 100 : 0;
  const hasSavings = retailSavings > 0;
  const hasTotalSavings = totalSavingsValue > 0;

  const count = response.lines.reduce((sum, line) => sum + line.quantity, 0);
  const isEmpty = response.lines.length === 0;

  return {
    subtotal: { value: subtotal, formatted: formatCurrency(subtotal) },
    shipping: {
      value: shippingPrice,
      formatted: shippingPrice === 0 ? 'FREE' : formatCurrency(shippingPrice),
    },
    shippingDiscount: {
      value: shippingDiscount,
      formatted: formatCurrency(shippingDiscount),
    },
    tax: { value: 0, formatted: formatCurrency(0) },
    discounts: { value: discount, formatted: formatCurrency(discount) },
    total: { value: effectiveTotal, formatted: formatCurrency(effectiveTotal) },
    totalExclShipping: {
      value: total - shippingPrice,
      formatted: formatCurrency(total - shippingPrice),
    },
    count,
    isEmpty,
    compareTotal: { value: compareTotal, formatted: formatCurrency(compareTotal) },
    savings: { value: retailSavings, formatted: formatCurrency(retailSavings) },
    savingsPercentage: { value: savingsPercentage, formatted: formatPercentage(savingsPercentage) },
    hasSavings,
    totalSavings: { value: totalSavingsValue, formatted: formatCurrency(totalSavingsValue) },
    totalSavingsPercentage: { value: totalSavingsPercentage, formatted: formatPercentage(totalSavingsPercentage) },
    hasTotalSavings,
  };
}
