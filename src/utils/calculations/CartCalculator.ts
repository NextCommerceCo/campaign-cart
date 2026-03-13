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
}

interface CachedBundlePrice {
  result: CalculateCartResult;
  expiresAt: number;
}

function bundleCacheKey(items: BundlePriceItem[], currency?: string | null): string {
  const itemKey = [...items]
    .sort((a, b) => a.packageId - b.packageId)
    .map(i => `${i.packageId}x${i.quantity}`)
    .join('-');
  return BUNDLE_PRICE_CACHE_PREFIX + itemKey + (currency ? `-${currency}` : '');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CalculateCartParams {
  lines: LineWithUpsell[];
  vouchers?: string[];
  currency?: string | null;
  shippingMethod?: number;
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

  return { totals: buildCartTotals(summary), summary };
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
  const ttl = options.ttl ?? BUNDLE_PRICE_CACHE_TTL_MS;
  const cacheKey = bundleCacheKey(items, options.currency);

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
export function clearBundlePriceCache(items: BundlePriceItem[], currency?: string | null): void {
  sessionStorageManager.remove(bundleCacheKey(items, currency));
}

/**
 * Transform a raw CartSummary API response into a CartTotals object.
 * Pure function – no side effects, easy to test.
 */
export function buildCartTotals(response: CartSummary): CartTotals {
  const subtotal = parseFloat(response.subtotal);
  const total = parseFloat(response.total);
  const discount = parseFloat(response.total_discount);

  const shippingPrice = parseFloat(response.shipping_method?.price ?? '0');
  const shippingOriginalPrice = parseFloat(response.shipping_method?.original_price ?? '0');
  const shippingDiscount = shippingOriginalPrice > shippingPrice
    ? shippingOriginalPrice - shippingPrice
    : 0;

  // compareTotal is the cart value before any discounts are applied.
  // CartSummary does not include retail/compare-at prices, so this is the
  // best approximation: the full campaign price before discounts.
  const compareTotal = subtotal + discount;
  const savingsPercentage = compareTotal > 0 ? (discount / compareTotal) * 100 : 0;
  const hasSavings = discount > 0;

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
    total: { value: total, formatted: formatCurrency(total) },
    totalExclShipping: {
      value: total - shippingPrice,
      formatted: formatCurrency(total - shippingPrice),
    },
    count,
    isEmpty,
    // savings / compareTotal: retail savings are not available in CartSummary.
    // These reflect discount savings (coupons + offers) until retail price
    // data is passed in from the campaign.
    compareTotal: { value: compareTotal, formatted: formatCurrency(compareTotal) },
    savings: { value: discount, formatted: formatCurrency(discount) },
    savingsPercentage: { value: savingsPercentage, formatted: formatPercentage(savingsPercentage) },
    hasSavings,
    totalSavings: { value: discount, formatted: formatCurrency(discount) },
    totalSavingsPercentage: { value: savingsPercentage, formatted: formatPercentage(savingsPercentage) },
    hasTotalSavings: hasSavings,
  };
}
