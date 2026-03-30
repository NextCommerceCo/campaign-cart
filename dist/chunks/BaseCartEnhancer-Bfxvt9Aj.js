import { B as BaseEnhancer } from "./index-BzlW3G0-.js";
import { a as useCartStore } from "./analytics-C593VfhV.js";
class BaseCartEnhancer extends BaseEnhancer {
  /**
   * Setup cart store subscription
   * Automatically subscribes to cart updates and initializes with current state
   */
  setupCartSubscription() {
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.cartState = useCartStore.getState();
  }
  /**
   * Check if cart is empty
   */
  isCartEmpty() {
    return this.cartState?.isEmpty ?? true;
  }
  /**
   * Get cart item by package ID
   */
  getCartItem(packageId) {
    return this.cartState?.items.find((item) => item.packageId === packageId);
  }
  /**
   * Get total quantity of items in cart
   */
  getTotalQuantity() {
    return this.cartState?.totalQuantity ?? 0;
  }
  /**
   * Get all cart items
   */
  getCartItems() {
    return this.cartState?.items ?? [];
  }
  /**
   * Check if a package is in cart
   */
  hasPackageInCart(packageId) {
    return this.getCartItem(packageId) !== void 0;
  }
}
export {
  BaseCartEnhancer as B
};
