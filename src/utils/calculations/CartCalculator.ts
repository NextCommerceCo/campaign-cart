/**
 * CartCalculator - standalone utility for calling the calculate API and
 * transforming the response into CartTotals.
 *
 * Useful for:
 * - Cart total calculation (used by cartStore)
 * - Bundle price preview (send arbitrary items without touching the cart)
 * - Voucher recalculation (pass updated vouchers, get new totals back)
 */

import Decimal from 'decimal.js';
import type { CartCalculateSummary, CartSummary, Discount, LineWithUpsell } from '@/types/api';
import type { ShippingMethod } from '@/types/global';
import { sessionStorageManager } from '@/utils/storage';

// ─── In-memory calculate cache ────────────────────────────────────────────────

const CALC_CACHE_TTL_MS = 30_000;
const CALC_CACHE_MAX_ENTRIES = 20;

interface CalcCacheEntry {
  promise: Promise<CalculateCartResult>;
  expiresAt: number;
  settled: boolean;
}

const calcCache = new Map<string, CalcCacheEntry>();

const CALC_CACHE_PREFIX = 'next-price-';

async function calcCacheKey(
  params: CalculateCartParams,
  apiKey: string,
): Promise<string> {
  const lines = [...params.lines].sort((a, b) => {
    const pkgDiff = a.package_id - b.package_id;
    if (pkgDiff !== 0) return pkgDiff;
    return a.quantity - b.quantity;
  });
  const data = JSON.stringify({
    l: lines,
    v: params.vouchers ? [...params.vouchers].sort() : [],
    c: params.currency ?? null,
    sm: params.shippingMethod ?? null,
    es: params.exclude_shipping ?? false,
    u: params.upsell ?? false,
    k: apiKey,
  });
  const bytes = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(data),
  );
  const hex = Array.from(new Uint8Array(bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return CALC_CACHE_PREFIX + hex;
}

function evictCalcCache(): void {
  if (calcCache.size <= CALC_CACHE_MAX_ENTRIES) return;
  const oldest = calcCache.keys().next().value;
  if (oldest !== undefined) calcCache.delete(oldest);
}

// ─── Bundle price cache ───────────────────────────────────────────────────────

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
  /** When true, passes ?upsell=true to the calculate API for post-purchase pricing. */
  upsell?: boolean;
}

interface CachedBundlePrice {
  result: CalculateCartResult;
  expiresAt: number;
}


// ─── Public API ───────────────────────────────────────────────────────────────

export interface CalculateCartParams {
  lines: LineWithUpsell[];
  vouchers?: string[];
  currency?: string | null;
  shippingMethod?: number;
  exclude_shipping?: boolean;
  /** When true, passes ?upsell=true to the calculate API for post-purchase pricing. */
  upsell?: boolean;
  signal?: AbortSignal;
}

export interface CalculateCartResult {
  /** List of applied coupon codes. */
  vouchers: string[];
  /** ISO currency code of cart data. */
  currency?: string;
  /** Detailed offer information for offers applied to the cart. */
  offerDiscounts?: Discount[];
  /** Detailed voucher information for vouchers applied to the cart. */
  voucherDiscounts?: Discount[];
  /** Cart subtotal before shipping and discounts. */
  subtotal: Decimal;
  /** The currently selected shipping method and its pricing details. */
  shippingMethod?: ShippingMethod;
  /** `true` when any discount (coupon or offer) is applied. */
  hasDiscounts: boolean;
  /** Total discount amount from coupons and offers. */
  totalDiscount: Decimal;
  /** Total discount as a percentage of the subtotal. */
  totalDiscountPercentage: Decimal;
  /** Cart grand total (subtotal + shipping − discounts). */
  total: Decimal;
  /** Raw CartSummary response from the API calculate endpoint. */
  summary?: CartSummary;
}

/**
 * Call the /calculate API with arbitrary lines and return totals + raw summary.
 * Lazily imports ApiClient and configStore to avoid circular dependencies.
 *
 * Results are cached in-memory by payload (30s TTL). Concurrent calls with the
 * same payload share a single in-flight request (promise dedup).
 */
