/**
 * `NextCommerce`'s Coupons category — extracted verbatim from
 * `next-commerce.ts`. None of these read instance state (`this`).
 *
 * `removeCoupon` is a known defect, carried over unchanged: it discards
 * `cartOperations.removeCoupon`'s result with `void`, so a caller has no way
 * to learn the removal failed (compare {@link applyCoupon}, which returns
 * `{ success, message }` for exactly that reason).
 */

import { useCartStore, cartOperations } from '@/state/cart';

/**
 * Applies a coupon code and recalculates totals. Returns `{ success, message }`
 * — `success: false` when the code is already applied or invalid.
 *
 * @example
 * ```ts
 * const { success, message } = await sdk.applyCoupon('SAVE10');
 * ```
 * @category Coupons
 */
export async function applyCoupon(
  code: string
): Promise<{ success: boolean; message: string }> {
  return await cartOperations.applyCoupon(code);
}

/**
 * Removes a previously applied coupon and recalculates totals.
 * @category Coupons
 */
export function removeCoupon(code: string): void {
  void cartOperations.removeCoupon(code);
}

/**
 * The coupon codes currently applied to the cart.
 * @category Coupons
 */
export function getCoupons(): string[] {
  const cartStore = useCartStore.getState();
  return cartStore.getCoupons();
}
