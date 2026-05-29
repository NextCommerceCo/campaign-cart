/**
 * Programmatic entry point to the SDK.
 *
 * `NextCommerce` is the public façade that page authors use to drive the cart,
 * read campaign data, register event/callback handlers, apply coupons, and add
 * post-purchase upsells without touching the underlying stores directly. It is a
 * singleton: at runtime the SDK assigns the instance to `window.next`, so most
 * code never calls {@link NextCommerce.getInstance} itself.
 *
 * @remarks
 * Cart-mutating methods ({@link NextCommerce.addItem | addItem},
 * {@link NextCommerce.removeItem | removeItem}, etc.) are async — they resolve
 * once the cart store has applied the change and recalculated totals.
 *
 * @example
 * Access the singleton on the page and add an item to the cart:
 * ```ts
 * window.nextReady.push(async (next) => {
 *   await next.addItem({ packageId: 2, quantity: 1 });
 * });
 * ```
 */

declare global {
  interface Window {
    __NEXT_SDK_VERSION__?: string;
  }
}

import type {
  Campaign,
  CallbackType,
  CallbackData,
  EventMap,
} from '@/types/global';
import type { AddUpsellLine } from '@/types/api';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { useOrderStore } from '@/stores/orderStore';
import { useConfigStore } from '@/stores/configStore';
import { useAttributionStore } from '@/stores/attributionStore';
import { useParameterStore } from '@/stores/parameterStore';
import { EventBus } from '@/utils/events';
import { Logger } from '@/utils/logger';
import { ApiClient } from '@/api/client';

export class NextCommerce {
  private static instance: NextCommerce;
  private logger: Logger;
  private eventBus: EventBus;
  private callbacks = new Map<CallbackType, Set<Function>>();
  private exitIntentEnhancer: any = null;