export async function calculateCart(
  params: CalculateCartParams
): Promise<CalculateCartResult> {
  const { ApiClient } = await import('@/api/client');
  const { useConfigStore } = await import('@/stores/configStore');

  const apiKey = useConfigStore.getState().apiKey;
  const key = await calcCacheKey(params, apiKey);

  const existing = calcCache.get(key);
  if (existing) {
    if (existing.settled && existing.expiresAt > Date.now()) {
      // LRU touch: move to end of Map iteration order
      calcCache.delete(key);
      calcCache.set(key, existing);
      return existing.promise;
    }
    if (!existing.settled) {
      // In-flight dedup: return the same pending promise
      return existing.promise;
    }
    // Expired
    calcCache.delete(key);
  }

  const client = new ApiClient(apiKey);

  const cartData: CartCalculateSummary = {
    lines: params.lines,
    vouchers: params.vouchers,
    currency: params.currency ?? null,
    shipping_method: params.shippingMethod,
  };

  const promise = client
    .calculateSummary(cartData, params.signal, {
      upsell: params.upsell,
    })
    .then(summary => {
      const result: CalculateCartResult = {
        ...buildCartFields(summary),
        vouchers: params.vouchers ?? [],
        summary,
      };
      const entry = calcCache.get(key);
      if (entry && entry.promise === promise) {
        entry.settled = true;
        entry.expiresAt = Date.now() + CALC_CACHE_TTL_MS;
      }
      return result;
    })
    .catch(err => {
      // Remove failed/aborted entries so next call retries
      const entry = calcCache.get(key);
      if (entry && entry.promise === promise) {
        calcCache.delete(key);
      }
      throw err;
    });

  calcCache.set(key, { promise, expiresAt: 0, settled: false });
  evictCalcCache();

  return promise;
}

/**
 * Clear the in-memory calculateCart cache.
 * Call when server-side state may have changed independently of the payload.
 */
export function clearCalculateCache(): void {
  calcCache.clear();
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

  const lines: LineWithUpsell[] = items.map(item => ({
    package_id: item.packageId,
    quantity: item.quantity,
  }));

  const params: CalculateCartParams = {
    lines,
    vouchers: options.vouchers,
    currency: options.currency,
    shippingMethod: options.shippingMethod,
    exclude_shipping: options.exclude_shipping,
    upsell: options.upsell,
  };

  const cacheKey = await calcCacheKey(params, apiKey);

  if (ttl > 0) {
    const cached = sessionStorageManager.get<CachedBundlePrice>(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
  }

  const result = await calculateCart(params);

  if (ttl > 0) {
    sessionStorageManager.set<CachedBundlePrice>(cacheKey, {
      result,
      expiresAt: Date.now() + ttl,
    });
  }

  return result;
}

/**
 * Transform a raw CartSummary API response into flat CartState fields.
 * Pure function – no side effects, easy to test.
 * All price fields are Decimal instances for precision arithmetic.
 */
export function buildCartFields(
  response: CartSummary,
): Omit<CalculateCartResult, 'summary' | 'vouchers'> {
  const subtotal = new Decimal(response.subtotal);
  const total = new Decimal(response.total);
  const totalDiscount = new Decimal(response.total_discount);

  const totalDiscountPercentage = subtotal.gt(0)
    ? totalDiscount.div(subtotal).times(100)
    : new Decimal(0);

  let shippingMethod: ShippingMethod | undefined;
  if (response.shipping_method) {
    const sm = response.shipping_method;
    const shippingPrice = new Decimal(sm.price);
    const shippingOriginalPrice = new Decimal(sm.original_price);
    const shippingDiscountAmount = Decimal.max(
      0,
      shippingOriginalPrice.minus(shippingPrice),
    );
    const shippingDiscountPercentage = shippingOriginalPrice.gt(0)
      ? shippingDiscountAmount.div(shippingOriginalPrice).times(100)
      : new Decimal(0);

    shippingMethod = {
      id: sm.id,
      name: sm.name,
      code: sm.code,
      originalPrice: shippingOriginalPrice,
      price: shippingPrice,
      discountAmount: shippingDiscountAmount,
      discountPercentage: shippingDiscountPercentage,
      hasDiscounts: shippingDiscountAmount.gt(0),
      discounts: sm.discounts,
    };
  }

  return {
    currency: response.currency,
    offerDiscounts: response.offer_discounts,
    voucherDiscounts: response.voucher_discounts,
    subtotal,
    total,
    hasDiscounts: totalDiscount.gt(0),
    totalDiscount,
    totalDiscountPercentage,
    shippingMethod,
  };
}
