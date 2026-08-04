/**
 * `NextCommerce`'s Cart category — extracted verbatim from `next-commerce.ts`.
 * Every function here is the exact body of the class method of the same name;
 * `swapCart` is the only one that reads instance state, so it takes a
 * `{ logger }` context and the rest take none.
 */

import type { CallbackData } from '@/types/global';
import { useCartStore, cartOperations } from '@/state/cart';
import { useCampaignStore } from '@/state/campaign';
import type { Logger } from '@/core/logger';

/**
 * Whether a package is currently in the cart.
 *
 * @param options.packageId - The package `ref_id` to look for.
 * @returns `true` if an item with that package id is in the cart.
 * @category Cart
 */
export function hasItemInCart(options: { packageId?: number }): boolean {
  const cartStore = useCartStore.getState();

  if (options.packageId) {
    return cartStore.items.some(item => item.packageId === options.packageId);
  }

  return false;
}

/**
 * Adds a package to the cart (quantity defaults to 1). No-op if `packageId`
 * is omitted. For upsell adds use {@link core/next-commerce!NextCommerce.cart}.
 *
 * @example
 * ```ts
 * await sdk.addItem({ packageId: 2, quantity: 2 });
 * ```
 * @category Cart
 */
export async function addItem(options: {
  packageId?: number;
  quantity?: number;
}): Promise<void> {
  const quantity = options.quantity ?? 1;

  if (options.packageId) {
    await cartOperations.addItem({
      packageId: options.packageId,
      quantity,
      isUpsell: false,
    });
  }
}

/**
 * Removes a package from the cart entirely. No-op if `packageId` is omitted.
 * @category Cart
 */
export async function removeItem(options: {
  packageId?: number;
}): Promise<void> {
  if (options.packageId) {
    await cartOperations.removeItem(options.packageId);
  }
}

/**
 * Sets the exact quantity for a package (a quantity of 0 removes it).
 * @category Cart
 */
export async function updateQuantity(options: {
  packageId?: number;
  quantity: number;
}): Promise<void> {
  if (options.packageId) {
    await cartOperations.updateQuantity(options.packageId, options.quantity);
  }
}

/**
 * Empties the cart.
 * @category Cart
 */
export async function clearCart(): Promise<void> {
  cartOperations.clear();
}

/**
 * Replaces the entire cart contents with the given items in one atomic swap
 * (used by bundle/package selectors). Existing items not listed are removed.
 * @category Cart
 */
export async function swapCart(
  ctx: { logger: Logger },
  items: Array<{ packageId: number; quantity: number }>
): Promise<void> {
  await cartOperations.swapCart(items);
  ctx.logger.debug(`Cart swapped with ${items.length} items`);
}

/**
 * A snapshot of the full cart for callbacks — enriched line items, totals,
 * campaign data, and applied vouchers.
 * @category Cart
 */
export function getCartData(): CallbackData {
  const cartStore = useCartStore.getState();
  const campaignStore = useCampaignStore.getState();

  return {
    cartLines: cartStore.enrichedItems,
    cartTotals: {
      subtotal: cartStore.subtotal,
      total: cartStore.total,
      hasDiscounts: cartStore.hasDiscounts,
      totalDiscount: cartStore.totalDiscount,
      totalDiscountPercentage: cartStore.totalDiscountPercentage,
      shippingMethod: cartStore.shippingMethod,
    },
    campaignData: campaignStore.data,
    vouchers: cartStore.getCoupons(),
  };
}

/**
 * The current cart totals (subtotal, total, discounts, shipping) as `Decimal`s.
 * @category Cart
 */
export function getCartTotals() {
  const cartStore = useCartStore.getState();
  return {
    subtotal: cartStore.subtotal,
    total: cartStore.total,
    hasDiscounts: cartStore.hasDiscounts,
    totalDiscount: cartStore.totalDiscount,
    totalDiscountPercentage: cartStore.totalDiscountPercentage,
    shippingMethod: cartStore.shippingMethod,
  };
}

/**
 * Total number of units in the cart (sum of item quantities).
 * @category Cart
 */
export function getCartCount(): number {
  const cartStore = useCartStore.getState();
  return cartStore.totalQuantity;
}