  private constructor() {
    this.logger = new Logger('NextCommerce');
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Returns the shared {@link NextCommerce} singleton, creating it on first call.
   *
   * At runtime the SDK assigns this instance to `window.next`, so page code
   * usually reads `window.next` (or queues via `window.nextReady.push`) rather
   * than calling `getInstance` directly. Use it from TypeScript modules that
   * need a typed reference.
   *
   * @returns The singleton SDK instance.
   *
   * @example
   * ```ts
   * import { NextCommerce } from '@NextCommerce/campaign-cart';
   * const next = NextCommerce.getInstance();
   * await next.addItem({ packageId: 2 });
   * ```
   */
  public static getInstance(): NextCommerce {
    if (!NextCommerce.instance) {
      NextCommerce.instance = new NextCommerce();
    }
    return NextCommerce.instance;
  }

  // Cart manipulation methods
  /**
   * Checks whether a package is currently in the cart.
   *
   * @param options - The package to look for.
   * @param options.packageId - Campaign package id. Returns `false` if omitted.
   * @returns `true` if a line for the package exists in the cart.
   *
   * @example
   * ```ts
   * if (next.hasItemInCart({ packageId: 2 })) {
   *   console.log('Already in cart');
   * }
   * ```
   */
  public hasItemInCart(options: { packageId?: number }): boolean {
    const cartStore = useCartStore.getState();

    if (options.packageId) {
      return cartStore.items.some(item => item.packageId === options.packageId);
    }

    return false;
  }

  /**
   * Adds a package to the cart, or increases its quantity if already present.
   *
   * @param options - The package to add.
   * @param options.packageId - Campaign package id to add. No-op if omitted.
   * @param options.quantity - Units to add. Defaults to `1`.
   * @returns Resolves once the cart store has applied the change.
   *
   * @example
   * ```ts
   * await next.addItem({ packageId: 2, quantity: 2 });
   * ```
   */
  public async addItem(options: {
    packageId?: number;
    quantity?: number;
  }): Promise<void> {
    const cartStore = useCartStore.getState();
    const quantity = options.quantity ?? 1;

    if (options.packageId) {
      await cartStore.addItem({
        packageId: options.packageId,
        quantity,
        isUpsell: false,
      });
    }
  }

  /**
   * Removes a package from the cart entirely, regardless of its quantity.
   *
   * @param options - The package to remove.
   * @param options.packageId - Campaign package id to remove. No-op if omitted.
   * @returns Resolves once the cart store has applied the change.
   *
   * @example
   * ```ts
   * await next.removeItem({ packageId: 2 });
   * ```
   */
  public async removeItem(options: { packageId?: number }): Promise<void> {
    const cartStore = useCartStore.getState();

    if (options.packageId) {
      await cartStore.removeItem(options.packageId);
    }
  }

  /**
   * Sets the exact quantity for a package already in the cart.
   *
   * @param options - The package and its new quantity.
   * @param options.packageId - Campaign package id. No-op if omitted.
   * @param options.quantity - The absolute quantity to set (not a delta).
   * @returns Resolves once the cart store has applied the change.
   *
   * @example
   * ```ts
   * await next.updateQuantity({ packageId: 2, quantity: 3 });
   * ```
   */
  public async updateQuantity(options: {
    packageId?: number;
    quantity: number;
  }): Promise<void> {
    const cartStore = useCartStore.getState();

    if (options.packageId) {
      await cartStore.updateQuantity(options.packageId, options.quantity);
    }
  }

  /**
   * Removes every line from the cart.
   *
   * @returns Resolves once the cart store is empty.
   *
   * @example
   * ```ts
   * await next.clearCart();
   * ```
   */
  public async clearCart(): Promise<void> {
    const cartStore = useCartStore.getState();
    await cartStore.clear();
  }

  /**
   * Replaces the entire cart contents with the given items in one operation.
   *
   * @param items - The full set of lines the cart should contain afterwards.
   * @returns Resolves once the swap is complete.
   *
   * @example
   * ```ts
   * await next.swapCart([
   *   { packageId: 2, quantity: 1 },
   *   { packageId: 5, quantity: 2 },
   * ]);
   * ```
   */
  public async swapCart(
    items: Array<{ packageId: number; quantity: number }>
  ): Promise<void> {
    const cartStore = useCartStore.getState();

    // Use a new method in cartStore if available, or do it manually
    if (typeof cartStore.swapCart === 'function') {
      await cartStore.swapCart(items);
    } else {
      // Fallback: clear and add all items
      await cartStore.clear();

      // Add all new items
      for (const item of items) {
        await cartStore.addItem({
          packageId: item.packageId,
          quantity: item.quantity,
          isUpsell: false,
        });
      }
    }

    this.logger.debug(`Cart swapped with ${items.length} items`);
  }

  // Cart data access
  /**
   * Returns a snapshot of the current cart: enriched line items, totals, the
   * active campaign data, and any applied vouchers.
   *
   * @returns The cart snapshot used by callbacks and analytics.
   *
   * @example
   * ```ts
   * const { cartLines, cartTotals } = next.getCartData();
   * console.log(`${cartLines.length} lines, total ${cartTotals.total}`);
   * ```
   */
  public getCartData(): CallbackData {
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
   * Returns just the cart totals (subtotal, total, discounts, shipping method),
   * without the line items or campaign data that {@link NextCommerce.getCartData}
   * includes.
   *
   * @returns The current cart totals.
   *
   * @example
   * ```ts
   * const { subtotal, total, totalDiscount } = next.getCartTotals();
   * ```
   */
  public getCartTotals() {
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
   * Returns the total number of units across all cart lines.
   *
   * @returns The summed quantity of every line in the cart.
   *
   * @example
   * ```ts
   * badge.textContent = String(next.getCartCount());
   * ```
   */
  public getCartCount(): number {
    const cartStore = useCartStore.getState();
    return cartStore.totalQuantity;
  }

  // Campaign data access
  /**
   * Returns the loaded campaign, or `null` if it has not loaded yet.
   *
   * @returns The campaign data, or `null` before the campaign has loaded.
   *
   * @example
   * ```ts
   * const campaign = next.getCampaignData();
   * if (campaign) console.log(campaign.name);
   * ```
   */
  public getCampaignData(): Campaign | null {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.data;
  }

  /**
   * Looks up a single package from the loaded campaign by its id.
   *
   * @param id - The campaign package id.
   * @returns The package, or `null` if no package with that id exists.
   *
   * @example
   * ```ts
   * const pkg = next.getPackage(2);
   * if (pkg) console.log(pkg.price);
   * ```
   */
  public getPackage(id: number): any | null {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.getPackage(id);
  }

  // Product variant methods
  /**
   * Returns the variant grouping for a product — its variant attributes and the
   * packages that back each variant combination.
   *
   * @param productId - The product id to resolve variants for.
   * @returns The product's variant group, or `null` if the product has none.
   *
   * @example
   * ```ts
   * const variants = next.getVariantsByProductId(10);
   * ```
   */
  public getVariantsByProductId(productId: number): any | null {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.getVariantsByProductId(productId);
  }

  /**
   * Lists the available values for one variant attribute of a product — e.g.
   * every selectable `color` or `size`.
   *
   * @param productId - The product id.
   * @param attributeCode - The attribute to enumerate, e.g. `'color'`.
   * @returns The distinct values available for that attribute.
   *
   * @example
   * ```ts
   * const colors = next.getAvailableVariantAttributes(10, 'color');
   * // ['Black', 'White', 'Blue']
   * ```
   */
  public getAvailableVariantAttributes(
    productId: number,
    attributeCode: string
  ): string[] {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.getAvailableVariantAttributes(
      productId,
      attributeCode
    );
  }

  /**
   * Resolves the concrete package that matches a full variant selection for a
   * product.
   *
   * @param productId - The product id.
   * @param selectedAttributes - The chosen value for each variant attribute,
   *                             keyed by attribute code.
   * @returns The matching package, or `null` if no package matches the selection.
   *
   * @example
   * ```ts
   * const pkg = next.getPackageByVariantSelection(10, {
   *   color: 'Black',
   *   size: 'L',
   * });
   * // pkg is the package for the Black / L variant, or null if unavailable
   * ```
   */
  public getPackageByVariantSelection(
    productId: number,
    selectedAttributes: Record<string, string>
  ): any | null {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.getPackageByVariantSelection(
      productId,
      selectedAttributes
    );
  }

  /**
   * Builds a stable, order-independent key string from a set of variant
   * attributes. Useful for indexing or comparing variant selections.
   *
   * @param attributes - The variant attribute values, keyed by attribute code.
   * @returns A canonical key, e.g. `'color:Black|size:L'`.
   *
   * @example
   * ```ts
   * next.createVariantKey({ size: 'L', color: 'Black' });
   * // 'color:Black|size:L'  (sorted, so input order does not matter)
   * ```
   */
  public createVariantKey(attributes: Record<string, string>): string {
    // Helper method to create consistent variant keys
    return Object.entries(attributes)
      .map(([code, value]) => `${code}:${value}`)
      .sort()
      .join('|');
  }

  // Event and callback registration
  /**
   * Subscribes to an SDK event. Event names and payload shapes are defined by
   * {@link EventMap}.
   *
   * @typeParam K - The event name, constrained to keys of {@link EventMap}.
   * @param event - The event to listen for, e.g. `'cart:updated'`.
   * @param handler - Invoked with the event payload each time the event fires.
   *
   * @example
   * ```ts
   * next.on('cart:updated', (cart) => {
   *   console.log('Cart changed, total quantity:', cart.totalQuantity);
   * });
   * ```
   *
   * @see {@link NextCommerce.off} to remove the handler.
   */
  public on<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): void {
    this.eventBus.on(event, handler);
  }

  /**
   * Removes a previously registered event handler.
   *
   * @typeParam K - The event name, constrained to keys of {@link EventMap}.
   * @param event - The event the handler was registered for.
   * @param handler - The exact handler reference passed to {@link NextCommerce.on}.
   *
   * @example
   * ```ts
   * const onUpdate = (cart) => console.log(cart.total);
   * next.on('cart:updated', onUpdate);
   * // later…
   * next.off('cart:updated', onUpdate);
   * ```
   */
  public off<K extends keyof EventMap>(event: K, handler: Function): void {
    this.eventBus.off(event, handler);
  }

  /**
   * Registers a callback for a lifecycle hook. Unlike {@link NextCommerce.on}
   * events, callbacks fire at fixed points in the render/checkout flow and all
   * receive the same {@link CallbackData} cart snapshot.
   *
   * @param type - The lifecycle hook, e.g. `'beforeCheckout'` or `'itemAdded'`.
   * @param callback - Invoked with the current cart snapshot when the hook fires.
   *
   * @example
   * ```ts
   * next.registerCallback('beforeCheckout', (data) => {
   *   console.log('Checking out with', data.cartLines.length, 'lines');
   * });
   * ```
   */
  public registerCallback(
    type: CallbackType,
    callback: (data: CallbackData) => void
  ): void {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set());
    }
    this.callbacks.get(type)!.add(callback);
  }

