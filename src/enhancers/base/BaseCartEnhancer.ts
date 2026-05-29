import { BaseEnhancer } from './BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import type { CartState, CartItem } from '@/types/global';

/**
 * Base class for enhancers that need to read cart state reactively.
 *
 * Extends `BaseEnhancer` and adds awareness of `useCartStore`. Subclasses call
 * `setupCartSubscription()` (typically from `initialize()`) to subscribe to
 * cart updates via the inherited `subscribe()` helper and seed the cached
 * `cartState` with the current store snapshot.
 *
 * Provides to subclasses:
 * - `setupCartSubscription()` — subscribes to `useCartStore` and caches state.
 * - `handleCartUpdate(state)` — abstract; subclasses implement it to react to
 *   cart changes.
 * - Read helpers over the cached state: `isCartEmpty()`, `getCartItem()`,
 *   `getTotalQuantity()`, `getCartItems()`, and `hasPackageInCart()`.
 *
 * @remarks
 * The cart subscription is registered through `BaseEnhancer.subscribe()`, so it
 * is released automatically by `destroy()`. Subclasses overriding `destroy()`
 * must call `super.destroy()` first.
 */
export abstract class BaseCartEnhancer extends BaseEnhancer {
  protected cartState?: CartState;
  
  /**
   * Setup cart store subscription
   * Automatically subscribes to cart updates and initializes with current state
   */
  protected setupCartSubscription(): void {
    // Subscribe to cart updates
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    
    // Initialize with current state
    this.cartState = useCartStore.getState();
  }
  
  /**
   * Handle cart state updates
   * Must be implemented by subclasses to react to cart changes
   */
  protected abstract handleCartUpdate(state: CartState): void;
  
  /**
   * Check if cart is empty
   */
  protected isCartEmpty(): boolean {
    return this.cartState?.isEmpty ?? true;
  }
  
  /**
   * Get cart item by package ID
   */
  protected getCartItem(packageId: number): CartItem | undefined {
    return this.cartState?.items.find(item => item.packageId === packageId);
  }
  
  /**
   * Get total quantity of items in cart
   */
  protected getTotalQuantity(): number {
    return this.cartState?.totalQuantity ?? 0;
  }
  
  /**
   * Get all cart items
   */
  protected getCartItems(): CartItem[] {
    return this.cartState?.items ?? [];
  }
  
  /**
   * Check if a package is in cart
   */
  protected hasPackageInCart(packageId: number): boolean {
    return this.getCartItem(packageId) !== undefined;
  }
}