import { e as cartOperations, d as useCartStore, a as useCampaignStore, b as useAttributionStore, u as useCheckoutStore, f as useOrderStore, c as configStore, g as useParameterStore, C as CART_STORAGE_KEY } from "./state-Cak3W8JX.js";
import { L as Logger, E as EventBus, c as createLogger, a as LogLevel } from "./analytics-rw-aPuCY.js";
import { ApiClient } from "./api-CRcj6hKl.js";
import { C as CountryService } from "./debug-CFtPX9Fq.js";
class NextCommerce {
  constructor() {
    this.callbacks = /* @__PURE__ */ new Map();
    this.exitIntentEnhancer = null;
    this.fomoEnhancer = null;
    this.logger = new Logger("NextCommerce");
    this.eventBus = EventBus.getInstance();
  }
  /**
   * Returns the shared SDK instance, creating it on first call.
   *
   * @returns The singleton `NextCommerce` (the same object exposed as `window.next`).
   * @category Core
   */
  static getInstance() {
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
  get cart() {
    return cartOperations;
  }
  /**
   * Whether a package is currently in the cart.
   *
   * @param options.packageId - The package `ref_id` to look for.
   * @returns `true` if an item with that package id is in the cart.
   * @category Cart
   */
  hasItemInCart(options) {
    const cartStore = useCartStore.getState();
    if (options.packageId) {
      return cartStore.items.some((item) => item.packageId === options.packageId);
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
  async addItem(options) {
    const quantity = options.quantity ?? 1;
    if (options.packageId) {
      await cartOperations.addItem({
        packageId: options.packageId,
        quantity,
        isUpsell: false
      });
    }
  }
  /**
   * Removes a package from the cart entirely. No-op if `packageId` is omitted.
   * @category Cart
   */
  async removeItem(options) {
    if (options.packageId) {
      await cartOperations.removeItem(options.packageId);
    }
  }
  /**
   * Sets the exact quantity for a package (a quantity of 0 removes it).
   * @category Cart
   */
  async updateQuantity(options) {
    if (options.packageId) {
      await cartOperations.updateQuantity(options.packageId, options.quantity);
    }
  }
  /**
   * Empties the cart.
   * @category Cart
   */
  async clearCart() {
    cartOperations.clear();
  }
  /**
   * Replaces the entire cart contents with the given items in one atomic swap
   * (used by bundle/package selectors). Existing items not listed are removed.
   * @category Cart
   */
  async swapCart(items) {
    await cartOperations.swapCart(items);
    this.logger.debug(`Cart swapped with ${items.length} items`);
  }
  /**
   * A snapshot of the full cart for callbacks — enriched line items, totals,
   * campaign data, and applied vouchers.
   * @category Cart
   */
  getCartData() {
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
        shippingMethod: cartStore.shippingMethod
      },
      campaignData: campaignStore.data,
      vouchers: cartStore.getCoupons()
    };
  }
  /**
   * The current cart totals (subtotal, total, discounts, shipping) as `Decimal`s.
   * @category Cart
   */
  getCartTotals() {
    const cartStore = useCartStore.getState();
    return {
      subtotal: cartStore.subtotal,
      total: cartStore.total,
      hasDiscounts: cartStore.hasDiscounts,
      totalDiscount: cartStore.totalDiscount,
      totalDiscountPercentage: cartStore.totalDiscountPercentage,
      shippingMethod: cartStore.shippingMethod
    };
  }
  /**
   * Total number of units in the cart (sum of item quantities).
   * @category Cart
   */
  getCartCount() {
    const cartStore = useCartStore.getState();
    return cartStore.totalQuantity;
  }
  /**
   * The loaded campaign (packages, currency, shipping methods), or `null` if it
   * hasn't loaded yet.
   * @category Campaign
   */
  getCampaignData() {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.data;
  }
  /**
   * Looks up a package by its `ref_id` in the loaded campaign.
   * @category Campaign
   */
  getPackage(id) {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.getPackage(id);
  }
  /**
   * All variant packages for a product id (variant selection support).
   * @category Campaign
   */
  getVariantsByProductId(productId) {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.getVariantsByProductId(productId);
  }
  /**
   * The distinct values available for one variant attribute (e.g. all sizes) of
   * a product — used to build variant pickers.
   * @category Campaign
   */
  getAvailableVariantAttributes(productId, attributeCode) {
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
  getPackageByVariantSelection(productId, selectedAttributes) {
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
  createVariantKey(attributes) {
    return Object.entries(attributes).map(([code, value]) => `${code}:${value}`).sort().join("|");
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
  on(event, handler) {
    this.eventBus.on(event, handler);
  }
  /**
   * Unsubscribes a handler previously registered with {@link NextCommerce.on}.
   * @category Events
   */
  off(event, handler) {
    this.eventBus.off(event, handler);
  }
  /**
   * Registers a callback for a lifecycle callback type (e.g. cart/order hooks).
   * Prefer {@link NextCommerce.on} for event-style subscriptions.
   * @category Events
   */
  registerCallback(type, callback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, /* @__PURE__ */ new Set());
    }
    this.callbacks.get(type).add(callback);
  }
  /**
   * Removes a callback registered with {@link NextCommerce.registerCallback}.
   * @category Events
   */
  unregisterCallback(type, callback) {
    this.callbacks.get(type)?.delete(callback);
  }
  /**
   * Invokes all callbacks registered for a type (errors are caught and logged).
   * @category Events
   */
  triggerCallback(type, data) {
    this.callbacks.get(type)?.forEach((callback) => {
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
  async trackViewItemList(packageIds, _listId, listName) {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        nextAnalytics.trackViewItemList(packageIds, listName);
      } catch (error) {
        this.logger.debug("Analytics tracking failed (non-critical):", error);
      }
    });
  }
  /**
   * Reports one package as viewed. Warns and sends nothing when the package is
   * not in the loaded campaign, so an early call is silently dropped.
   * @category Analytics
   */
  async trackViewItem(packageId) {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        const { useCampaignStore: useCampaignStore2 } = await import("./state-Cak3W8JX.js").then((n) => n.j);
        const packageIdNum = typeof packageId === "string" ? parseInt(packageId, 10) : packageId;
        const campaignStore = useCampaignStore2.getState();
        const packageData = campaignStore.getPackage(packageIdNum);
        if (!packageData) {
          this.logger.warn("Package not found in store:", packageIdNum);
          return;
        }
        const item = {
          packageId: packageIdNum,
          package_id: packageIdNum,
          id: packageIdNum
        };
        nextAnalytics.trackViewItem(item);
      } catch (error) {
        this.logger.debug("Analytics tracking failed (non-critical):", error);
      }
    });
  }
  /**
   * Reports an add-to-cart that happened outside the SDK's own cart calls.
   * Pairing it with {@link NextCommerce.addItem} reports the add twice.
   * @category Analytics
   */
  async trackAddToCart(packageId, quantity) {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        const item = {
          id: String(packageId),
          packageId,
          quantity: quantity || 1
        };
        nextAnalytics.trackAddToCart(item);
      } catch (error) {
        this.logger.debug("Analytics tracking failed (non-critical):", error);
      }
    });
  }
  /**
   * Reports a removal that happened outside the SDK's own cart calls. Pairing
   * it with {@link NextCommerce.removeItem} reports the removal twice.
   * @category Analytics
   */
  async trackRemoveFromCart(packageId, quantity) {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics, EcommerceEvents } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        nextAnalytics.track(
          EcommerceEvents.createRemoveFromCartEvent({
            packageId,
            quantity: quantity || 1
          })
        );
      } catch (error) {
        this.logger.debug("Analytics tracking failed (non-critical):", error);
      }
    });
  }
  /**
   * Reports checkout starting, from the current cart. The built-in checkout
   * form already fires this — call it only for a hand-built flow.
   * @category Analytics
   */
  async trackBeginCheckout() {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        nextAnalytics.trackBeginCheckout();
      } catch (error) {
        this.logger.debug("Analytics tracking failed (non-critical):", error);
      }
    });
  }
  /**
   * Reports a completed order from an order payload. The receipt page already
   * fires this; a second call doubles reported revenue.
   * @category Analytics
   */
  async trackPurchase(orderData) {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        nextAnalytics.trackPurchase(orderData);
      } catch (error) {
        this.logger.debug("Analytics tracking failed (non-critical):", error);
      }
    });
  }
  /**
   * Sends an event of the caller's own naming. Nothing validates the name or
   * the payload, so a typo becomes a new event name.
   * @category Analytics
   */
  async trackCustomEvent(eventName, data) {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        nextAnalytics.track({ event: eventName, ...data });
      } catch (error) {
        this.logger.debug("Analytics tracking failed (non-critical):", error);
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
  async trackSignUp(email) {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        nextAnalytics.trackSignUp(email);
      } catch (error) {
        this.logger.debug("Analytics tracking failed (non-critical):", error);
      }
    });
  }
  /**
   * Reports a returning visitor signing in. Carries the address in the clear,
   * exactly as {@link NextCommerce.trackSignUp} does.
   * @category Analytics
   */
  async trackLogin(email) {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        nextAnalytics.trackLogin(email);
      } catch (error) {
        this.logger.debug("Analytics tracking failed (non-critical):", error);
      }
    });
  }
  // Advanced analytics methods
  /**
   * Turns verbose analytics logging on or off at runtime. Unrelated to the
   * debug overlay, which is `?debugger=true` or `window.nextConfig.debugger`.
   * @category Analytics
   */
  async setDebugMode(enabled) {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        nextAnalytics.setDebugMode(enabled);
      } catch (error) {
        this.logger.debug("Analytics debug mode failed (non-critical):", error);
      }
    });
  }
  /**
   * Discards the cached page context so the next event is built from the
   * current route. Needed in a single-page app, where no page load resets it.
   * @category Analytics
   */
  async invalidateAnalyticsContext() {
    queueMicrotask(async () => {
      try {
        const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
        nextAnalytics.invalidateContext();
      } catch (error) {
        this.logger.debug(
          "Analytics context invalidation failed (non-critical):",
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
  addMetadata(key, value) {
    try {
      const store = useAttributionStore.getState();
      const currentMetadata = store.metadata || {};
      store.updateAttribution({
        metadata: {
          ...currentMetadata,
          [key]: value
        }
      });
      this.logger.debug(`Attribution metadata added: ${key}`, value);
    } catch (error) {
      this.logger.error("Failed to add attribution metadata:", error);
    }
  }
  /**
   * Adds several keys to the attribution metadata. Merges rather than
   * replaces, despite the name — a true replace would wipe the automatic
   * fields.
   * @category Metadata
   */
  setMetadata(metadata) {
    try {
      const store = useAttributionStore.getState();
      const currentMetadata = store.metadata || {};
      store.updateAttribution({
        metadata: {
          ...currentMetadata,
          ...metadata
        }
      });
      this.logger.debug("Attribution metadata set:", metadata);
    } catch (error) {
      this.logger.error("Failed to set attribution metadata:", error);
    }
  }
  /**
   * Drops caller-supplied metadata while preserving the automatic fields
   * (`landing_page`, `referrer`, `device`, `device_type`, `domain`,
   * `timestamp`).
   * @category Metadata
   */
  clearMetadata() {
    try {
      const store = useAttributionStore.getState();
      store.updateAttribution({
        metadata: {
          // Preserve automatic fields
          landing_page: store.metadata?.landing_page || "",
          referrer: store.metadata?.referrer || "",
          device: store.metadata?.device || "",
          device_type: store.metadata?.device_type || "desktop",
          domain: store.metadata?.domain || "",
          timestamp: store.metadata?.timestamp || Date.now()
        }
      });
      this.logger.debug("Attribution metadata cleared");
    } catch (error) {
      this.logger.error("Failed to clear attribution metadata:", error);
    }
  }
  /**
   * The attribution metadata as stored. `undefined` means the read failed; an
   * empty bag is `{}`.
   * @category Metadata
   */
  getMetadata() {
    try {
      const store = useAttributionStore.getState();
      return store.metadata;
    } catch (error) {
      this.logger.error("Failed to get attribution metadata:", error);
      return void 0;
    }
  }
  /**
   * Overwrites the collected attribution — funnel, affiliate, `utm_*`. This
   * decides who is credited for the sale, so it is a reporting change.
   * @category Attribution
   */
  setAttribution(attribution) {
    try {
      const store = useAttributionStore.getState();
      store.updateAttribution(attribution);
      this.logger.debug("Attribution set:", attribution);
    } catch (error) {
      this.logger.error("Failed to set attribution:", error);
    }
  }
  /**
   * Attribution in the shape sent to the order API, not the raw store — the
   * right thing to log when an order is attributed wrongly.
   * @category Attribution
   */
  getAttribution() {
    try {
      const store = useAttributionStore.getState();
      return store.getAttributionForApi();
    } catch (error) {
      this.logger.error("Failed to get attribution:", error);
      return void 0;
    }
  }
  /**
   * Prints the whole attribution state to the console. Returns nothing; use
   * {@link NextCommerce.getAttribution} when you need a value.
   * @category Attribution
   */
  debugAttribution() {
    try {
      const store = useAttributionStore.getState();
      store.debug();
    } catch (error) {
      this.logger.error("Failed to debug attribution:", error);
    }
  }
  /**
   * All shipping methods available in the loaded campaign.
   * @category Shipping
   */
  getShippingMethods() {
    const campaignStore = useCampaignStore.getState();
    return campaignStore.data?.shipping_methods || [];
  }
  /**
   * The currently selected shipping method, or `null` if none chosen yet.
   * @category Shipping
   */
  getSelectedShippingMethod() {
    const checkoutStore = useCheckoutStore.getState();
    return checkoutStore.shippingMethod || null;
  }
  /**
   * Selects a shipping method by id and recalculates cart totals. Throws if the
   * id isn't in the campaign's shipping methods.
   * @category Shipping
   */
  async setShippingMethod(methodId) {
    await cartOperations.setShippingMethod(methodId);
  }
  /**
   * The resolved SDK version (runtime loader value if present, else build-time).
   * @category Utility
   */
  getVersion() {
    if (typeof window !== "undefined" && window.__NEXT_SDK_VERSION__) {
      return window.__NEXT_SDK_VERSION__;
    }
    return "0.4.30";
  }
  /**
   * Formats an amount using the campaign currency (or an override), e.g. `$19.99`.
   * @category Utility
   */
  formatPrice(amount, currency) {
    const { formatCurrency } = require("@/utils/currencyFormatter");
    const campaignStore = useCampaignStore.getState();
    const useCurrency = currency ?? campaignStore.currency ?? "USD";
    return formatCurrency(amount, useCurrency);
  }
  /**
   * Lightweight pre-checkout validation (currently: cart must not be empty).
   * @category Utility
   */
  validateCheckout() {
    const cartStore = useCartStore.getState();
    const errors = [];
    if (cartStore.items.length === 0) {
      errors.push("Cart is empty");
    }
    return {
      valid: errors.length === 0,
      errors
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
  async applyCoupon(code) {
    return await cartOperations.applyCoupon(code);
  }
  /**
   * Removes a previously applied coupon and recalculates totals.
   * @category Coupons
   */
  removeCoupon(code) {
    void cartOperations.removeCoupon(code);
  }
  /**
   * The coupon codes currently applied to the cart.
   * @category Coupons
   */
  getCoupons() {
    const cartStore = useCartStore.getState();
    return cartStore.getCoupons();
  }
  // Exit Intent - Simple approach
  /**
   * Arms the exit-intent popup, lazy-loading its enhancer on the first call.
   * Rethrows when that import fails.
   * @category Popups
   */
  async exitIntent(options) {
    try {
      if (!this.exitIntentEnhancer) {
        const { ExitIntentEnhancer } = await import("./simple-exit-intent.enhancer-DH3UazqV.js");
        this.exitIntentEnhancer = new ExitIntentEnhancer();
        await this.exitIntentEnhancer.initialize();
      }
      this.exitIntentEnhancer.setup(options);
      this.logger.debug("Exit intent configured with image:", options.image);
    } catch (error) {
      this.logger.error("Failed to setup exit intent:", error);
      throw error;
    }
  }
  /**
   * Stops the exit-intent popup from appearing again. No-op when {@link
   * NextCommerce.exitIntent} was never called.
   * @category Popups
   */
  disableExitIntent() {
    if (this.exitIntentEnhancer) {
      this.exitIntentEnhancer.disable();
    }
  }
  /**
   * Starts the rotating social-proof popup, lazy-loading its enhancer on the
   * first call. With no config it uses the enhancer's own defaults.
   * @category Popups
   */
  async fomo(config) {
    try {
      if (!this.fomoEnhancer) {
        const { FomoPopupEnhancer } = await import("./fomo-popup.enhancer-D7JZlmmV.js");
        this.fomoEnhancer = new FomoPopupEnhancer();
        await this.fomoEnhancer.initialize();
      }
      this.fomoEnhancer.setup(config);
      this.fomoEnhancer.start();
      this.logger.debug("FOMO popup started");
    } catch (error) {
      this.logger.error("Failed to start FOMO popup:", error);
      throw error;
    }
  }
  /**
   * Stops the social-proof popup rotation. No-op when {@link
   * NextCommerce.fomo} was never called.
   * @category Popups
   */
  stopFomo() {
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
  async addUpsell(options) {
    const orderStore = useOrderStore.getState();
    const configStore$1 = configStore.getState();
    if (!orderStore.order) {
      throw new Error(
        "No order found. Upsells can only be added after order completion."
      );
    }
    if (!orderStore.canAddUpsells()) {
      throw new Error(
        "Order does not support post-purchase upsells or is currently processing."
      );
    }
    const apiClient = new ApiClient(configStore$1.apiKey);
    let lines = [];
    if (options.items && options.items.length > 0) {
      lines = options.items.map((item) => ({
        package_id: item.packageId,
        quantity: item.quantity || 1
      }));
    } else if (options.packageId) {
      lines = [
        {
          package_id: options.packageId,
          quantity: options.quantity || 1
        }
      ];
    } else {
      throw new Error("Either packageId or items array must be provided");
    }
    const upsellData = { lines };
    this.logger.info("Adding upsell(s) via SDK:", upsellData);
    try {
      const previousLineIds = orderStore.order?.lines?.map((line) => line.id) || [];
      const updatedOrder = await orderStore.addUpsell(upsellData, apiClient);
      if (!updatedOrder) {
        throw new Error("Failed to add upsell - no updated order returned");
      }
      const addedLines = updatedOrder.lines?.filter(
        (line) => line.is_upsell && !previousLineIds.includes(line.id)
      ) || [];
      const totalUpsellValue = addedLines.reduce((sum, line) => {
        return sum + (line.price_incl_tax ? parseFloat(line.price_incl_tax) : 0);
      }, 0);
      lines.forEach((line, index) => {
        const addedLine = addedLines[index];
        const value = addedLine?.price_incl_tax ? parseFloat(addedLine.price_incl_tax) : 0;
        this.eventBus.emit("upsell:added", {
          packageId: line.package_id,
          quantity: line.quantity,
          order: updatedOrder,
          value
        });
      });
      return {
        order: updatedOrder,
        addedLines,
        totalValue: totalUpsellValue
      };
    } catch (error) {
      this.logger.error("Failed to add upsell(s) via SDK:", error);
      throw error;
    }
  }
  /**
   * Whether the order in session can take a post-purchase upsell right now.
   * Also `false` while one is processing, so it guards a double submit.
   * @category Upsells
   */
  canAddUpsells() {
    const orderStore = useOrderStore.getState();
    return orderStore.canAddUpsells();
  }
  /**
   * Package ids already accepted on this order, as strings rather than
   * numbers.
   * @category Upsells
   */
  getCompletedUpsells() {
    const orderStore = useOrderStore.getState();
    return orderStore.completedUpsells;
  }
  /**
   * Whether a package was already accepted on this order — checks the
   * completed list and the accepted entries of the upsell journey, so it
   * survives a reload.
   * @category Upsells
   */
  isUpsellAlreadyAdded(packageId) {
    const orderStore = useOrderStore.getState();
    if (orderStore.completedUpsells.includes(packageId.toString())) {
      return true;
    }
    const acceptedInJourney = orderStore.upsellJourney.some(
      (entry) => entry.packageId === packageId.toString() && entry.action === "accepted"
    );
    return acceptedInJourney;
  }
  // URL Parameter Methods
  /**
   * Sets one captured URL parameter for the rest of the session. Does not
   * touch the address bar.
   * @category URL Parameters
   */
  setParam(key, value) {
    const paramStore = useParameterStore.getState();
    paramStore.updateParam(key, value);
    this.logger.debug(`URL parameter set: ${key}=${value}`);
  }
  /**
   * Sets several captured URL parameters, replacing the keys named and leaving
   * the rest alone.
   * @category URL Parameters
   */
  setParams(params) {
    const paramStore = useParameterStore.getState();
    paramStore.updateParams(params);
    this.logger.debug("URL parameters set:", params);
  }
  /**
   * Reads one captured URL parameter. `null` when it was never captured.
   * @category URL Parameters
   */
  getParam(key) {
    const paramStore = useParameterStore.getState();
    const value = paramStore.getParam(key);
    return value !== void 0 ? value : null;
  }
  /**
   * Every URL parameter captured for this session.
   * @category URL Parameters
   */
  getAllParams() {
    const paramStore = useParameterStore.getState();
    return paramStore.params;
  }
  /**
   * Whether a parameter was captured, including one present with an empty
   * value.
   * @category URL Parameters
   */
  hasParam(key) {
    const paramStore = useParameterStore.getState();
    return paramStore.hasParam(key);
  }
  /**
   * Forgets one captured URL parameter.
   * @category URL Parameters
   */
  clearParam(key) {
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
  clearAllParams() {
    const paramStore = useParameterStore.getState();
    paramStore.updateParams({});
    this.logger.debug("All URL parameters cleared");
  }
  /**
   * Adds parameters to the captured set without disturbing keys it does not
   * name.
   * @category URL Parameters
   */
  mergeParams(params) {
    const paramStore = useParameterStore.getState();
    paramStore.mergeParams(params);
    this.logger.debug("URL parameters merged:", params);
  }
}
const _AttributeParser = class _AttributeParser {
  static parseDataAttribute(element, attribute) {
    const value = element.getAttribute(attribute);
    return {
      raw: value,
      parsed: this.parseValue(value),
      type: this.inferType(value)
    };
  }
  static parseValue(value) {
    if (value === null || value === "") {
      return null;
    }
    if (value.startsWith("{") || value.startsWith("[")) {
      try {
        return JSON.parse(value);
      } catch {
      }
    }
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      const num = parseFloat(value);
      return Number.isNaN(num) ? value : num;
    }
    return value;
  }
  static inferType(value) {
    if (value === null || value === "") {
      return "string";
    }
    if (value === "true" || value === "false") {
      return "boolean";
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return "number";
    }
    if (value.startsWith("{") && value.endsWith("}")) {
      return "object";
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      return "array";
    }
    return "string";
  }
  static getEnhancerTypes(element) {
    const types = [];
    if (element.hasAttribute("data-next-enhancer")) {
      const enhancerType = element.getAttribute("data-next-enhancer");
      if (enhancerType) {
        types.push(enhancerType);
      }
    }
    if (element.hasAttribute("data-next-display")) {
      types.push("display");
    }
    if (element.hasAttribute("data-next-package-toggle")) {
      types.push("package-toggle");
    }
    if (element.hasAttribute("data-next-action")) {
      types.push("action");
    }
    if (element.hasAttribute("data-next-timer")) {
      types.push("timer");
    }
    if (element.hasAttribute("data-next-show") || element.hasAttribute("data-next-hide")) {
      types.push("conditional");
    }
    if (element instanceof HTMLFormElement && element.hasAttribute("data-next-checkout")) {
      types.push("checkout");
    }
    if (element.hasAttribute("data-next-express-checkout")) {
      const checkoutType = element.getAttribute("data-next-express-checkout");
      if (checkoutType === "container") {
        types.push("express-checkout-container");
      } else if (checkoutType === "paypal" || checkoutType === "apple_pay" || checkoutType === "google_pay") {
        types.push("express-checkout");
      }
    }
    if (element.hasAttribute("data-next-cart-items")) {
      types.push("cart-items");
    }
    if (element.hasAttribute("data-next-order-items")) {
      types.push("order-items");
    }
    if (element.hasAttribute("data-next-quantity")) {
      const quantityAction = element.getAttribute("data-next-quantity");
      if (quantityAction && ["increase", "decrease", "set"].includes(quantityAction)) {
        types.push("quantity");
      }
    }
    if (element.hasAttribute("data-next-remove-item")) {
      types.push("remove-item");
    }
    if (element.hasAttribute("data-next-package-selector")) {
      types.push("package-selector");
    }
    if (element.hasAttribute("data-next-upsell")) {
      types.push("upsell");
    }
    if (element.hasAttribute("data-next-coupon")) {
      const couponType = element.getAttribute("data-next-coupon");
      if (couponType === "input" || couponType === "") {
        types.push("coupon");
      }
    }
    if (element.hasAttribute("data-next-accordion")) {
      types.push("accordion");
    }
    if (element.hasAttribute("data-next-tooltip")) {
      types.push("tooltip");
    }
    if (element.hasAttribute("data-next-component") && element.getAttribute("data-next-component") === "scroll-hint") {
      types.push("scroll-hint");
    }
    if (element.hasAttribute("data-next-quantity-text")) {
      types.push("quantity-text");
    }
    if (element.hasAttribute("data-next-cart-summary")) {
      types.push("cart-summary");
    }
    if (element.hasAttribute("data-next-bundle-selector")) {
      types.push("bundle-selector");
    }
    return [...new Set(types)];
  }
  static parseDisplayPath(path) {
    const parts = path.split(".");
    if (parts.length === 1) {
      return { object: "cart", property: parts[0] ?? "" };
    }
    return {
      object: parts[0] ?? "cart",
      property: parts.slice(1).join(".")
    };
  }
  static parseCondition(condition) {
    try {
      this.logger.debug("Parsing condition:", condition);
      condition = condition.trim();
      const logicalSplit = this.splitByLogicalOperator(condition);
      if (logicalSplit) {
        const { operator, parts } = logicalSplit;
        return {
          type: "logical",
          operator,
          conditions: parts.map((part) => this.parseCondition(part))
        };
      }
      if (condition.startsWith("!")) {
        const innerCondition = condition.slice(1).trim();
        return {
          type: "not",
          condition: this.parseCondition(innerCondition)
        };
      }
      if (condition.startsWith("(") && condition.endsWith(")")) {
        const innerCondition = condition.slice(1, -1);
        if (!innerCondition.includes("(") || this.hasMatchingParentheses(innerCondition)) {
          return this.parseCondition(innerCondition);
        }
      }
      if (condition.includes("(") && condition.includes(")")) {
        const match = condition.match(/^(\w+)\.(\w+)\(([^)]*)\)$/);
        if (match) {
          return {
            type: "function",
            object: match[1] ?? "",
            method: match[2] ?? "",
            args: match[3] ? match[3].split(",").map((arg) => this.parseValue(arg.trim())) : []
          };
        }
      }
      if (condition.includes(" ") || condition.includes("==") || condition.includes("!=")) {
        const operators = [">=", "<=", ">", "<", "===", "==", "!==", "!="];
        for (const op of operators) {
          if (condition.includes(op)) {
            const parts = condition.split(op);
            if (parts.length === 2) {
              const left = parts[0].trim();
              const right = parts[1].trim();
              const leftPath = this.parseDisplayPath(left ?? "");
              let rightValue;
              const rightTrimmed = right.trim();
              const hasQuotes = rightTrimmed.startsWith('"') && rightTrimmed.endsWith('"') || rightTrimmed.startsWith("'") && rightTrimmed.endsWith("'");
              if (hasQuotes) {
                rightValue = rightTrimmed.slice(1, -1);
              } else {
                rightValue = this.parseValue(right ?? "");
                if ((leftPath.object === "param" || leftPath.object === "params") && typeof rightValue === "string" && right !== "true" && right !== "false" && !/^-?\d+(\.\d+)?$/.test(right)) {
                  rightValue = right;
                }
              }
              const result = {
                type: "comparison",
                left: leftPath,
                operator: op,
                right: rightValue
              };
              this.logger.debug("Parsed comparison:", {
                original: condition,
                leftPart: left,
                rightPart: right,
                hasQuotes,
                result,
                leftObject: leftPath.object,
                rightValue,
                rightType: typeof rightValue
              });
              return result;
            }
          }
        }
      }
      return {
        type: "property",
        ...this.parseDisplayPath(condition)
      };
    } catch (error) {
      this.logger.error("Failed to parse condition:", condition, error);
      return { type: "property", object: "cart", property: "isEmpty" };
    }
  }
  /**
   * Split a condition by logical operators (|| or &&) while respecting parentheses
   * Returns null if no logical operators are found at the top level
   */
  static splitByLogicalOperator(condition) {
    const orParts = this.splitByOperator(condition, "||");
    if (orParts.length > 1) {
      return { operator: "||", parts: orParts };
    }
    const andParts = this.splitByOperator(condition, "&&");
    if (andParts.length > 1) {
      return { operator: "&&", parts: andParts };
    }
    return null;
  }
  /**
   * Split a string by an operator while respecting parentheses and function calls
   */
  static splitByOperator(text, operator) {
    const parts = [];
    let currentPart = "";
    let depth = 0;
    let i = 0;
    while (i < text.length) {
      const char = text[i];
      if (char === "(") {
        depth++;
        currentPart += char;
        i++;
        continue;
      } else if (char === ")") {
        depth--;
        currentPart += char;
        i++;
        continue;
      }
      if (depth === 0 && text.slice(i, i + operator.length) === operator) {
        parts.push(currentPart.trim());
        currentPart = "";
        i += operator.length;
        continue;
      }
      currentPart += char;
      i++;
    }
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    return parts;
  }
  /**
   * Check if a string has matching parentheses
   */
  static hasMatchingParentheses(text) {
    let depth = 0;
    for (const char of text) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (depth < 0) return false;
    }
    return depth === 0;
  }
};
_AttributeParser.logger = createLogger("AttributeParser");
let AttributeParser = _AttributeParser;
class DOMObserver {
  constructor(config = {}) {
    this.handlers = /* @__PURE__ */ new Set();
    this.isObserving = false;
    this.pendingChanges = /* @__PURE__ */ new Set();
    this.logger = createLogger("DOMObserver");
    this.config = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-next-display",
        "data-next-toggle",
        "data-next-timer",
        "data-next-show",
        "data-next-hide",
        "data-next-checkout",
        "data-next-validate",
        "data-next-express-checkout"
      ],
      ...config
    };
    this.observer = new MutationObserver(this.handleMutations.bind(this));
  }
  /**
   * Add a change handler
   */
  addHandler(handler) {
    this.handlers.add(handler);
    this.logger.debug(`Added handler, total: ${this.handlers.size}`);
  }
  /**
   * Remove a change handler
   */
  removeHandler(handler) {
    this.handlers.delete(handler);
    this.logger.debug(`Removed handler, total: ${this.handlers.size}`);
  }
  /**
   * Start observing DOM changes
   */
  start(target = document.body) {
    if (this.isObserving) {
      this.logger.warn("Already observing, ignoring start request");
      return;
    }
    try {
      this.observer.observe(target, this.config);
      this.isObserving = true;
      this.logger.debug("Started observing DOM changes", { target: target.tagName });
    } catch (error) {
      this.logger.error("Failed to start DOM observation:", error);
    }
  }
  /**
   * Stop observing DOM changes
   */
  stop() {
    if (!this.isObserving) {
      return;
    }
    this.observer.disconnect();
    this.isObserving = false;
    this.clearThrottle();
    this.pendingChanges.clear();
    this.logger.debug("Stopped observing DOM changes");
  }
  /**
   * Temporarily pause observation
   */
  pause() {
    if (this.isObserving) {
      this.observer.disconnect();
      this.isObserving = false;
      this.logger.debug("Paused DOM observation");
    }
  }
  /**
   * Resume observation after pause
   */
  resume(target = document.body) {
    if (!this.isObserving) {
      this.start(target);
      this.logger.debug("Resumed DOM observation");
    }
  }
  /**
   * Check if currently observing
   */
  isActive() {
    return this.isObserving;
  }
  /**
   * Handle mutation records from MutationObserver
   */
  handleMutations(mutations) {
    const relevantMutations = mutations.filter((mutation) => this.isRelevantMutation(mutation));
    if (relevantMutations.length === 0) {
      return;
    }
    this.logger.debug(`Processing ${relevantMutations.length} relevant mutations`);
    for (const mutation of relevantMutations) {
      this.processMutation(mutation);
    }
    this.throttleNotifications();
  }
  /**
   * Check if a mutation is relevant to our data attributes
   */
  isRelevantMutation(mutation) {
    switch (mutation.type) {
      case "childList":
        return this.hasRelevantNodes(mutation.addedNodes) || this.hasRelevantNodes(mutation.removedNodes);
      case "attributes":
        const attrName = mutation.attributeName;
        return attrName !== null && this.config.attributeFilter?.includes(attrName) === true;
      default:
        return false;
    }
  }
  /**
   * Check if a NodeList contains relevant elements
   */
  hasRelevantNodes(nodeList) {
    for (const node of nodeList) {
      if (node instanceof HTMLElement) {
        if (this.hasRelevantAttributes(node) || this.hasRelevantDescendants(node)) {
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Check if an element has relevant data attributes
   */
  hasRelevantAttributes(element) {
    return this.config.attributeFilter?.some((attr) => element.hasAttribute(attr)) === true;
  }
  /**
   * Check if an element has descendants with relevant attributes
   */
  hasRelevantDescendants(element) {
    if (!this.config.attributeFilter) return false;
    const selector = this.config.attributeFilter.map((attr) => `[${attr}]`).join(",");
    return element.querySelector(selector) !== null;
  }
  /**
   * Process a single mutation record
   */
  processMutation(mutation) {
    switch (mutation.type) {
      case "childList":
        this.processChildListMutation(mutation);
        break;
      case "attributes":
        this.processAttributeMutation(mutation);
        break;
    }
  }
  /**
   * Process child list mutations (added/removed nodes)
   */
  processChildListMutation(mutation) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) {
        this.addElementForProcessing(node, "added");
        if (this.config.attributeFilter) {
          const selector = this.config.attributeFilter.map((attr) => `[${attr}]`).join(",");
          const descendants = node.querySelectorAll(selector);
          descendants.forEach((desc) => {
            if (desc instanceof HTMLElement) {
              this.addElementForProcessing(desc, "added");
            }
          });
        }
      }
    }
    for (const node of mutation.removedNodes) {
      if (node instanceof HTMLElement) {
        this.addElementForProcessing(node, "removed");
      }
    }
  }
  /**
   * Process attribute mutations
   */
  processAttributeMutation(mutation) {
    if (mutation.target instanceof HTMLElement && mutation.attributeName) {
      const element = mutation.target;
      const attributeName = mutation.attributeName;
      const oldValue = mutation.oldValue;
      const newValue = element.getAttribute(attributeName);
      this.notifyHandlers({
        type: "attributeChanged",
        element,
        attributeName,
        oldValue: oldValue || void 0,
        newValue: newValue || void 0
      });
    }
  }
  /**
   * Add an element to the pending changes queue
   */
  addElementForProcessing(element, type) {
    if (this.hasRelevantAttributes(element)) {
      this.pendingChanges.add(element);
      if (type === "removed") {
        this.notifyHandlers({
          type: "removed",
          element,
          attributeName: void 0,
          oldValue: void 0,
          newValue: void 0
        });
      }
    }
  }
  /**
   * Throttle notifications to avoid excessive processing
   */
  throttleNotifications() {
    if (this.throttleTimeout) {
      return;
    }
    this.throttleTimeout = window.setTimeout(() => {
      this.processePendingChanges();
      this.throttleTimeout = void 0;
    }, 16);
  }
  /**
   * Process all pending changes
   */
  processePendingChanges() {
    if (this.pendingChanges.size === 0) {
      return;
    }
    this.logger.debug(`Processing ${this.pendingChanges.size} pending changes`);
    for (const element of this.pendingChanges) {
      this.notifyHandlers({
        type: "added",
        element,
        attributeName: void 0,
        oldValue: void 0,
        newValue: void 0
      });
    }
    this.pendingChanges.clear();
  }
  /**
   * Notify all handlers of a change
   */
  notifyHandlers(event) {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error("Handler error:", error);
      }
    }
  }
  /**
   * Clear throttle timeout
   */
  clearThrottle() {
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
      this.throttleTimeout = void 0;
    }
  }
  /**
   * Cleanup and destroy observer
   */
  destroy() {
    this.stop();
    this.handlers.clear();
    this.logger.debug("DOM observer destroyed");
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Update configuration (requires restart)
   */
  updateConfig(newConfig) {
    const wasObserving = this.isObserving;
    let target;
    if (wasObserving) {
      target = document.body;
      this.stop();
    }
    this.config = { ...this.config, ...newConfig };
    if (wasObserving && target) {
      this.start(target);
    }
    this.logger.debug("Updated configuration", this.config);
  }
}
class AttributeScanner {
  constructor() {
    this.enhancers = /* @__PURE__ */ new WeakMap();
    this.enhancerCount = 0;
    this.isScanning = false;
    this.scanQueue = /* @__PURE__ */ new Set();
    this.enhancerStats = /* @__PURE__ */ new Map();
    this.isDebugMode = false;
    this.processQueueDebounced = this.debounce(() => {
      this.processQueue();
    }, 50);
    this.logger = createLogger("AttributeScanner");
    this.domObserver = new DOMObserver();
    this.domObserver.addHandler(this.handleDOMChange.bind(this));
    this.isDebugMode = new URLSearchParams(location.search).get("debug") === "true";
    if (this.isDebugMode) {
      console.log("🐛 AttributeScanner: Debug mode enabled for performance tracking");
    }
  }
  async scanAndEnhance(root) {
    if (this.isScanning) {
      this.logger.warn("Already scanning, queuing request");
      return;
    }
    this.isScanning = true;
    this.logger.info("🔍 Starting DOM scan for data attributes...", { root: root.tagName });
    try {
      const selector = [
        "[data-next-enhancer]",
        // Generic enhancer (checkout-review, etc.)
        "[data-next-display]",
        "[data-next-package-toggle]",
        "[data-next-action]",
        "[data-next-timer]",
        "[data-next-show]",
        "[data-next-hide]",
        "form[data-next-checkout]",
        "[data-next-express-checkout]",
        "[data-next-timer-display]",
        "[data-next-timer-expired]",
        "[data-next-cart-items]",
        "[data-next-cart-summary]",
        "[data-next-bundle-selector]",
        "[data-next-package-selector]",
        "[data-next-order-items]",
        '[data-next-quantity="increase"]',
        '[data-next-quantity="decrease"]',
        '[data-next-quantity="set"]',
        "[data-next-remove-item]",
        "[data-next-upsell]",
        "[data-next-upsell-selector]",
        "[data-next-upsell-select]",
        '[data-next-coupon="input"]',
        '[data-next-coupon=""]',
        "[data-next-accordion]",
        "[data-next-tooltip]",
        '[data-next-express-checkout="container"]',
        '[data-next-component="scroll-hint"]',
        "[data-next-quantity-text]"
      ].join(", ");
      const elements = root.querySelectorAll(selector);
      this.logger.debug(`Found ${elements.length} elements with data attributes`);
      const conditionalElements = root.querySelectorAll("[data-next-show], [data-next-hide]");
      if (conditionalElements.length > 0) {
        this.logger.info(
          `Found ${conditionalElements.length} conditional display elements:`,
          Array.from(conditionalElements).map((el) => ({
            tag: el.tagName,
            class: el.className,
            show: el.getAttribute("data-next-show"),
            hide: el.getAttribute("data-next-hide")
          }))
        );
      }
      let enhancedCount = 0;
      const enhancePromises = [];
      const batchSize = 10;
      for (let i = 0; i < elements.length; i += batchSize) {
        const batch = Array.from(elements).slice(i, i + batchSize);
        for (const element of batch) {
          if (element instanceof HTMLElement) {
            enhancePromises.push(
              this.enhanceElement(element).then(() => {
                enhancedCount++;
              })
            );
          }
        }
        await Promise.all(enhancePromises.splice(0, batchSize));
        if (i + batchSize < elements.length) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      await Promise.all(enhancePromises);
      this.logger.debug(`Enhanced ${enhancedCount} elements successfully`);
      if (this.isDebugMode && this.enhancerStats.size > 0) {
        this.showPerformanceReport();
      }
      document.documentElement.classList.add("next-display-ready");
      this.logger.debug("Added next-display-ready class to HTML element");
      window.dispatchEvent(new CustomEvent("next:display-ready", {
        detail: {
          enhancedCount,
          root: root.tagName
        }
      }));
      this.startObserving(root);
    } catch (error) {
      this.logger.error("Error during scan and enhance:", error);
    } finally {
      this.isScanning = false;
    }
  }
  async enhanceElement(element) {
    if (this.enhancers.has(element)) {
      this.logger.debug("Element already enhanced, skipping", element);
      return;
    }
    const cartItemsContainer = element.closest("[data-next-cart-items]");
    if (cartItemsContainer && cartItemsContainer !== element) {
      this.logger.debug("Skipping element inside cart items template", element);
      return;
    }
    const packageId = element.getAttribute("data-package-id");
    if (packageId && packageId.includes("{") && packageId.includes("}")) {
      this.logger.debug("Skipping element with template variable", element, packageId);
      return;
    }
    try {
      const enhancerTypes = AttributeParser.getEnhancerTypes(element);
      if (enhancerTypes.length === 0) {
        this.logger.debug("No enhancer types found for element", element);
        return;
      }
      const elementEnhancers = [];
      for (const type of enhancerTypes) {
        const enhancer = await this.createEnhancer(type, element);
        if (enhancer) {
          elementEnhancers.push(enhancer);
          try {
            if (this.isDebugMode) {
              const enhancerStart = performance.now();
              await enhancer.initialize();
              const enhancerTime = performance.now() - enhancerStart;
              this.updateEnhancerStats(type, enhancerTime);
              this.logger.debug(`Initialized ${type} enhancer for element`, element);
            } else {
              await enhancer.initialize();
              this.logger.debug(`Initialized ${type} enhancer for element`, element);
            }
          } catch (initError) {
            this.logger.error(`Failed to initialize ${type} enhancer:`, initError, element);
            enhancer.destroy();
          }
        }
      }
      if (elementEnhancers.length > 0) {
        this.enhancers.set(element, elementEnhancers);
        this.enhancerCount += elementEnhancers.length;
        this.logger.debug(`Enhanced element with ${elementEnhancers.length} enhancer(s)`, {
          element: element.tagName,
          types: enhancerTypes,
          attributes: Array.from(element.attributes).map((attr) => attr.name)
        });
      }
    } catch (error) {
      this.logger.error("Failed to enhance element:", error, element);
    }
  }
  async createEnhancer(type, element) {
    try {
      switch (type) {
        case "display":
          const displayPath = element.getAttribute("data-next-display") || "";
          const parsed = AttributeParser.parseDisplayPath(displayPath);
          this.logger.debug(`Creating display enhancer for path: "${displayPath}"`, {
            parsed,
            element: element.tagName,
            elementHtml: element.outerHTML.substring(0, 200) + "..."
          });
          if (parsed.object === "cart" || parsed.object === "cart-summary") {
            this.logger.debug("Using CartDisplayEnhancer");
            const { CartDisplayEnhancer } = await import("./index-dsLHpTg9.js");
            return new CartDisplayEnhancer(element);
          } else if (parsed.object === "selection") {
            this.logger.debug("Using SelectionDisplayEnhancer");
            const { SelectionDisplayEnhancer } = await import("./selection-display.enhancer-BDdF3TQR.js");
            return new SelectionDisplayEnhancer(element);
          } else if (parsed.object === "package" || parsed.object === "campaign") {
            this.logger.debug("Using ProductDisplayEnhancer");
            const { ProductDisplayEnhancer } = await import("./product-display.enhancer-C7TC5oro.js");
            return new ProductDisplayEnhancer(element);
          } else if (parsed.object === "order") {
            this.logger.debug("Using OrderDisplayEnhancer");
            const { OrderDisplayEnhancer } = await import("./order-display.enhancer-Di5wazPz.js");
            return new OrderDisplayEnhancer(element);
          } else if (parsed.object === "shipping") {
            this.logger.debug("Using ShippingDisplayEnhancer");
            const { ShippingDisplayEnhancer } = await import("./shipping-display.enhancer-CFqiQvPA.js");
            return new ShippingDisplayEnhancer(element);
          } else if (parsed.object === "bundle") {
            this.logger.debug("Using BundleDisplayEnhancer");
            const { BundleDisplayEnhancer } = await import("./index-CZLNTUKj.js");
            return new BundleDisplayEnhancer(element);
          } else if (parsed.object === "selector") {
            this.logger.debug("Using PackageSelectorDisplayEnhancer");
            const { PackageSelectorDisplayEnhancer } = await import("./index-DUSMpJ15.js");
            return new PackageSelectorDisplayEnhancer(element);
          } else if (parsed.object === "toggle") {
            this.logger.debug("Using PackageToggleDisplayEnhancer");
            const { PackageToggleDisplayEnhancer } = await import("./index-C5oFVjzG.js");
            return new PackageToggleDisplayEnhancer(element);
          } else {
            let currentElement = element.parentElement;
            let hasPackageContext = false;
            while (currentElement && !hasPackageContext) {
              if (currentElement.hasAttribute("data-next-package-id") || currentElement.hasAttribute("data-next-package") || currentElement.hasAttribute("data-package-id")) {
                hasPackageContext = true;
              }
              currentElement = currentElement.parentElement;
            }
            if (hasPackageContext) {
              this.logger.debug(`Using ProductDisplayEnhancer (fallback with package context)`);
              const { ProductDisplayEnhancer } = await import("./product-display.enhancer-C7TC5oro.js");
              return new ProductDisplayEnhancer(element);
            } else {
              this.logger.debug(`Using CartDisplayEnhancer (fallback without package context)`);
              const { CartDisplayEnhancer } = await import("./index-dsLHpTg9.js");
              return new CartDisplayEnhancer(element);
            }
          }
        case "package-toggle":
          const { PackageToggleEnhancer } = await import("./index-C5oFVjzG.js");
          return new PackageToggleEnhancer(element);
        case "action":
          const action = element.getAttribute("data-next-action");
          switch (action) {
            case "add-to-cart":
              const { AddToCartEnhancer } = await import("./index-Cnscqr-F.js");
              return new AddToCartEnhancer(element);
            case "accept-upsell":
              const { AcceptUpsellEnhancer } = await import("./index-BEGUgayw.js");
              return new AcceptUpsellEnhancer(element);
            default:
              this.logger.warn(`Unknown action type: ${action}`);
              return null;
          }
        case "package-selector":
          const { PackageSelectorEnhancer } = await import("./index-DUSMpJ15.js");
          return new PackageSelectorEnhancer(element);
        case "timer":
          const { TimerEnhancer } = await import("./timer.enhancer-C2efCEzn.js");
          return new TimerEnhancer(element);
        case "conditional":
          this.logger.debug("Creating ConditionalDisplayEnhancer for element:", {
            element: element.tagName,
            class: element.className,
            showAttr: element.getAttribute("data-next-show"),
            hideAttr: element.getAttribute("data-next-hide")
          });
          const { ConditionalDisplayEnhancer } = await import("./conditional-display.enhancer-C5M0P_tN.js");
          return new ConditionalDisplayEnhancer(element);
        case "checkout":
          const { CheckoutFormEnhancer } = await import("./checkout-form.enhancer-D-gAGo2D.js");
          return new CheckoutFormEnhancer(element);
        case "checkout-review":
          this.logger.info("Creating CheckoutReviewEnhancer for element:", {
            element: element.tagName,
            class: element.className
          });
          const { CheckoutReviewEnhancer } = await import("./checkout-review.enhancer-14OCQPXZ.js");
          return new CheckoutReviewEnhancer(element);
        case "express-checkout":
          this.logger.debug("Skipping individual express checkout button - managed by container");
          return null;
        case "express-checkout-container":
          const { ExpressCheckoutContainerEnhancer } = await import("./express-checkout-container.enhancer-Dtc7rcWl.js");
          return new ExpressCheckoutContainerEnhancer(element);
        // REMOVED: form-validator, payment, address, phone, validation enhancers
        // These are now handled by the main CheckoutFormEnhancer (simplified approach)
        case "cart-items":
          const { CartItemListEnhancer } = await import("./index-DXdpIinF.js");
          return new CartItemListEnhancer(element);
        case "cart-summary":
          const { CartSummaryEnhancer } = await import("./index-dsLHpTg9.js");
          return new CartSummaryEnhancer(element);
        case "bundle-selector":
          const { BundleSelectorEnhancer } = await import("./index-CZLNTUKj.js");
          return new BundleSelectorEnhancer(element);
        case "order-items":
          const { OrderItemListEnhancer } = await import("./order-item-list.enhancer-ZJ_ddkFT.js");
          return new OrderItemListEnhancer(element);
        case "quantity":
          const { QuantityControlEnhancer } = await import("./index-tSKtKXBV.js");
          return new QuantityControlEnhancer(element);
        case "remove-item":
          const { RemoveItemEnhancer } = await import("./index-C_wQV0gM.js");
          return new RemoveItemEnhancer(element);
        // 'order' case removed - order display now handled via data-next-display="order.xxx" pattern
        case "upsell":
          const { UpsellEnhancer } = await import("./index-6CII0tm6.js");
          return new UpsellEnhancer(element);
        case "coupon":
          const { CouponEnhancer } = await import("./coupon.enhancer-Cs8sh_7W.js");
          return new CouponEnhancer(element);
        case "accordion":
          const { AccordionEnhancer } = await import("./accordion.enhancer-BR4IkuXE.js");
          return new AccordionEnhancer(element);
        case "tooltip":
          const { TooltipEnhancer } = await import("./tooltip.enhancer-CV5CV6c6.js");
          return new TooltipEnhancer(element);
        case "scroll-hint":
          const { ScrollHintEnhancer } = await import("./scroll-hint.enhancer-TTHz87Im.js");
          return new ScrollHintEnhancer(element);
        case "quantity-text":
          const { QuantityTextEnhancer } = await import("./quantity-text.enhancer-C5VK51Yf.js");
          return new QuantityTextEnhancer(element);
        default:
          this.logger.warn(`Unknown enhancer type: ${type}`);
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to create enhancer of type ${type}:`, error);
      return null;
    }
  }
  startObserving(root) {
    if (!this.domObserver.isActive()) {
      this.domObserver.start(root);
      this.logger.debug("Started DOM observation");
    }
  }
  handleDOMChange(event) {
    switch (event.type) {
      case "added":
        this.queueElementForEnhancement(event.element);
        break;
      case "removed":
        this.cleanupElement(event.element);
        break;
      case "attributeChanged":
        if (event.attributeName?.startsWith("data-next-")) {
          this.logger.debug("Data attribute changed, re-enhancing element", {
            element: event.element.tagName,
            attribute: event.attributeName,
            oldValue: event.oldValue,
            newValue: event.newValue
          });
          this.cleanupElement(event.element);
          this.queueElementForEnhancement(event.element);
        }
        break;
    }
  }
  queueElementForEnhancement(element) {
    this.scanQueue.add(element);
    this.processQueueDebounced();
  }
  async processQueue() {
    if (this.scanQueue.size === 0) {
      return;
    }
    const elements = Array.from(this.scanQueue);
    this.scanQueue.clear();
    this.logger.debug(`Processing ${elements.length} queued elements`);
    for (const element of elements) {
      try {
        await this.enhanceElement(element);
      } catch (error) {
        this.logger.error("Failed to enhance queued element:", error, element);
      }
    }
  }
  debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func.apply(this, args), wait);
    };
  }
  cleanupElement(element) {
    const enhancers = this.enhancers.get(element);
    if (enhancers) {
      enhancers.forEach((enhancer) => enhancer.destroy());
      this.enhancerCount -= enhancers.length;
      this.enhancers.delete(element);
    }
  }
  destroy() {
    this.domObserver.destroy();
    this.scanQueue.clear();
    this.enhancerCount = 0;
    this.logger.debug("AttributeScanner destroyed");
  }
  pause() {
    this.domObserver.pause();
    this.logger.debug("AttributeScanner paused");
  }
  resume(root = document.body) {
    this.domObserver.resume(root);
    this.logger.debug("AttributeScanner resumed");
  }
  updateEnhancerStats(type, time) {
    const current = this.enhancerStats.get(type) || { totalTime: 0, count: 0 };
    current.totalTime += time;
    current.count += 1;
    this.enhancerStats.set(type, current);
  }
  showPerformanceReport() {
    console.group("🚀 Enhancement Performance Report");
    const sortedStats = Array.from(this.enhancerStats.entries()).map(([type, stats]) => ({
      Enhancer: type,
      "Total Time (ms)": stats.totalTime.toFixed(2),
      "Average Time (ms)": (stats.totalTime / stats.count).toFixed(2),
      "Count": stats.count,
      "Impact": stats.totalTime > 50 ? "🔴 High" : stats.totalTime > 20 ? "🟡 Medium" : "🟢 Low"
    })).sort((a, b) => parseFloat(b["Total Time (ms)"]) - parseFloat(a["Total Time (ms)"]));
    console.table(sortedStats);
    const topSlow = sortedStats.slice(0, 3);
    if (topSlow.length > 0) {
      console.log("🐌 Slowest enhancers:");
      topSlow.forEach((stat, index) => {
        console.log(`${index + 1}. ${stat.Enhancer}: ${stat["Total Time (ms)"]}ms (${stat.Count} instances)`);
      });
    }
    const totalTime = Array.from(this.enhancerStats.values()).reduce((sum, stats) => sum + stats.totalTime, 0);
    const totalCount = Array.from(this.enhancerStats.values()).reduce((sum, stats) => sum + stats.count, 0);
    console.log(`📊 Total enhancement time: ${totalTime.toFixed(2)}ms across ${totalCount} enhancers`);
    console.groupEnd();
  }
  getStats() {
    const stats = {
      enhancedElements: this.enhancerCount,
      queuedElements: this.scanQueue.size,
      isObserving: this.domObserver.isActive(),
      isScanning: this.isScanning
    };
    if (this.isDebugMode && this.enhancerStats.size > 0) {
      stats.performanceStats = {};
      for (const [type, data] of this.enhancerStats.entries()) {
        stats.performanceStats[type] = {
          totalTime: data.totalTime,
          averageTime: data.totalTime / data.count,
          count: data.count
        };
      }
    }
    return stats;
  }
}
class TestModeManager {
  constructor() {
    this.isTestMode = false;
    this.konamiSequence = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "KeyB",
      "KeyA"
    ];
    this.keySequence = [];
    this.testCards = [
      {
        number: "4111111111111111",
        name: "Visa Test Card",
        cvv: "123",
        expiry: "12/25",
        type: "visa"
      },
      {
        number: "5555555555554444",
        name: "Mastercard Test Card",
        cvv: "123",
        expiry: "12/25",
        type: "mastercard"
      },
      {
        number: "378282246310005",
        name: "American Express Test Card",
        cvv: "1234",
        expiry: "12/25",
        type: "amex"
      },
      {
        number: "6011111111111117",
        name: "Discover Test Card",
        cvv: "123",
        expiry: "12/25",
        type: "discover"
      }
    ];
    this.initializeKonamiCode();
    this.checkUrlTestMode();
  }
  static getInstance() {
    if (!TestModeManager.instance) {
      TestModeManager.instance = new TestModeManager();
    }
    return TestModeManager.instance;
  }
  initializeKonamiCode() {
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
  }
  handleKeyDown(event) {
    this.keySequence.push(event.code);
    if (this.keySequence.length > this.konamiSequence.length) {
      this.keySequence.shift();
    }
    if (this.keySequence.length === this.konamiSequence.length) {
      const isMatch = this.keySequence.every(
        (key, index) => key === this.konamiSequence[index]
      );
      if (isMatch) {
        this.activateKonamiCode();
        this.keySequence = [];
      }
    }
  }
  checkUrlTestMode() {
    const params = new URLSearchParams(window.location.search);
    const windowConfig = window.nextConfig;
    const debugMode = params.get("debugger") === "true" || windowConfig?.debugger === true;
    const testMode = params.get("test") === "true";
    if (debugMode || testMode) {
      this.isTestMode = true;
    }
  }
  activateKonamiCode() {
    console.log("🎮 Konami Code activated!");
    this.isTestMode = true;
    this.showKonamiMessage();
    const url = new URL(window.location.href);
    url.searchParams.set("test", "true");
    window.history.replaceState({}, "", url.toString());
    if (this.konamiCallback) {
      setTimeout(() => {
        this.konamiCallback?.();
      }, 2e3);
    }
    document.dispatchEvent(
      new CustomEvent("next:test-mode-activated", {
        detail: { method: "konami" }
      })
    );
  }
  showKonamiMessage() {
    const message = document.createElement("div");
    message.className = "konami-activation-message";
    message.innerHTML = `
      <div class="konami-content">
        <h3>🎮 Konami Code Activated!</h3>
        <p>Test mode enabled. You can now use test payment methods.</p>
        <div class="konami-progress">
          <div class="konami-progress-bar"></div>
        </div>
      </div>
    `;
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      text-align: center;
      min-width: 300px;
    `;
    const progressBar = message.querySelector(
      ".konami-progress-bar"
    );
    if (progressBar) {
      progressBar.style.cssText = `
        width: 100%;
        height: 4px;
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 1rem;
      `;
      progressBar.innerHTML = '<div style="width: 0; height: 100%; background: white; transition: width 2s ease-in-out;"></div>';
    }
    document.body.appendChild(message);
    setTimeout(() => {
      const bar = progressBar?.querySelector("div");
      if (bar) {
        bar.style.width = "100%";
      }
    }, 100);
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 2500);
  }
  setTestMode(enabled) {
    this.isTestMode = enabled;
    if (enabled) {
      const url = new URL(window.location.href);
      url.searchParams.set("test", "true");
      window.history.replaceState({}, "", url.toString());
    }
  }
  isActive() {
    return this.isTestMode;
  }
  onKonamiCode(callback) {
    this.konamiCallback = callback;
  }
  getTestCards() {
    return [...this.testCards];
  }
  getTestCard(type) {
    if (type) {
      const card = this.testCards.find((c) => c.type === type);
      if (card) return card;
    }
    const defaultCard = this.testCards[0];
    if (!defaultCard) {
      throw new Error("No test cards available");
    }
    return defaultCard;
  }
  fillTestCardData(cardType = "visa") {
    if (!this.isTestMode) return;
    const testCard = this.getTestCard(cardType);
    const numberField = document.querySelector(
      'input[data-spreedly="number"], input[name*="card_number"], input[name*="cardNumber"]'
    );
    if (numberField) {
      numberField.value = testCard.number;
      numberField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const cvvField = document.querySelector(
      'input[data-spreedly="cvv"], input[name*="cvv"], input[name*="security"]'
    );
    if (cvvField) {
      cvvField.value = testCard.cvv;
      cvvField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const expiryField = document.querySelector(
      'input[name*="expiry"], input[name*="exp"]'
    );
    if (expiryField) {
      expiryField.value = testCard.expiry;
      expiryField.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      const monthField = document.querySelector(
        'select[name*="month"], input[name*="month"]'
      );
      const yearField = document.querySelector(
        'select[name*="year"], input[name*="year"]'
      );
      if (monthField && yearField) {
        const [month, year] = testCard.expiry.split("/");
        if (month && year) {
          monthField.value = month;
          yearField.value = `20${year}`;
          monthField.dispatchEvent(new Event("change", { bubbles: true }));
          yearField.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
    const nameField = document.querySelector(
      'input[name*="cardholder"], input[name*="card_name"]'
    );
    if (nameField) {
      nameField.value = "Test Cardholder";
      nameField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    console.log(`Filled test card data: ${testCard.name}`);
  }
  showTestCardMenu() {
    if (!this.isTestMode) return;
    const menu = document.createElement("div");
    menu.className = "test-card-menu";
    menu.innerHTML = `
      <div class="test-card-content">
        <h4>Test Card Numbers</h4>
        <div class="test-card-options">
          ${this.testCards.map(
      (card) => `
            <button class="test-card-option" data-card-type="${card.type}">
              <div class="card-name">${card.name}</div>
              <div class="card-number">${card.number}</div>
            </button>
          `
    ).join("")}
        </div>
        <button class="test-card-close">Close</button>
      </div>
    `;
    menu.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Arial, sans-serif;
      min-width: 250px;
    `;
    menu.addEventListener("click", (e) => {
      const target = e.target;
      if (target.classList.contains("test-card-option") || target.closest(".test-card-option")) {
        const button = target.closest(".test-card-option");
        const cardType = button.getAttribute("data-card-type");
        if (cardType) {
          this.fillTestCardData(cardType);
          menu.remove();
        }
      } else if (target.classList.contains("test-card-close")) {
        menu.remove();
      }
    });
    document.body.appendChild(menu);
    setTimeout(() => {
      if (menu.parentNode) {
        menu.remove();
      }
    }, 3e4);
  }
}
const testModeManager = TestModeManager.getInstance();
const _SDKInitializer = class _SDKInitializer {
  static async initialize() {
    if (this.initialized) {
      this.logger.warn("SDK already initialized");
      return;
    }
    try {
      this.logger.info("Initializing NextCommerce Campaign Cart SDK v2...");
      this.initStartTime = Date.now();
      await this.waitForDOM();
      document.body.setAttribute("data-next-sdk-loading", "true");
      await this.loadConfiguration();
      await this.initializeLocationAndCurrency();
      await this.initializeAttribution();
      await this.loadCampaignData();
      await this.initializeAnalytics();
      await this.waitForStoreRehydration();
      if (configStore.getState().clearCartOnInit) {
        cartOperations.clear();
        this.logger.debug("Cart cleared on init (next-clear-cart)");
      }
      this.initializeErrorHandler();
      await this.checkAndLoadOrder();
      await this.scanAndEnhanceDOM();
      this.setupReadyCallbacks();
      await this.initializeDebugMode();
      this.initialized = true;
      this.logger.info("SDK initialization complete ✅");
      this.retryAttempts = 0;
      document.body.setAttribute("data-next-sdk-loading", "false");
      this.emitInitializedEvent();
    } catch (error) {
      this.logger.error("SDK initialization failed:", error);
      document.body.setAttribute("data-next-sdk-loading", "false");
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        this.logger.warn(`Retrying initialization (attempt ${this.retryAttempts}/${this.maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 1e3 * this.retryAttempts));
        return this.initialize();
      }
      throw error;
    }
  }
  static async captureUrlParameters(urlParams) {
    try {
      const { useParameterStore: useParameterStore2 } = await import("./state-Cak3W8JX.js").then((n) => n.p);
      const paramStore = useParameterStore2.getState();
      const existingParams = { ...paramStore.params };
      const currentParams = {};
      urlParams.forEach((value, key) => {
        currentParams[key] = value;
      });
      const mergedParams = { ...existingParams, ...currentParams };
      if (Object.keys(mergedParams).length > 0) {
        paramStore.updateParams(mergedParams);
        this.logger.debug(`Captured ${Object.keys(currentParams).length} URL parameters, total stored: ${Object.keys(mergedParams).length}`);
        const visibilityParams = ["seen", "timer", "reviews", "loading", "banner", "exit"];
        const relevantParams = Object.keys(mergedParams).filter((key) => visibilityParams.includes(key));
        if (relevantParams.length > 0) {
          this.logger.info("Visibility control parameters detected:", relevantParams.map((k) => `${k}=${mergedParams[k]}`).join(", "));
        }
      }
    } catch (error) {
      this.logger.warn("Failed to capture URL parameters:", error);
    }
  }
  static async initializeLocationAndCurrency() {
    try {
      const configStore$1 = configStore.getState();
      if (!configStore$1.currencyBehavior || configStore$1.currencyBehavior !== "auto") {
        this.logger.info("Skipping location/currency detection (currencyBehavior is not set to auto)");
        const urlParams2 = new URLSearchParams(window.location.search);
        const urlCurrency = urlParams2.get("currency");
        const savedCurrency = sessionStorage.getItem("next_selected_currency");
        const restored = urlCurrency && urlCurrency.toUpperCase() || savedCurrency || "";
        if (restored) {
          if (urlCurrency) {
            sessionStorage.setItem("next_selected_currency", restored);
          }
          configStore$1.updateConfig({ selectedCurrency: restored });
        }
        return;
      }
      this.logger.info("Initializing location and currency detection...");
      const countryService = CountryService.getInstance();
      const urlParams = new URLSearchParams(window.location.search);
      const countryOverride = urlParams.get("country");
      const savedCountry = sessionStorage.getItem("next_selected_country");
      const forcedCountry = countryOverride || savedCountry;
      let locationData = null;
      if (forcedCountry) {
        this.logger.info(`Using forced country: ${forcedCountry} (source: ${countryOverride ? "URL" : "session"})`);
        try {
          const response = await fetch(`https://cdn-countries.muddy-wind-c7ca.workers.dev/countries/${forcedCountry.toUpperCase()}/states`);
          if (response.ok) {
            const data = await response.json();
            locationData = {
              detectedCountryCode: forcedCountry.toUpperCase(),
              detectedCountryConfig: data.countryConfig || {
                currencyCode: "USD",
                currencySymbol: "$",
                stateLabel: "State / Province",
                stateRequired: true,
                postcodeLabel: "Postcode / ZIP",
                postcodeMinLength: 2,
                postcodeMaxLength: 20
              },
              detectedStates: data.states || [],
              countries: []
            };
            if (countryOverride) {
              sessionStorage.setItem("next_selected_country", countryOverride.toUpperCase());
            }
            this.logger.info("Country config loaded:", {
              country: locationData?.detectedCountryCode,
              currency: locationData?.detectedCountryConfig.currencyCode
            });
          } else {
            this.logger.warn(`Failed to fetch country config for ${forcedCountry}, falling back to detection`);
          }
        } catch (error) {
          this.logger.error("Error fetching country config:", error);
        }
      }
      if (!locationData) {
        if (configStore$1.addressConfig) {
          countryService.setConfig(configStore$1.addressConfig);
        }
        const locationDataPromise = countryService.getLocationData();
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Location detection timeout")), 3e3)
        );
        try {
          locationData = await Promise.race([locationDataPromise, timeoutPromise]);
        } catch (error) {
          this.logger.warn("Location detection failed or timed out, using defaults:", error);
          locationData = {
            detectedCountryCode: "US",
            detectedCountryConfig: {
              stateLabel: "State",
              stateRequired: true,
              postcodeLabel: "ZIP Code",
              postcodeRegex: "^\\d{5}(-\\d{4})?$",
              postcodeMinLength: 5,
              postcodeMaxLength: 10,
              postcodeExample: "12345",
              postcodeFormat: null,
              currencyCode: "USD",
              currencySymbol: "$"
            },
            detectedStates: [],
            countries: []
          };
        }
      } else if (locationData && !locationData.countries?.length) {
        try {
          const countriesData = await countryService.getLocationData();
          locationData.countries = countriesData.countries || [];
        } catch (error) {
          this.logger.warn("Failed to fetch countries list:", error);
        }
      }
      if (locationData) {
        this.logger.info("User location detected:", {
          country: locationData.detectedCountryCode,
          currency: locationData.detectedCountryConfig.currencyCode,
          currencySymbol: locationData.detectedCountryConfig.currencySymbol,
          ip: locationData.detectedIp
        });
        configStore$1.updateConfig({
          detectedCountry: locationData.detectedCountryCode,
          detectedCurrency: locationData.detectedCountryConfig.currencyCode,
          detectedIp: locationData.detectedIp || "",
          // Store user IP address
          locationData
          // Cache the entire response
        });
        const urlParams2 = new URLSearchParams(window.location.search);
        const urlCurrency = urlParams2.get("currency");
        const savedCurrency = sessionStorage.getItem("next_selected_currency");
        const detectedCurrency = locationData.detectedCountryConfig.currencyCode;
        let selectedCurrency;
        if (urlCurrency) {
          selectedCurrency = urlCurrency.toUpperCase();
          this.logger.info("Currency override from URL:", selectedCurrency);
          sessionStorage.setItem("next_selected_currency", selectedCurrency);
        } else if (savedCurrency) {
          selectedCurrency = savedCurrency;
          this.logger.info("Using saved currency preference:", selectedCurrency);
        } else {
          selectedCurrency = detectedCurrency;
          this.logger.info("Using detected currency:", selectedCurrency);
        }
        if (selectedCurrency) {
          sessionStorage.setItem("next_selected_currency", selectedCurrency);
        }
        configStore$1.updateConfig({
          selectedCurrency
        });
        this.logger.debug("Location and currency initialized:", {
          detectedCountry: configStore$1.detectedCountry,
          detectedCurrency: configStore$1.detectedCurrency,
          selectedCurrency: configStore$1.selectedCurrency
        });
      }
    } catch (error) {
      this.logger.warn("Failed to initialize location/currency, using defaults:", error);
      const savedCurrency = sessionStorage.getItem("next_selected_currency");
      const urlParams = new URLSearchParams(window.location.search);
      const urlCurrency = urlParams.get("currency");
      let fallbackCurrency = "USD";
      if (urlCurrency) {
        fallbackCurrency = urlCurrency.toUpperCase();
        sessionStorage.setItem("next_selected_currency", fallbackCurrency);
      } else if (savedCurrency) {
        fallbackCurrency = savedCurrency;
      }
      const configStore$1 = configStore.getState();
      configStore$1.updateConfig({
        detectedCountry: "US",
        detectedCurrency: "USD",
        selectedCurrency: fallbackCurrency
      });
    }
  }
  static async loadConfiguration() {
    const configStore$1 = configStore.getState();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("reset") === "true") {
      await this.clearAllStorage();
      urlParams.delete("reset");
      const newUrl = window.location.pathname + (urlParams.toString() ? "?" + urlParams.toString() : "");
      window.history.replaceState({}, "", newUrl);
    }
    await this.captureUrlParameters(urlParams);
    const windowConfig = window.nextConfig;
    const debugMode = urlParams.get("debugger") === "true" || windowConfig?.debugger === true;
    const forcePackageId = urlParams.get("forcePackageId");
    const forceShippingId = urlParams.get("forceShippingId");
    const forceBundleId = urlParams.get("forceBundleId");
    configStore$1.loadFromWindow();
    configStore$1.loadFromMeta();
    if (debugMode) {
      configStore$1.updateConfig({ debug: true });
    }
    if (forcePackageId) {
      this.logger.info("forcePackageId parameter detected:", forcePackageId);
      window._nextForcePackageId = forcePackageId;
    }
    if (forceShippingId) {
      this.logger.info("forceShippingId parameter detected:", forceShippingId);
      window._nextForceShippingId = forceShippingId;
    }
    if (forceBundleId) {
      this.logger.info("forceBundleId parameter detected:", forceBundleId);
      window._nextForceBundleId = forceBundleId;
    }
    this.logger.debug("Configuration loaded (metatags have priority):", configStore$1);
  }
  static async loadCampaignData() {
    const configStore$1 = configStore.getState();
    const campaignStore = useCampaignStore.getState();
    if (!configStore$1.apiKey) {
      throw new Error("API key not found. Please set next-api-key meta tag or window.nextConfig.apiKey");
    }
    this.campaignLoadStartTime = Date.now();
    await campaignStore.loadCampaign(configStore$1.apiKey);
    this.campaignLoadTime = Date.now() - this.campaignLoadStartTime;
    this.campaignFromCache = campaignStore.isFromCache || false;
    this.logger.debug("Campaign data loaded");
    if (campaignStore.data?.available_shipping_countries) {
      const countryService = CountryService.getInstance();
      countryService.setCampaignShippingCountries(campaignStore.data.available_shipping_countries);
      this.logger.info("Campaign shipping countries set globally:", campaignStore.data.available_shipping_countries.map((c) => c.code));
    }
    await this.processForcePackageId();
    await this.processForceShippingId();
    const eventBus = EventBus.getInstance();
    eventBus.emit("sdk:url-parameters-processed", {});
    this.logger.debug("Emitted sdk:url-parameters-processed event");
  }
  static async processForcePackageId() {
    const forcePackageId = window._nextForcePackageId;
    if (!forcePackageId) {
      return;
    }
    try {
      this.logger.info("Processing forcePackageId parameter:", forcePackageId);
      const campaignStore = useCampaignStore.getState();
      cartOperations.clear();
      this.logger.debug("Cart cleared for forcePackageId");
      const packageSpecs = forcePackageId.split(",").map((spec) => {
        const [idStr, quantityStr] = spec.trim().split(":");
        const packageId = parseInt(idStr || "", 10);
        const quantity = quantityStr ? parseInt(quantityStr, 10) : 1;
        if (isNaN(packageId) || packageId <= 0) {
          throw new Error(`Invalid package ID: ${idStr}`);
        }
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error(`Invalid quantity: ${quantityStr}`);
        }
        return { packageId, quantity };
      });
      this.logger.debug("Parsed package specifications:", packageSpecs);
      for (const spec of packageSpecs) {
        const packageData = campaignStore.getPackage(spec.packageId);
        if (!packageData) {
          this.logger.warn(`Package ${spec.packageId} not found in campaign data, skipping`);
          continue;
        }
        await cartOperations.addItem({
          packageId: spec.packageId,
          quantity: spec.quantity,
          isUpsell: false
        });
        this.logger.debug(`Added package ${spec.packageId} with quantity ${spec.quantity} to cart`);
      }
      this.logger.info(`Successfully processed forcePackageId: added ${packageSpecs.length} package(s) to cart`);
      delete window._nextForcePackageId;
    } catch (error) {
      this.logger.error("Error processing forcePackageId parameter:", error);
    }
  }
  static async processForceShippingId() {
    const forceShippingId = window._nextForceShippingId;
    if (!forceShippingId) {
      return;
    }
    try {
      this.logger.info("Processing forceShippingId parameter:", forceShippingId);
      const campaignStore = useCampaignStore.getState();
      const shippingId = parseInt(forceShippingId, 10);
      if (isNaN(shippingId) || shippingId <= 0) {
        throw new Error(`Invalid shipping ID: ${forceShippingId}`);
      }
      const campaignData = campaignStore.data;
      if (!campaignData?.shipping_methods) {
        this.logger.warn("No shipping methods available in campaign data");
        return;
      }
      const shippingMethod = campaignData.shipping_methods.find(
        (method) => method.ref_id === shippingId
      );
      if (!shippingMethod) {
        this.logger.warn(`Shipping method ${shippingId} not found in campaign data`);
        this.logger.debug(
          "Available shipping methods:",
          campaignData.shipping_methods.map((m) => ({ id: m.ref_id, code: m.code, price: m.price }))
        );
        return;
      }
      await cartOperations.setShippingMethod(shippingId);
      this.logger.info(`Successfully set shipping method: ${shippingMethod.code} (ID: ${shippingId}, Price: $${shippingMethod.price})`);
      delete window._nextForceShippingId;
    } catch (error) {
      this.logger.error("Error processing forceShippingId parameter:", error);
    }
  }
  static async initializeAttribution() {
    try {
      this.logger.info("Initializing attribution...");
      const attributionStore = useAttributionStore.getState();
      const configStore$1 = configStore.getState();
      await attributionStore.initialize();
      const sdkVersion = typeof window !== "undefined" && window.__NEXT_SDK_VERSION__ ? window.__NEXT_SDK_VERSION__ : "unknown";
      const userIp = configStore$1.detectedIp || "";
      attributionStore.updateAttribution({
        metadata: {
          ...attributionStore.metadata,
          sdk_version: sdkVersion,
          user_ip: userIp
        }
      });
      this.logger.debug(`Added SDK version to attribution metadata: ${sdkVersion}`);
      if (userIp) {
        this.logger.debug(`Added user IP to attribution metadata: ${userIp}`);
      }
      this.setupAttributionListeners();
      if (configStore$1.utmTransfer?.enabled) {
        const { UtmTransfer } = await import("./utm-transfer-CIwYn0OW.js");
        const utmTransfer = new UtmTransfer(configStore$1.utmTransfer);
        utmTransfer.init();
        this.logger.debug("UTM transfer initialized");
      }
      this.logger.debug("Attribution initialized");
    } catch (error) {
      this.logger.error("Attribution initialization failed:", error);
    }
  }
  static setupAttributionListeners() {
    const eventBus = EventBus.getInstance();
    const attributionStore = useAttributionStore.getState();
    eventBus.on("campaign:loaded", (campaign) => {
      if (campaign?.name && !attributionStore.funnel) {
        attributionStore.setFunnelName(campaign.name);
        this.logger.debug("Set funnel name from campaign:", campaign.name);
      }
    });
    eventBus.on("cart:updated", () => {
      attributionStore.updateAttribution({
        metadata: {
          ...attributionStore.metadata,
          conversion_timestamp: Date.now()
        }
      });
      this.logger.debug("Updated attribution with conversion timestamp");
    });
    window.addEventListener("popstate", () => {
      attributionStore.updateAttribution({
        metadata: {
          ...attributionStore.metadata,
          landing_page: window.location.href
        }
      });
    });
  }
  static async initializeAnalytics() {
    try {
      this.logger.info("Initializing analytics v2...");
      const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
      await nextAnalytics.initialize();
      this.logger.debug("Analytics v2 initialized successfully");
    } catch (error) {
      this.logger.warn("Analytics v2 initialization failed (non-critical):", error);
    }
  }
  static initializeErrorHandler() {
    try {
      import("./error-handler-BNKwUcFG.js").then(({ errorHandler }) => {
        errorHandler.initialize();
        this.logger.debug("Error handler initialized");
      });
    } catch (error) {
      this.logger.warn("Error handler initialization failed:", error);
    }
  }
  static async checkAndLoadOrder() {
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get("ref_id") || urlParams.get("order_ref_id");
    if (refId) {
      const paramName = urlParams.get("ref_id") ? "ref_id" : "order_ref_id";
      this.logger.info(`Page loaded with ${paramName} parameter, auto-loading order:`, refId);
      try {
        const configStore$1 = configStore.getState();
        const orderStore = useOrderStore.getState();
        const apiClient = new ApiClient(configStore$1.apiKey);
        await orderStore.loadOrder(refId, apiClient);
        this.logger.info("Order loaded successfully:", orderStore.order);
        if (orderStore.order) {
          this.logger.info("Order supports upsells:", orderStore.order.supports_post_purchase_upsells);
        }
      } catch (error) {
        this.logger.error("Failed to auto-load order:", error);
      }
    }
  }
  static async scanAndEnhanceDOM() {
    if (this.attributeScanner) {
      this.attributeScanner.destroy();
    }
    this.attributeScanner = new AttributeScanner();
    await this.attributeScanner.scanAndEnhance(document.body);
    const stats = this.attributeScanner.getStats();
    this.logger.info("DOM scanning and enhancement complete", stats);
  }
  static setupReadyCallbacks() {
    const sdk = NextCommerce.getInstance();
    if (typeof window !== "undefined") {
      if (Array.isArray(window.nextReady)) {
        const readyQueue = window.nextReady;
        readyQueue.forEach((callback) => {
          try {
            callback(sdk);
          } catch (error) {
            this.logger.error("Ready callback error:", error);
          }
        });
      }
      window.next = sdk;
      window.nextReady = {
        push: (callback) => {
          try {
            callback(sdk);
          } catch (error) {
            this.logger.error("Ready callback error:", error);
          }
        }
      };
      this.logger.debug("nextReady callback system and window.next API initialized");
    }
  }
  static async initializeDebugMode() {
    const configStore$1 = configStore.getState();
    if (configStore$1.debug) {
      this.logger.info("Debug mode enabled - initializing debug utilities");
      Logger.setLogLevel(LogLevel.DEBUG);
      this.logger.info("Logger level set to DEBUG");
      const { debugOverlay } = await import("./debug-CFtPX9Fq.js").then((n) => n.D);
      debugOverlay.initialize();
      this.setupGlobalDebugUtils();
      this.logger.info("Debug utilities initialized ✅");
    }
  }
  static setupGlobalDebugUtils() {
    if (typeof window !== "undefined") {
      window.nextDebug = {
        overlay: () => import("./debug-CFtPX9Fq.js").then((n) => n.D).then((m) => m.debugOverlay),
        testMode: testModeManager,
        stores: {
          cart: useCartStore,
          campaign: useCampaignStore,
          config: configStore,
          checkout: useCheckoutStore,
          order: useOrderStore,
          attribution: useAttributionStore
        },
        sdk: NextCommerce.getInstance(),
        reinitialize: () => this.reinitialize(),
        getStats: () => this.getInitializationStats(),
        // Enhanced cart methods
        addToCart: (packageId, quantity = 1) => {
          const campaignStore = useCampaignStore.getState();
          const packageData = campaignStore.getPackage(packageId);
          if (packageData) {
            void cartOperations.addItem({
              packageId,
              quantity,
              price: parseFloat(packageData.price),
              title: packageData.name,
              isUpsell: false
            });
          }
        },
        removeFromCart: (packageId) => {
          void cartOperations.removeItem(packageId);
        },
        updateQuantity: (packageId, quantity) => {
          void cartOperations.updateQuantity(packageId, quantity);
        },
        // Analytics methods (removed - will be combined with analytics below)
        // Campaign methods
        loadCampaign: () => {
          const configStore$1 = configStore.getState();
          return useCampaignStore.getState().loadCampaign(configStore$1.apiKey);
        },
        clearCampaignCache: () => {
          useCampaignStore.getState().clearCache();
        },
        getCacheInfo: () => {
          const info = useCampaignStore.getState().getCacheInfo();
          console.table(info);
          return info;
        },
        inspectPackage: (packageId) => {
          const campaignStore = useCampaignStore.getState();
          const packageData = campaignStore.getPackage(packageId);
          console.group(`📦 Package ${packageId} Details`);
          console.table(packageData);
          console.groupEnd();
        },
        testShippingMethod: async (methodId) => {
          console.log(`🚚 Testing shipping method ${methodId}`);
          try {
            const cartStore = useCartStore.getState();
            await cartOperations.setShippingMethod(methodId);
            console.log(`✅ Shipping method ${methodId} set successfully`);
            const state = cartStore;
            const shippingMethod = state.shippingMethod;
            if (shippingMethod) {
              console.log(`📦 Shipping: ${shippingMethod.code} - $${shippingMethod.price}`);
            }
            document.dispatchEvent(new CustomEvent("debug:update-content"));
          } catch (error) {
            console.error(`❌ Failed to set shipping method ${methodId}:`, error);
          }
        },
        sortPackages: (sortBy) => {
          console.log(`🔄 Sorting packages by ${sortBy}`);
          document.dispatchEvent(new CustomEvent("debug:update-content"));
        },
        // Analytics utilities - lazy loaded to avoid blocking
        analytics: {
          getStatus: async () => {
            const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
            return nextAnalytics.getStatus();
          },
          getProviders: async () => {
            const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
            return nextAnalytics.getStatus().providers;
          },
          track: async (name, data) => {
            const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
            return nextAnalytics.track({ event: name, ...data });
          },
          setDebugMode: async (enabled) => {
            const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
            return nextAnalytics.setDebugMode(enabled);
          },
          invalidateContext: async () => {
            const { nextAnalytics } = await import("./analytics-rw-aPuCY.js").then((n) => n.i);
            return nextAnalytics.invalidateContext();
          }
        },
        // Attribution utilities
        attribution: {
          debug: () => useAttributionStore.getState().debug(),
          get: () => useAttributionStore.getState().getAttributionForApi(),
          setFunnel: (funnel) => useAttributionStore.getState().setFunnelName(funnel),
          setEvclid: (evclid) => useAttributionStore.getState().setEverflowClickId(evclid),
          clearFunnel: () => useAttributionStore.getState().clearPersistedFunnel(),
          getFunnel: () => {
            const state = useAttributionStore.getState();
            const persisted = localStorage.getItem("next_funnel_name") || sessionStorage.getItem("next_funnel_name");
            console.log("Current funnel:", state.funnel);
            console.log("Persisted funnel:", persisted);
            return state.funnel || persisted || "(not set)";
          }
        },
        // Element highlighting
        highlightElement: (selector) => {
          this.logger.debug(`🎯 Highlighting element: ${selector}`);
        },
        addTestItems: () => {
          [2, 7, 9].forEach((packageId) => {
            void cartOperations.addItem({
              packageId,
              quantity: 1,
              price: 19.99,
              title: `Test Package ${packageId}`,
              isUpsell: false
            });
          });
        },
        // Accordion utilities
        accordion: {
          open: (id) => {
            document.dispatchEvent(new CustomEvent("next:accordion-open", { detail: { id } }));
          },
          close: (id) => {
            document.dispatchEvent(new CustomEvent("next:accordion-close", { detail: { id } }));
          },
          toggle: (id) => {
            document.dispatchEvent(new CustomEvent("next:accordion-toggle", { detail: { id } }));
          }
        },
        // Order and upsell utilities
        order: {
          getJourney: () => {
            const orderStore = useOrderStore.getState();
            const journey = orderStore.getUpsellJourney();
            console.table(journey);
            return journey;
          },
          isExpired: () => useOrderStore.getState().isOrderExpired(),
          clearCache: () => {
            useOrderStore.getState().clearOrder();
            console.log("Order cache cleared");
          },
          getStats: () => {
            const orderStore = useOrderStore.getState();
            return {
              hasOrder: !!orderStore.order,
              refId: orderStore.refId,
              orderAge: orderStore.orderLoadedAt ? `${Math.floor((Date.now() - orderStore.orderLoadedAt) / 1e3 / 60)} minutes` : "N/A",
              viewedUpsells: orderStore.viewedUpsells,
              viewedUpsellPages: orderStore.viewedUpsellPages,
              completedUpsells: orderStore.completedUpsells,
              journeyLength: orderStore.upsellJourney.length
            };
          }
        }
      };
    }
  }
  static isInitialized() {
    return this.initialized;
  }
  static async reinitialize() {
    this.logger.info("Reinitializing SDK...");
    if (this.attributeScanner) {
      this.attributeScanner.destroy();
      this.attributeScanner = null;
    }
    this.initialized = false;
    this.retryAttempts = 0;
    await this.initialize();
  }
  static async waitForDOM() {
    if (document.readyState === "loading") {
      return new Promise((resolve) => {
        const onReady = () => {
          document.removeEventListener("DOMContentLoaded", onReady);
          document.removeEventListener("readystatechange", onReady);
          resolve();
        };
        document.addEventListener("DOMContentLoaded", onReady);
        document.addEventListener("readystatechange", onReady);
      });
    }
  }
  static async waitForStoreRehydration() {
    const cartStore = useCartStore.getState();
    const storedData = sessionStorage.getItem(CART_STORAGE_KEY);
    if (storedData) {
      this.logger.debug("Waiting for cart store rehydration...");
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      cartOperations.calculateTotals();
      this.logger.debug("Cart store rehydration complete", {
        itemCount: cartStore.items.length,
        total: cartStore.total,
        isEmpty: cartStore.isEmpty
      });
    } else {
      this.logger.debug("No cart data to rehydrate");
    }
  }
  static emitInitializedEvent() {
    if (typeof window !== "undefined") {
      const event = new CustomEvent("next:initialized", {
        detail: {
          version: "0.2.0",
          timestamp: Date.now(),
          stats: this.attributeScanner?.getStats()
        }
      });
      window.dispatchEvent(event);
    }
  }
  static getAttributeScanner() {
    return this.attributeScanner;
  }
  static getInitializationStats() {
    return {
      initialized: this.initialized,
      retryAttempts: this.retryAttempts,
      ...this.attributeScanner && { scannerStats: this.attributeScanner.getStats() }
    };
  }
  static async clearAllStorage() {
    this.logger.info("Clearing all Next Campaign Cart storage...");
    const sessionKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith("next-") || key.startsWith("_next"))) {
        sessionKeys.push(key);
      }
    }
    sessionKeys.forEach((key) => sessionStorage.removeItem(key));
    const localKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("next-") || key.startsWith("_next"))) {
        localKeys.push(key);
      }
    }
    localKeys.forEach((key) => localStorage.removeItem(key));
    document.cookie.split(";").forEach((cookie) => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name.startsWith("next_") || name.startsWith("_next")) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
      }
    });
    this.logger.info(`Cleared ${sessionKeys.length} sessionStorage items, ${localKeys.length} localStorage items`);
  }
};
_SDKInitializer.logger = createLogger("SDKInitializer");
_SDKInitializer.initialized = false;
_SDKInitializer.attributeScanner = null;
_SDKInitializer.retryAttempts = 0;
_SDKInitializer.maxRetries = 3;
_SDKInitializer.initStartTime = 0;
_SDKInitializer.campaignLoadStartTime = 0;
_SDKInitializer.campaignLoadTime = 0;
_SDKInitializer.campaignFromCache = false;
let SDKInitializer = _SDKInitializer;
const VERSION = typeof window !== "undefined" && window.__NEXT_SDK_VERSION__ ? window.__NEXT_SDK_VERSION__ : "0.4.30";
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      SDKInitializer.initialize();
    });
  } else {
    SDKInitializer.initialize();
  }
  window.addEventListener("next:ready", () => {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => {
        import("./index-dsLHpTg9.js");
        import("./index-C5oFVjzG.js");
        import("./index-DUSMpJ15.js");
        import("./product-display.enhancer-C7TC5oro.js");
        import("./selection-display.enhancer-BDdF3TQR.js");
        import("./timer.enhancer-C2efCEzn.js");
      }, { timeout: 5e3 });
      requestIdleCallback(() => {
        import("./checkout-form.enhancer-D-gAGo2D.js");
        import("./express-checkout-container.enhancer-Dtc7rcWl.js");
        import("./order-display.enhancer-Di5wazPz.js");
        import("./index-6CII0tm6.js");
        import("./attribution-collector-C40FKy4W.js");
        import("./index-DXdpIinF.js");
        import("./index-tSKtKXBV.js");
      }, { timeout: 5e3 });
      requestIdleCallback(() => {
        import("./accordion.enhancer-BR4IkuXE.js");
        import("./coupon.enhancer-Cs8sh_7W.js");
        import("./simple-exit-intent.enhancer-DH3UazqV.js");
      }, { timeout: 5e3 });
    } else {
      setTimeout(() => {
        import("./index-dsLHpTg9.js");
        import("./product-display.enhancer-C7TC5oro.js");
        import("./analytics-rw-aPuCY.js").then((n) => n.i);
      }, 1e3);
    }
  });
}
export {
  AttributeParser as A,
  NextCommerce as N,
  SDKInitializer as S,
  VERSION as V
};
