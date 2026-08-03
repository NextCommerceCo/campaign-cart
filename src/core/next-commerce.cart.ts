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

export function hasItemInCart(options: { packageId?: number }): boolean {
  const cartStore = useCartStore.getState();

  if (options.packageId) {
    return cartStore.items.some(item => item.packageId === options.packageId);
  }

  return false;
}

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

export async function removeItem(options: {
  packageId?: number;
}): Promise<void> {
  if (options.packageId) {
    await cartOperations.removeItem(options.packageId);
  }
}

export async function updateQuantity(options: {
  packageId?: number;
  quantity: number;
}): Promise<void> {
  if (options.packageId) {
    await cartOperations.updateQuantity(options.packageId, options.quantity);
  }
}

export async function clearCart(): Promise<void> {
  cartOperations.clear();
}

export async function swapCart(
  ctx: { logger: Logger },
  items: Array<{ packageId: number; quantity: number }>
): Promise<void> {
  await cartOperations.swapCart(items);
  ctx.logger.debug(`Cart swapped with ${items.length} items`);
}

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

export function getCartCount(): number {
  const cartStore = useCartStore.getState();
  return cartStore.totalQuantity;
}