  /**
   * Removes a callback previously added with {@link NextCommerce.registerCallback}.
   *
   * @param type - The lifecycle hook the callback was registered for.
   * @param callback - The exact callback reference that was registered.
   *
   * @example
   * ```ts
   * next.unregisterCallback('beforeCheckout', myCallback);
   * ```
   */
  public unregisterCallback(type: CallbackType, callback: Function): void {
    this.callbacks.get(type)?.delete(callback);
  }

  /**
   * Manually fires all callbacks registered for a hook. Primarily used
   * internally by the SDK at the relevant lifecycle points; rarely called by
   * page authors directly.
   *
   * @param type - The lifecycle hook to trigger.
   * @param data - The cart snapshot to pass to each callback.
   *
   * @example
   * ```ts
   * next.triggerCallback('afterRender', next.getCartData());
   * ```
   */
  public triggerCallback(type: CallbackType, data: CallbackData): void {
    this.callbacks.get(type)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        this.logger.error(`Callback error for ${type}:`, error);
      }
    });
  }

  // Analytics methods (v2 system)
  /**
   * Tracks a `view_item_list` analytics event for a set of packages (e.g. a
   * product grid impression). Tracking runs in the background and never throws.
   *
   * @param packageIds - The package ids shown in the list.
   * @param _listId - Reserved list identifier (currently unused).
   * @param listName - Human-readable list name, e.g. `'Upsell offers'`.
   *
   * @example
   * ```ts
   * next.trackViewItemList([2, 5, 7], undefined, 'Bestsellers');
   * ```
   */
  public async trackViewItemList(
    packageIds: (string | number)[],
    _listId?: string,
    listName?: string
  ): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        nextAnalytics.trackViewItemList(packageIds, listName);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Tracks a `view_item` analytics event for a single package. The package must
   * exist in the loaded campaign; otherwise the event is skipped with a warning.
   *
   * @param packageId - The package id being viewed.
   *
   * @example
   * ```ts
   * next.trackViewItem(2);
   * ```
   */
  public async trackViewItem(packageId: string | number): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        const { useCampaignStore } = await import('@/stores/campaignStore');

        // Convert to number and validate package exists
        const packageIdNum =
          typeof packageId === 'string' ? parseInt(packageId, 10) : packageId;
        const campaignStore = useCampaignStore.getState();
        const packageData = campaignStore.getPackage(packageIdNum);

        if (!packageData) {
          this.logger.warn('Package not found in store:', packageIdNum);
          return;
        }

        // Create a minimal item object for tracking (matches auto-tracking format)
        const item = {
          packageId: packageIdNum,
          package_id: packageIdNum,
          id: packageIdNum,
        };
        nextAnalytics.trackViewItem(item);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Tracks an `add_to_cart` analytics event. Call this for manual add flows;
   * attribute-driven add-to-cart buttons emit it automatically.
   *
   * @param packageId - The package id added.
   * @param quantity - Units added. Defaults to `1`.
   *
   * @example
   * ```ts
   * next.trackAddToCart(2, 3);
   * ```
   */
  public async trackAddToCart(
    packageId: string | number,
    quantity?: number
  ): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        // Create a minimal item object for tracking
        const item = {
          id: String(packageId),
          packageId: packageId,
          quantity: quantity || 1,
        };
        nextAnalytics.trackAddToCart(item);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Tracks a `remove_from_cart` analytics event.
   *
   * @param packageId - The package id removed.
   * @param quantity - Units removed. Defaults to `1`.
   *
   * @example
   * ```ts
   * next.trackRemoveFromCart(2);
   * ```
   */
  public async trackRemoveFromCart(
    packageId: string | number,
    quantity?: number
  ): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics, EcommerceEvents } = await import(
          '@/utils/analytics/index'
        );
        nextAnalytics.track(
          EcommerceEvents.createRemoveFromCartEvent({
            packageId,
            quantity: quantity || 1,
          })
        );
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Tracks a `begin_checkout` analytics event for the current cart.
   *
   * @example
   * ```ts
   * next.trackBeginCheckout();
   * ```
   */
  public async trackBeginCheckout(): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        nextAnalytics.trackBeginCheckout();
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Tracks a `purchase` analytics event for a completed order.
   *
   * @param orderData - The completed order to report (as returned by the order
   *                    API / order store).
   *
   * @example
   * ```ts
   * next.trackPurchase(useOrderStore.getState().order);
   * ```
   */
  public async trackPurchase(orderData: any): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        nextAnalytics.trackPurchase(orderData);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Tracks an arbitrary custom analytics event with an optional payload.
   *
   * @param eventName - The event name to emit to the analytics layer.
   * @param data - Optional additional properties merged into the event.
   *
   * @example
   * ```ts
   * next.trackCustomEvent('promo_banner_click', { campaign: 'summer' });
   * ```
   */
  public async trackCustomEvent(
    eventName: string,
    data?: Record<string, any>
  ): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        nextAnalytics.track({ event: eventName, ...data });
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  // User tracking methods
  /**
   * Tracks a `sign_up` analytics event and associates the user.
   *
   * @param email - The email address the user signed up with.
   *
   * @example
   * ```ts
   * next.trackSignUp('ada@example.com');
   * ```
   */
  public async trackSignUp(email: string): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        nextAnalytics.trackSignUp(email);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Tracks a `login` analytics event and associates the user.
   *
   * @param email - The email address the user logged in with.
   *
   * @example
   * ```ts
   * next.trackLogin('ada@example.com');
   * ```
   */
  public async trackLogin(email: string): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        nextAnalytics.trackLogin(email);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  // Advanced analytics methods
  /**
   * Toggles verbose analytics debug logging at runtime.
   *
   * @param enabled - `true` to log analytics activity to the console.
   *
   * @example
   * ```ts
   * next.setDebugMode(true);
   * ```
   */
  public async setDebugMode(enabled: boolean): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        nextAnalytics.setDebugMode(enabled);
      } catch (error) {
        this.logger.debug('Analytics debug mode failed (non-critical):', error);
      }
    });
  }

  /**
   * Invalidates the cached analytics context so the next event rebuilds it from
   * current state. Call after changing user, currency, or campaign context.
   *
   * @example
   * ```ts
   * next.invalidateAnalyticsContext();
   * ```
   */
  public async invalidateAnalyticsContext(): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/utils/analytics/index');
        nextAnalytics.invalidateContext();
      } catch (error) {
        this.logger.debug(
          'Analytics context invalidation failed (non-critical):',
          error
        );
      }
    });
  }

  // Attribution metadata methods
  /**
   * Adds or overwrites a single custom metadata field on the attribution
   * record, preserving the automatically collected fields.
   *
   * @param key - The metadata key to set.
   * @param value - The value to store under that key.
   *
   * @example
   * ```ts
   * next.addMetadata('funnel_step', 'landing');
   * ```
   */
  public addMetadata(key: string, value: any): void {
    try {
      const store = useAttributionStore.getState();
      const currentMetadata = store.metadata || {};

      store.updateAttribution({
        metadata: {
          ...currentMetadata,
          [key]: value,
        },
      });

      this.logger.debug(`Attribution metadata added: ${key}`, value);
    } catch (error) {
      this.logger.error('Failed to add attribution metadata:', error);
    }
  }

  /**
   * Merges multiple custom metadata fields into the attribution record at once.
   * Existing automatic fields are preserved; provided keys are added or
   * overwritten.
   *
   * @param metadata - The metadata key/value pairs to merge in.
   *
   * @example
   * ```ts
   * next.setMetadata({ funnel: 'spring', variant: 'B' });
   * ```
   */
  public setMetadata(metadata: Record<string, any>): void {
    try {
      const store = useAttributionStore.getState();
      const currentMetadata = store.metadata || {};

      // Merge with existing metadata to preserve automatic fields
      store.updateAttribution({
        metadata: {
          ...currentMetadata,
          ...metadata,
        },
      });

      this.logger.debug('Attribution metadata set:', metadata);
    } catch (error) {
      this.logger.error('Failed to set attribution metadata:', error);
    }
  }

  /**
   * Clears all custom metadata fields while retaining the automatically
   * collected ones (landing page, referrer, device, domain, timestamp).
   *
   * @example
   * ```ts
   * next.clearMetadata();
   * ```
   */
  public clearMetadata(): void {
    try {
      const store = useAttributionStore.getState();

      store.updateAttribution({
        metadata: {
          // Preserve automatic fields
          landing_page: store.metadata?.landing_page || '',
          referrer: store.metadata?.referrer || '',
          device: store.metadata?.device || '',
          device_type: store.metadata?.device_type || 'desktop',
          domain: store.metadata?.domain || '',
          timestamp: store.metadata?.timestamp || Date.now(),
        },
      });

      this.logger.debug('Attribution metadata cleared');
    } catch (error) {
      this.logger.error('Failed to clear attribution metadata:', error);
    }
  }

  /**
   * Returns the current attribution metadata, including automatic fields.
   *
   * @returns The metadata object, or `undefined` if it could not be read.
   *
   * @example
   * ```ts
   * const meta = next.getMetadata();
   * ```
   */
  public getMetadata(): Record<string, any> | undefined {
    try {
      const store = useAttributionStore.getState();
      return store.metadata;
    } catch (error) {
      this.logger.error('Failed to get attribution metadata:', error);
      return undefined;
    }
  }

  /**
   * Updates top-level attribution fields (e.g. UTM parameters, funnel id).
   * Merges into the existing attribution record.
   *
   * @param attribution - The attribution fields to set.
   *
   * @example
   * ```ts
   * next.setAttribution({ utm_source: 'newsletter', utm_campaign: 'spring' });
   * ```
   */
  public setAttribution(attribution: Record<string, any>): void {
    try {
      const store = useAttributionStore.getState();
      store.updateAttribution(attribution);

      this.logger.debug('Attribution set:', attribution);
    } catch (error) {
      this.logger.error('Failed to set attribution:', error);
    }
  }

  /**
   * Returns the attribution payload formatted for submission to the API
   * (the shape attached to cart and order requests).
   *
   * @returns The API-ready attribution object, or `undefined` on error.
   *
   * @example
   * ```ts
   * const attribution = next.getAttribution();
   * ```
   */
  public getAttribution(): Record<string, any> | undefined {
    try {
      const store = useAttributionStore.getState();
      return store.getAttributionForApi();
    } catch (error) {
      this.logger.error('Failed to get attribution:', error);
      return undefined;
    }
  }

  /**
   * Logs the current attribution state to the console for debugging.
   *
   * @example
   * ```ts
   * next.debugAttribution();
   * ```
   */
  public debugAttribution(): void {
    try {
      const store = useAttributionStore.getState();
      store.debug();
    } catch (error) {
      this.logger.error('Failed to debug attribution:', error);
    }
  }

  // Shipping methods
  /**
   * Returns the shipping methods available on the loaded campaign.
   *
   * @returns The available shipping methods, or an empty array if the campaign
   *          has not loaded or defines none.
   *
   * @example
   * ```ts
   * const methods = next.getShippingMethods();
   * methods.forEach(m => console.log(m.ref_id, m.code, m.price));
   * ```
   */
  public getShippingMethods(): Array<{
    ref_id: number;
    code: string;
    price: string;
  }> {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.data?.shipping_methods || [];
  }

  /**
   * Returns the shipping method currently selected in checkout.
   *
   * @returns The selected method, or `null` if none has been chosen yet.
   *
   * @example
   * ```ts
   * const selected = next.getSelectedShippingMethod();
   * if (selected) console.log('Shipping:', selected.name);
   * ```
   */
  public getSelectedShippingMethod(): {
    id: number;
    name: string;
    price: number;
    code: string;
  } | null {
    const checkoutStore = useCheckoutStore.getState();
    return checkoutStore.shippingMethod || null;
  }

  /**
   * Selects a shipping method by id. The cart store validates the id against the
   * campaign and recalculates totals.
   *
   * @param methodId - The `ref_id` of the shipping method to select.
   * @returns Resolves once the method is applied and totals are recalculated.
   *
   * @example
   * ```ts
   * await next.setShippingMethod(1);
   * ```
   */
  public async setShippingMethod(methodId: number): Promise<void> {
    // Delegate to cart store which handles validation and syncing
    const cartStore = useCartStore.getState();
    await cartStore.setShippingMethod(methodId);
  }

  // Utility methods
  /**
   * Returns the running SDK version string.
   *
   * @returns The SDK version detected at runtime (or the build-time fallback).
   *
   * @example
   * ```ts
   * console.log('SDK version', next.getVersion());
   * ```
   */
  public getVersion(): string {
    // Return the runtime detected version from loader, or fallback to build version
    if (typeof window !== 'undefined' && window.__NEXT_SDK_VERSION__) {
      return window.__NEXT_SDK_VERSION__;
    }
    return '__VERSION__'; // Will be replaced at build time
  }

  /**
   * Formats a numeric amount as a localized currency string.
   *
   * @param amount - The amount to format.
   * @param currency - ISO 4217 code. Defaults to the campaign's currency, then
   *                   `'USD'`.
   * @returns The formatted price, e.g. `'$19.99'`.
   *
   * @example
   * ```ts
   * next.formatPrice(19.99);        // '$19.99' (campaign currency)
   * next.formatPrice(19.99, 'EUR'); // '€19.99'
   * ```
   */
  public formatPrice(amount: number, currency?: string): string {
    const { formatCurrency } = require('@/utils/currencyFormatter');
    const campaignStore = useCampaignStore.getState();
    const useCurrency = currency ?? campaignStore.currency ?? 'USD';

    return formatCurrency(amount, useCurrency);
  }

  /**
   * Runs basic pre-checkout validation against the current cart (e.g. rejects an
   * empty cart).
   *
   * @returns `valid: true` when checkout may proceed; otherwise `errors`
   *          contains human-readable reasons.
   *
   * @example
   * ```ts
   * const { valid, errors } = next.validateCheckout();
   * if (!valid) showErrors(errors);
   * ```
   */
  public validateCheckout(): { valid: boolean; errors: string[] } {
    const cartStore = useCartStore.getState();
    const errors: string[] = [];

    if (cartStore.items.length === 0) {
      errors.push('Cart is empty');
    }

    // Add more validation logic as needed

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Coupon methods
  /**
   * Applies a discount coupon to the cart. The cart store validates the code
   * against the campaign and recalculates totals on success.
   *
   * @param code - The coupon code to apply (case-sensitive).
   * @returns An object describing whether the code was accepted and a
   *          human-readable message suitable for display.
   *
   * @example
   * ```ts
   * const result = await next.applyCoupon('SAVE10');
   * if (!result.success) showError(result.message);
   * ```
   */
  public async applyCoupon(
    code: string
  ): Promise<{ success: boolean; message: string }> {
    const cartStore = useCartStore.getState();
    return await cartStore.applyCoupon(code);
  }

  /**
   * Removes a previously applied coupon from the cart and recalculates totals.
   *
   * @param code - The coupon code to remove.
   *
   * @example
   * ```ts
   * next.removeCoupon('SAVE10');
   * ```
   */
  public removeCoupon(code: string): void {
    const cartStore = useCartStore.getState();
    cartStore.removeCoupon(code);
  }

  /**
   * Returns the coupon codes currently applied to the cart.
   *
   * @returns The applied coupon codes (empty if none).
   *
   * @example
   * ```ts
   * const hasCoupon = next.getCoupons().length > 0;
   * ```
   */
  public getCoupons(): string[] {
    const cartStore = useCartStore.getState();
    return cartStore.getCoupons();
  }

  // Exit Intent - Simple approach
  /**
   * Configures and arms an exit-intent popup. The popup shows an image (and
   * optional action) when the user signals they are about to leave. Lazily
   * loads the exit-intent enhancer on first call.
   *
   * @param options - Exit-intent configuration (image/template, trigger limits,
   *                  mobile behavior, session persistence, and an optional
   *                  `action` callback).
   * @returns Resolves once the popup is configured and armed.
   *
   * @example
   * ```ts
   * await next.exitIntent({
   *   image: 'https://cdn.example/save10.png',
   *   action: () => next.applyCoupon('SAVE10'),
   *   maxTriggers: 1,
   * });
   * ```
   */
  public async exitIntent(options: {
    image?: string;
    template?: string;
    action?: () => void | Promise<void>;
    disableOnMobile?: boolean;
    mobileScrollTrigger?: boolean;
    maxTriggers?: number;
    useSessionStorage?: boolean;
    sessionStorageKey?: string;
    overlayClosable?: boolean;
    showCloseButton?: boolean;
    imageClickable?: boolean;
    actionButtonText?: string;
  }): Promise<void> {
    try {
      // Lazy load the enhancer
      if (!this.exitIntentEnhancer) {
        const { ExitIntentEnhancer } = await import(
          '@/enhancers/behavior/SimpleExitIntentEnhancer'
        );
        this.exitIntentEnhancer = new ExitIntentEnhancer();
        await this.exitIntentEnhancer.initialize();
      }

      // Set up exit intent with simple config
      this.exitIntentEnhancer.setup(options);
      this.logger.debug('Exit intent configured with image:', options.image);
    } catch (error) {
      this.logger.error('Failed to setup exit intent:', error);
      throw error;
    }
  }

  /**
   * Disables a previously configured exit-intent popup so it stops triggering.
   *
   * @example
   * ```ts
   * next.disableExitIntent();
   * ```
   */
  public disableExitIntent(): void {
    if (this.exitIntentEnhancer) {
      this.exitIntentEnhancer.disable();
    }
  }

  // FOMO Popup - Simple social proof
  private fomoEnhancer: any = null;

  /**
   * Configures and starts a FOMO (social-proof) popup that cycles through recent
   * "purchase" notifications. Lazily loads the FOMO enhancer on first call.
   *
   * @param config - Optional FOMO settings: the notification `items`, per-country
   *                 `customers`, display timing, and mobile show cap.
   * @returns Resolves once the popup has started.
   *
   * @example
   * ```ts
   * await next.fomo({
   *   items: [{ text: 'Someone just bought the Starter Kit', image: '/p.png' }],
   *   displayDuration: 4000,
   *   delayBetween: 8000,
   * });
   * ```
   */
  public async fomo(config?: {
    items?: Array<{ text: string; image: string }>;
    customers?: { [country: string]: string[] };
    maxMobileShows?: number;
    displayDuration?: number;
    delayBetween?: number;
    initialDelay?: number;
  }): Promise<void> {
    try {
      // Lazy load the enhancer
      if (!this.fomoEnhancer) {
        const { FomoPopupEnhancer } = await import(
          '@/enhancers/behavior/FomoPopupEnhancer'
        );
        this.fomoEnhancer = new FomoPopupEnhancer();
        await this.fomoEnhancer.initialize();
      }

      // Configure and start
      this.fomoEnhancer.setup(config);
      this.fomoEnhancer.start();
      this.logger.debug('FOMO popup started');
    } catch (error) {
      this.logger.error('Failed to start FOMO popup:', error);
      throw error;
    }
  }

  /**
   * Stops a running FOMO popup.
   *
   * @example
   * ```ts
   * next.stopFomo();
   * ```
   */
  public stopFomo(): void {
    if (this.fomoEnhancer) {
      this.fomoEnhancer.stop();
    }
  }

  // Upsell methods
  /**
   * Adds one or more post-purchase upsell items to the completed order.
   *
   * Unlike {@link NextCommerce.addItem}, this writes to the order via the
   * post-purchase API — not the cart. It is only valid after an order exists
   * and while the order still accepts upsells
   * (see {@link NextCommerce.canAddUpsells}).
   *
   * @param options - A single package (`packageId` + optional `quantity`) or a
   *                  batch via `items`. One of the two must be provided.
   * @returns The updated order, the newly added lines, and their total value.
   * @throws If no order exists, the order no longer accepts upsells, or neither
   *         `packageId` nor `items` was supplied.
   *
   * @example
   * ```ts
   * if (next.canAddUpsells()) {
   *   const { totalValue } = await next.addUpsell({ packageId: 7, quantity: 1 });
   *   console.log('Upsell added, value:', totalValue);
   * }
   * ```
   */
  public async addUpsell(options: {
    packageId?: number;
    quantity?: number;
    items?: Array<{ packageId: number; quantity?: number }>;
  }): Promise<any> {
    const orderStore = useOrderStore.getState();
    const configStore = useConfigStore.getState();

    // Check if order exists
    if (!orderStore.order) {
      throw new Error(
        'No order found. Upsells can only be added after order completion.'
      );
    }

    // Check if order supports upsells
    if (!orderStore.canAddUpsells()) {
      throw new Error(
        'Order does not support post-purchase upsells or is currently processing.'
      );
    }

    // Create API client
    const apiClient = new ApiClient(configStore.apiKey);

    // Build upsell data - support both single item and multiple items
    let lines: Array<{ package_id: number; quantity: number }> = [];

    if (options.items && options.items.length > 0) {
      // Multiple items provided
      lines = options.items.map(item => ({
        package_id: item.packageId,
        quantity: item.quantity || 1,
      }));
    } else if (options.packageId) {
      // Single item provided
      lines = [
        {
          package_id: options.packageId,
          quantity: options.quantity || 1,
        },
      ];
    } else {
      throw new Error('Either packageId or items array must be provided');
    }

    const upsellData: AddUpsellLine = { lines };

    this.logger.info('Adding upsell(s) via SDK:', upsellData);

    try {
      // Store previous line IDs to identify new additions
      const previousLineIds =
        orderStore.order?.lines?.map((line: any) => line.id) || [];

      // Add the upsell(s)
      const updatedOrder = await orderStore.addUpsell(upsellData, apiClient);

      if (!updatedOrder) {
        throw new Error('Failed to add upsell - no updated order returned');
      }

      // Find all newly added upsell lines
      const addedLines =
        updatedOrder.lines?.filter(
          (line: any) => line.is_upsell && !previousLineIds.includes(line.id)
        ) || [];

      // Calculate total value of added upsells
      const totalUpsellValue = addedLines.reduce((sum: number, line: any) => {
        return (
          sum + (line.price_incl_tax ? parseFloat(line.price_incl_tax) : 0)
        );
      }, 0);

      // Emit event for each added item
      lines.forEach((line, index) => {
        const addedLine = addedLines[index];
        const value = addedLine?.price_incl_tax
          ? parseFloat(addedLine.price_incl_tax)
          : 0;

        this.eventBus.emit('upsell:added', {
          packageId: line.package_id,
          quantity: line.quantity,
          order: updatedOrder,
          value: value,
        });
      });

      return {
        order: updatedOrder,
        addedLines: addedLines,
        totalValue: totalUpsellValue,
      };
    } catch (error) {
      this.logger.error('Failed to add upsell(s) via SDK:', error);
      throw error;
    }
  }

  /**
   * Reports whether the current order can still accept post-purchase upsells.
   * Guard {@link NextCommerce.addUpsell} calls with this.
   *
   * @returns `true` if an order exists and still accepts upsells.
   *
   * @example
   * ```ts
   * if (next.canAddUpsells()) await next.addUpsell({ packageId: 7 });
   * ```
   */
  public canAddUpsells(): boolean {
    const orderStore = useOrderStore.getState();
    return orderStore.canAddUpsells();
  }

  /**
   * Returns the package ids of upsells already added to the current order.
   *
   * @returns The completed upsell package ids (as strings).
   *
   * @example
   * ```ts
   * const done = next.getCompletedUpsells();
   * ```
   */
  public getCompletedUpsells(): string[] {
    const orderStore = useOrderStore.getState();
    return orderStore.completedUpsells;
  }

  /**
   * Checks whether a package has already been added as an upsell, or accepted in
   * the upsell journey — useful to avoid offering the same upsell twice.
   *
   * @param packageId - The upsell package id to check.
   * @returns `true` if the upsell was already added or accepted.
   *
   * @example
   * ```ts
   * if (!next.isUpsellAlreadyAdded(7)) showUpsellOffer(7);
   * ```
   */
  public isUpsellAlreadyAdded(packageId: number): boolean {
    const orderStore = useOrderStore.getState();

    // Check in completed upsells
    if (orderStore.completedUpsells.includes(packageId.toString())) {
      return true;
    }

    // Also check in upsell journey for accepted items
    const acceptedInJourney = orderStore.upsellJourney.some(
      entry =>
        entry.packageId === packageId.toString() && entry.action === 'accepted'
    );

    return acceptedInJourney;
  }

  // URL Parameter Methods
  /**
   * Sets a single tracked URL parameter in the parameter store.
   *
   * @param key - The parameter name.
   * @param value - The parameter value.
   *
   * @example
   * ```ts
   * next.setParam('ref', 'newsletter');
   * ```
   */
  public setParam(key: string, value: string): void {
    const paramStore = useParameterStore.getState();
    paramStore.updateParam(key, value);
    this.logger.debug(`URL parameter set: ${key}=${value}`);
  }

  /**
   * Replaces all tracked URL parameters with the provided set.
   *
   * @param params - The complete set of parameters to store.
   *
   * @example
   * ```ts
   * next.setParams({ ref: 'newsletter', variant: 'B' });
   * ```
   */
  public setParams(params: Record<string, string>): void {
    const paramStore = useParameterStore.getState();
    paramStore.updateParams(params);
    this.logger.debug('URL parameters set:', params);
  }

  /**
   * Reads a single tracked URL parameter.
   *
   * @param key - The parameter name.
   * @returns The value, or `null` if the parameter is not set.
   *
   * @example
   * ```ts
   * const ref = next.getParam('ref');
   * ```
   */
  public getParam(key: string): string | null {
    const paramStore = useParameterStore.getState();
    const value = paramStore.getParam(key);
    return value !== undefined ? value : null;
  }

  /**
   * Returns all tracked URL parameters.
   *
   * @returns A map of every stored parameter name to its value.
   *
   * @example
   * ```ts
   * const all = next.getAllParams();
   * ```
   */
  public getAllParams(): Record<string, string> {
    const paramStore = useParameterStore.getState();
    return paramStore.params;
  }

  /**
   * Checks whether a tracked URL parameter is set.
   *
   * @param key - The parameter name.
   * @returns `true` if the parameter exists.
   *
   * @example
   * ```ts
   * if (next.hasParam('ref')) trackReferral();
   * ```
   */
  public hasParam(key: string): boolean {
    const paramStore = useParameterStore.getState();
    return paramStore.hasParam(key);
  }

  /**
   * Removes a single tracked URL parameter.
   *
   * @param key - The parameter name to remove.
   *
   * @example
   * ```ts
   * next.clearParam('ref');
   * ```
   */
  public clearParam(key: string): void {
    const paramStore = useParameterStore.getState();
    const newParams = { ...paramStore.params };
    delete newParams[key];
    paramStore.updateParams(newParams);
    this.logger.debug(`URL parameter cleared: ${key}`);
  }

  /**
   * Removes all tracked URL parameters.
   *
   * @example
   * ```ts
   * next.clearAllParams();
   * ```
   */
  public clearAllParams(): void {
    const paramStore = useParameterStore.getState();
    paramStore.updateParams({});
    this.logger.debug('All URL parameters cleared');
  }

  /**
   * Merges the given parameters into the existing tracked set, overwriting any
   * keys that already exist and keeping the rest.
   *
   * @param params - The parameters to merge in.
   *
   * @example
   * ```ts
   * next.mergeParams({ variant: 'C' }); // keeps other existing params
   * ```
   */
  public mergeParams(params: Record<string, string>): void {
    const paramStore = useParameterStore.getState();
    paramStore.mergeParams(params);
    this.logger.debug('URL parameters merged:', params);
  }
}
