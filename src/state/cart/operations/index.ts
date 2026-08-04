import type { CartOperations } from '../cart.types';
import { addItem } from './add-item';
import { removeItem } from './remove-item';
import { updateQuantity } from './update-quantity';
import { swapPackage } from './swap-package';
import { swapCart } from './swap-cart';
import { clear } from './clear-cart';
import { calculateTotals } from './calculate-totals';
import { refreshItemPrices } from './refresh-item-prices';
import { setShippingMethod } from './set-shipping-method';
import { applyCoupon } from './apply-coupon';
import { removeCoupon } from './remove-coupon';

/**
 * Cart business-logic operations — the blessed programmatic cart API
 * (surfaced as `sdk.cart.*`). The Zustand store (`@/state/cart`) is a thin
 * state container; all async/coordination logic lives here.
 */
export const cartOperations: CartOperations = {
  addItem,
  removeItem,
  updateQuantity,
  swapPackage,
  swapCart,
  clear,
  calculateTotals,
  refreshItemPrices,
  setShippingMethod,
  applyCoupon,
  removeCoupon,
};
