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

// ─── Bundle price cache ───────────────────────────────────────────────────────

const BUNDLE_PRICE_CACHE_PREFIX = 'next-price-';
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

async function bundleCacheKey(
  items: BundlePriceItem[],
  currency?: string | null,
  vouchers?: string[],
  apiKey?: string,
  upsell?: boolean,
): Promise<string> {
  const data = JSON.stringify({
    items: [...items].sort((a, b) => a.packageId - b.packageId),
    currency: currency ?? null,
    vouchers: vouchers ? [...vouchers].sort() : [],
    apiKey: apiKey ?? '',
    upsell: upsell ?? false,
  });
  const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(data));
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

  const summary = await client.calculateSummary(cartData, params.signal, { upsell: params.upsell });

  return { ...buildCartFields(summary), vouchers: params.vouchers ?? [], summary };
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
  const cacheKey = await bundleCacheKey(items, options.currency, options.vouchers, apiKey, options.upsell);

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
    upsell: options.upsell,
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
