/**
 * Main SDK class providing programmatic API access
 * This is the public interface for advanced users who need direct access to SDK functionality
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
import { useCartStore, cartOperations } from '@/state/cart';
import { useCampaignStore } from '@/state/campaign';
import { useCheckoutStore } from '@/state/checkout';
import { useOrderStore } from '@/state/order';
import { useConfigStore } from '@/state/config';
import { useAttributionStore } from '@/state/attribution';
import { useParameterStore } from '@/state/parameter';
import { EventBus } from '@/core/events';
import { Logger } from '@/core/logger';
import { getApiClient } from '@/client';

/**
 * The programmatic SDK facade — the scriptable counterpart to the `data-next-*`
 * attributes. A single instance is created during initialization and exposed as
 * `window.next`, so most code obtains it directly rather than constructing one.
 *
 * Use it to read cart/campaign state, drive the cart ({@link NextCommerce.cart}),
 * subscribe to events, and fire analytics — all without touching the DOM layer.
 *
 * @example
 * ```ts
 * const sdk = window.next; // created by the SDK on load
 *
 * // React to cart changes
 * sdk.on('cart:updated', cart => render(cart.total));
 *
 * // Drive the cart from code
 * await sdk.cart.addItem({ packageId: 2, quantity: 1, isUpsell: false });
 *
 * // Read current state
 * const { total } = sdk.getCartTotals();
 * ```
 *
 * @category Core
 */
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
   * Returns the shared SDK instance, creating it on first call.
   *
   * @returns The singleton `NextCommerce` (the same object exposed as `window.next`).
   * @category Core
   */
  public static getInstance(): NextCommerce {
    if (!NextCommerce.instance) {
      NextCommerce.instance = new NextCommerce();
    }
    return NextCommerce.instance;
  }

  /**
   * The programmatic cart API — the blessed way to drive the cart in code.
   * Backed by the cart operations layer (`@/state/cart/operations`).
   *
   * @example
   * ```ts
   * await sdk.cart.addItem({ packageId: 2, quantity: 1, isUpsell: false });
   * await sdk.cart.updateQuantity(2, 3);
   * await sdk.cart.applyCoupon('SAVE10');
   * ```
   *
   * @category Cart
   */
  public get cart() {
    return cartOperations;
  }

  /**
   * Whether a package is currently in the cart.
   *
   * @param options.packageId - The package `ref_id` to look for.
   * @returns `true` if an item with that package id is in the cart.
   * @category Cart
   */
  public hasItemInCart(options: { packageId?: number }): boolean {
    const cartStore = useCartStore.getState();

    if (options.packageId) {
      return cartStore.items.some(item => item.packageId === options.packageId);
    }

    return false;
  }

  /**
   * Adds a package to the cart (quantity defaults to 1). No-op if `packageId`
   * is omitted. For upsell adds use {@link NextCommerce.cart}.
   *
   * @example
   * ```ts
   * await sdk.addItem({ packageId: 2, quantity: 2 });
   * ```
   * @category Cart
   */
  public async addItem(options: {
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
  public async removeItem(options: { packageId?: number }): Promise<void> {
    if (options.packageId) {
      await cartOperations.removeItem(options.packageId);
    }
  }

  /**
   * Sets the exact quantity for a package (a quantity of 0 removes it).
   * @category Cart
   */
  public async updateQuantity(options: {
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
  public async clearCart(): Promise<void> {
    cartOperations.clear();
  }

  /**
   * Replaces the entire cart contents with the given items in one atomic swap
   * (used by bundle/package selectors). Existing items not listed are removed.
   * @category Cart
   */
  public async swapCart(
    items: Array<{ packageId: number; quantity: number }>
  ): Promise<void> {
    await cartOperations.swapCart(items);
    this.logger.debug(`Cart swapped with ${items.length} items`);
  }

  /**
   * A snapshot of the full cart for callbacks — enriched line items, totals,
   * campaign data, and applied vouchers.
   * @category Cart
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
   * The current cart totals (subtotal, total, discounts, shipping) as `Decimal`s.
   * @category Cart
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
   * Total number of units in the cart (sum of item quantities).
   * @category Cart
   */
  public getCartCount(): number {
    const cartStore = useCartStore.getState();
    return cartStore.totalQuantity;
  }

  /**
   * The loaded campaign (packages, currency, shipping methods), or `null` if it
   * hasn't loaded yet.
   * @category Campaign
   */
  public getCampaignData(): Campaign | null {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.data;
  }

  /**
   * Looks up a package by its `ref_id` in the loaded campaign.
   * @category Campaign
   */
  public getPackage(id: number): any | null {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.getPackage(id);
  }

  /**
   * All variant packages for a product id (variant selection support).
   * @category Campaign
   */
  public getVariantsByProductId(productId: number): any | null {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.getVariantsByProductId(productId);
  }

  /**
   * The distinct values available for one variant attribute (e.g. all sizes) of
   * a product — used to build variant pickers.
   * @category Campaign
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
   * Resolves the concrete package for a product given a full set of selected
   * variant attributes (e.g. `{ color: 'red', size: 'L' }`).
   * @category Campaign
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
   * Builds a stable, order-independent key from a set of variant attributes
   * (e.g. `color:red|size:L`) for use as a lookup/map key.
   * @category Campaign
   */
  public createVariantKey(attributes: Record<string, string>): string {
    // color:red|size:L — sorted so key order never matters
    return Object.entries(attributes)
      .map(([code, value]) => `${code}:${value}`)
      .sort()
      .join('|');
  }

  /**
   * Subscribes to an SDK event. Names and payloads are typed via `EventMap`.
   *
   * @example
   * ```ts
   * sdk.on('cart:item-added', ({ packageId, quantity }) => { ... });
   * ```
   * @category Events
   */
  public on<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): void {
    this.eventBus.on(event, handler);
  }

  /**
   * Unsubscribes a handler previously registered with {@link NextCommerce.on}.
   * @category Events
   */
  public off<K extends keyof EventMap>(event: K, handler: Function): void {
    this.eventBus.off(event, handler);
  }

  /**
   * Registers a callback for a lifecycle callback type (e.g. cart/order hooks).
   * Prefer {@link NextCommerce.on} for event-style subscriptions.
   * @category Events
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
   * Removes a callback registered with {@link NextCommerce.registerCallback}.
   * @category Events
   */
  public unregisterCallback(type: CallbackType, callback: Function): void {
    this.callbacks.get(type)?.delete(callback);
  }

  /**
   * Invokes all callbacks registered for a type (errors are caught and logged).
   * @category Events
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
   * Reports a list of packages as viewed — a product grid or recommendation
   * rail. `_listId` is accepted and ignored; the list name is the third
   * argument.
   * @category Analytics
   */
  public async trackViewItemList(
    packageIds: (string | number)[],
    _listId?: string,
    listName?: string
  ): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
        nextAnalytics.trackViewItemList(packageIds, listName);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Reports one package as viewed. Warns and sends nothing when the package is
   * not in the loaded campaign, so an early call is silently dropped.
   * @category Analytics
   */
  public async trackViewItem(packageId: string | number): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
        const { useCampaignStore } = await import('@/state/campaign');

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
   * Reports an add-to-cart that happened outside the SDK's own cart calls.
   * Pairing it with {@link NextCommerce.addItem} reports the add twice.
   * @category Analytics
   */
  public async trackAddToCart(
    packageId: string | number,
    quantity?: number
  ): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
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
   * Reports a removal that happened outside the SDK's own cart calls. Pairing
   * it with {@link NextCommerce.removeItem} reports the removal twice.
   * @category Analytics
   */
  public async trackRemoveFromCart(
    packageId: string | number,
    quantity?: number
  ): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics, EcommerceEvents } = await import(
          '@/core/analytics/index'
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
   * Reports checkout starting, from the current cart. The built-in checkout
   * form already fires this — call it only for a hand-built flow.
   * @category Analytics
   */
  public async trackBeginCheckout(): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
        nextAnalytics.trackBeginCheckout();
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Reports a completed order from an order payload. The receipt page already
   * fires this; a second call doubles reported revenue.
   * @category Analytics
   */
  public async trackPurchase(orderData: any): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
        nextAnalytics.trackPurchase(orderData);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Sends an event of the caller's own naming. Nothing validates the name or
   * the payload, so a typo becomes a new event name.
   * @category Analytics
   */
  public async trackCustomEvent(
    eventName: string,
    data?: Record<string, any>
  ): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
        nextAnalytics.track({ event: eventName, ...data });
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  // User tracking methods
  /**
   * Reports a newsletter or account sign-up. The address goes into the event
   * payload as `customer_email` in the clear — nothing hashes it — so it reaches
   * every configured provider and the browser data layer as plain text.
   * @category Analytics
   */
  public async trackSignUp(email: string): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
        nextAnalytics.trackSignUp(email);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  /**
   * Reports a returning visitor signing in. Carries the address in the clear,
   * exactly as {@link NextCommerce.trackSignUp} does.
   * @category Analytics
   */
  public async trackLogin(email: string): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
        nextAnalytics.trackLogin(email);
      } catch (error) {
        this.logger.debug('Analytics tracking failed (non-critical):', error);
      }
    });
  }

  // Advanced analytics methods
  /**
   * Turns verbose analytics logging on or off at runtime. Unrelated to the
   * debug overlay, which is `?debugger=true` or `window.nextConfig.debugger`.
   * @category Analytics
   */
  public async setDebugMode(enabled: boolean): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
        nextAnalytics.setDebugMode(enabled);
      } catch (error) {
        this.logger.debug('Analytics debug mode failed (non-critical):', error);
      }
    });
  }

  /**
   * Discards the cached page context so the next event is built from the
   * current route. Needed in a single-page app, where no page load resets it.
   * @category Analytics
   */
  public async invalidateAnalyticsContext(): Promise<void> {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import('@/core/analytics/index');
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
   * Adds one key to the attribution metadata sent with the order, merging so
   * the automatically collected fields survive.
   * @category Metadata
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
   * Adds several keys to the attribution metadata. Merges rather than
   * replaces, despite the name — a true replace would wipe the automatic
   * fields.
   * @category Metadata
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
   * Drops caller-supplied metadata while preserving the automatic fields
   * (`landing_page`, `referrer`, `device`, `device_type`, `domain`,
   * `timestamp`).
   * @category Metadata
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
   * The attribution metadata as stored. `undefined` means the read failed; an
   * empty bag is `{}`.
   * @category Metadata
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
   * Overwrites the collected attribution — funnel, affiliate, `utm_*`. This
   * decides who is credited for the sale, so it is a reporting change.
   * @category Attribution
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
   * Attribution in the shape sent to the order API, not the raw store — the
   * right thing to log when an order is attributed wrongly.
   * @category Attribution
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
   * Prints the whole attribution state to the console. Returns nothing; use
   * {@link NextCommerce.getAttribution} when you need a value.
   * @category Attribution
   */
  public debugAttribution(): void {
    try {
      const store = useAttributionStore.getState();
      store.debug();
    } catch (error) {
      this.logger.error('Failed to debug attribution:', error);
    }
  }

  /**
   * All shipping methods available in the loaded campaign.
   * @category Shipping
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
   * The currently selected shipping method, or `null` if none chosen yet.
   * @category Shipping
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
   * Selects a shipping method by id and recalculates cart totals. Throws if the
   * id isn't in the campaign's shipping methods.
   * @category Shipping
   */
  public async setShippingMethod(methodId: number): Promise<void> {
    // Delegate to the cart operation which handles validation and syncing
    await cartOperations.setShippingMethod(methodId);
  }

  /**
   * The resolved SDK version (runtime loader value if present, else build-time).
   * @category Utility
   */
  public getVersion(): string {
    // Return the runtime detected version from loader, or fallback to build version
    if (typeof window !== 'undefined' && window.__NEXT_SDK_VERSION__) {
      return window.__NEXT_SDK_VERSION__;
    }
    return __VERSION__; // Replaced at build time with the package.json version
  }

  /**
   * Formats an amount using the campaign currency (or an override), e.g. `$19.99`.
   * @category Utility
   */
  public formatPrice(amount: number, currency?: string): string {
    const { formatCurrency } = require('@/core/currency-formatter');
    const campaignStore = useCampaignStore.getState();
    const useCurrency = currency ?? campaignStore.currency ?? 'USD';

    return formatCurrency(amount, useCurrency);
  }

  /**
   * Lightweight pre-checkout validation (currently: cart must not be empty).
   * @category Utility
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
  public async applyCoupon(
    code: string
  ): Promise<{ success: boolean; message: string }> {
    return await cartOperations.applyCoupon(code);
  }

  /**
   * Removes a previously applied coupon and recalculates totals.
   * @category Coupons
   */
  public removeCoupon(code: string): void {
    void cartOperations.removeCoupon(code);
  }

  /**
   * The coupon codes currently applied to the cart.
   * @category Coupons
   */
  public getCoupons(): string[] {
    const cartStore = useCartStore.getState();
    return cartStore.getCoupons();
  }

  // Exit Intent - Simple approach
  /**
   * Arms the exit-intent popup, lazy-loading its enhancer on the first call.
   * Rethrows when that import fails.
   * @category Popups
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
          '@/features/behavior/simple-exit-intent'
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
   * Stops the exit-intent popup from appearing again. No-op when {@link
   * NextCommerce.exitIntent} was never called.
   * @category Popups
   */
  public disableExitIntent(): void {
    if (this.exitIntentEnhancer) {
      this.exitIntentEnhancer.disable();
    }
  }

  // FOMO Popup - Simple social proof
  private fomoEnhancer: any = null;

  /**
   * Starts the rotating social-proof popup, lazy-loading its enhancer on the
   * first call. With no config it uses the enhancer's own defaults.
   * @category Popups
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
          '@/features/behavior/fomo-popup'
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
   * Stops the social-proof popup rotation. No-op when {@link
   * NextCommerce.fomo} was never called.
   * @category Popups
   */
  public stopFomo(): void {
    if (this.fomoEnhancer) {
      this.fomoEnhancer.stop();
    }
  }

  // Upsell methods
  /**
   * Adds packages to the already-paid order, charging the saved payment
   * method. Throws when there is no order in session, when the order cannot
   * take upsells or is mid-processing, and when neither `packageId` nor
   * `items` is given.
   * @category Upsells
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

    // The shared API client for this page
    const apiClient = getApiClient(configStore.apiKey);

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
   * Whether the order in session can take a post-purchase upsell right now.
   * Also `false` while one is processing, so it guards a double submit.
   * @category Upsells
   */
  public canAddUpsells(): boolean {
    const orderStore = useOrderStore.getState();
    return orderStore.canAddUpsells();
  }

  /**
   * Package ids already accepted on this order, as strings rather than
   * numbers.
   * @category Upsells
   */
  public getCompletedUpsells(): string[] {
    const orderStore = useOrderStore.getState();
    return orderStore.completedUpsells;
  }

  /**
   * Whether a package was already accepted on this order — checks the
   * completed list and the accepted entries of the upsell journey, so it
   * survives a reload.
   * @category Upsells
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
   * Sets one captured URL parameter for the rest of the session. Does not
   * touch the address bar.
   * @category URL Parameters
   */
  public setParam(key: string, value: string): void {
    const paramStore = useParameterStore.getState();
    paramStore.updateParam(key, value);
    this.logger.debug(`URL parameter set: ${key}=${value}`);
  }

  /**
   * Sets several captured URL parameters, replacing the keys named and leaving
   * the rest alone.
   * @category URL Parameters
   */
  public setParams(params: Record<string, string>): void {
    const paramStore = useParameterStore.getState();
    paramStore.updateParams(params);
    this.logger.debug('URL parameters set:', params);
  }

  /**
   * Reads one captured URL parameter. `null` when it was never captured.
   * @category URL Parameters
   */
  public getParam(key: string): string | null {
    const paramStore = useParameterStore.getState();
    const value = paramStore.getParam(key);
    return value !== undefined ? value : null;
  }

  /**
   * Every URL parameter captured for this session.
   * @category URL Parameters
   */
  public getAllParams(): Record<string, string> {
    const paramStore = useParameterStore.getState();
    return paramStore.params;
  }

  /**
   * Whether a parameter was captured, including one present with an empty
   * value.
   * @category URL Parameters
   */
  public hasParam(key: string): boolean {
    const paramStore = useParameterStore.getState();
    return paramStore.hasParam(key);
  }

  /**
   * Forgets one captured URL parameter.
   * @category URL Parameters
   */
  public clearParam(key: string): void {
    const paramStore = useParameterStore.getState();
    const newParams = { ...paramStore.params };
    delete newParams[key];
    paramStore.updateParams(newParams);
    this.logger.debug(`URL parameter cleared: ${key}`);
  }

  /**
   * Forgets every captured URL parameter — `utm_*` values included, which
   * attribution reads.
   * @category URL Parameters
   */
  public clearAllParams(): void {
    const paramStore = useParameterStore.getState();
    paramStore.updateParams({});
    this.logger.debug('All URL parameters cleared');
  }

  /**
   * Adds parameters to the captured set without disturbing keys it does not
   * name.
   * @category URL Parameters
   */
  public mergeParams(params: Record<string, string>): void {
    const paramStore = useParameterStore.getState();
    paramStore.mergeParams(params);
    this.logger.debug('URL parameters merged:', params);
  }
}
