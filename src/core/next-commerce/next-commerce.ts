/**
 * Main SDK class providing programmatic API access
 * This is the public interface for advanced users who need direct access to SDK functionality
 */

import type {
  Campaign,
  CallbackType,
  CallbackData,
  EventMap,
} from '@/types/global';
import { cartOperations } from '@/state/cart';
import { EventBus } from '@/core/events';
import { Logger } from '@/core/logger';
import * as cartMethods from '@/core/next-commerce/next-commerce.cart';
import * as campaignMethods from '@/core/next-commerce/next-commerce.campaign';
import * as eventMethods from '@/core/next-commerce/next-commerce.events';
import * as analyticsMethods from '@/core/next-commerce/next-commerce.analytics';
import * as attributionMethods from '@/core/next-commerce/next-commerce.attribution';
import * as shippingMethods from '@/core/next-commerce/next-commerce.shipping';
import type {
  ShippingMethodInfo,
  SelectedShippingMethod,
} from '@/core/next-commerce/next-commerce.shipping';
import * as utilityMethods from '@/core/next-commerce/next-commerce.utility';
import * as couponMethods from '@/core/next-commerce/next-commerce.coupons';
import * as popupMethods from '@/core/next-commerce/next-commerce.popups';
import type {
  PopupsState,
  ExitIntentOptions,
  FomoConfig,
} from '@/core/next-commerce/next-commerce.popups';
import * as upsellMethods from '@/core/next-commerce/next-commerce.upsells';
import type { AddUpsellOptions } from '@/core/next-commerce/next-commerce.upsells';
import * as urlParamMethods from '@/core/next-commerce/next-commerce.url-params';

/**
 * The programmatic SDK facade — the scriptable counterpart to the `data-next-*`
 * attributes. A single instance is created during initialization and exposed as
 * `window.next`, so most code obtains it directly rather than constructing one.
 *
 * Use it to read cart/campaign state, drive the cart ({@link NextCommerce.cart}),
 * subscribe to events, and fire analytics — all without touching the DOM layer.
 *
 * This class is a thin orchestrator: the constructor and singleton accessor live
 * here, and every other method delegates to a same-named function extracted
 * verbatim into a sibling module grouped by `@category`
 * (`next-commerce.cart.ts`, `next-commerce.analytics.ts`, …). Splitting this way
 * keeps the class — and the published `window.next` member list — exactly where
 * it was; only the implementation moved.
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
  /** Owned lazily by {@link NextCommerce.exitIntent} / {@link NextCommerce.fomo}. */
  private popupsState: PopupsState = {
    exitIntentEnhancer: null,
    fomoEnhancer: null,
  };

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
   * @category Cart
   */
  public hasItemInCart(options: { packageId?: number }): boolean {
    return cartMethods.hasItemInCart(options);
  }

  /**
   * Adds a package to the cart (quantity defaults to 1). No-op if `packageId`
   * is omitted. For upsell adds use {@link NextCommerce.cart}.
   * @category Cart
   */
  public async addItem(options: {
    packageId?: number;
    quantity?: number;
  }): Promise<void> {
    return cartMethods.addItem(options);
  }

  /**
   * Removes a package from the cart entirely. No-op if `packageId` is
   * omitted.
   * @category Cart
   */
  public async removeItem(options: { packageId?: number }): Promise<void> {
    return cartMethods.removeItem(options);
  }

  /**
   * Sets the exact quantity for a package (a quantity of 0 removes it).
   * @category Cart
   */
  public async updateQuantity(options: {
    packageId?: number;
    quantity: number;
  }): Promise<void> {
    return cartMethods.updateQuantity(options);
  }

  /**
   * Empties the cart.
   * @category Cart
   */
  public async clearCart(): Promise<void> {
    return cartMethods.clearCart();
  }

  /**
   * Replaces the entire cart contents with the given items in one atomic swap
   * (used by bundle/package selectors). Existing items not listed are
   * removed.
   * @category Cart
   */
  public async swapCart(
    items: Array<{ packageId: number; quantity: number }>
  ): Promise<void> {
    return cartMethods.swapCart({ logger: this.logger }, items);
  }

  /**
   * A snapshot of the full cart for callbacks — enriched line items, totals,
   * campaign data, and applied vouchers.
   * @category Cart
   */
  public getCartData(): CallbackData {
    return cartMethods.getCartData();
  }

  /**
   * The current cart totals (subtotal, total, discounts, shipping) as
   * `Decimal`s.
   * @category Cart
   */
  public getCartTotals() {
    return cartMethods.getCartTotals();
  }

  /**
   * Total number of units in the cart (sum of item quantities).
   * @category Cart
   */
  public getCartCount(): number {
    return cartMethods.getCartCount();
  }

  /**
   * The loaded campaign (packages, currency, shipping methods), or `null` if
   * it hasn't loaded yet.
   * @category Campaign
   */
  public getCampaignData(): Campaign | null {
    return campaignMethods.getCampaignData();
  }

  /**
   * Looks up a package by its `ref_id` in the loaded campaign.
   * @category Campaign
   */
  public getPackage(id: number): any | null {
    return campaignMethods.getPackage(id);
  }

  /**
   * All variant packages for a product id (variant selection support).
   * @category Campaign
   */
  public getVariantsByProductId(productId: number): any | null {
    return campaignMethods.getVariantsByProductId(productId);
  }

  /**
   * The distinct values available for one variant attribute (e.g. all sizes)
   * of a product — used to build variant pickers.
   * @category Campaign
   */
  public getAvailableVariantAttributes(
    productId: number,
    attributeCode: string
  ): string[] {
    return campaignMethods.getAvailableVariantAttributes(
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
    return campaignMethods.getPackageByVariantSelection(
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
    return campaignMethods.createVariantKey(attributes);
  }

  /**
   * Subscribes to an SDK event. Names and payloads are typed via `EventMap`.
   * @category Events
   */
  public on<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): void {
    eventMethods.on(this.eventsContext, event, handler);
  }

  /**
   * Unsubscribes a handler previously registered with {@link NextCommerce.on}.
   * @category Events
   */
  public off<K extends keyof EventMap>(event: K, handler: Function): void {
    eventMethods.off(this.eventsContext, event, handler);
  }

  /**
   * Registers a callback for a lifecycle callback type (e.g. cart/order
   * hooks). Prefer {@link NextCommerce.on} for event-style subscriptions.
   * @category Events
   */
  public registerCallback(
    type: CallbackType,
    callback: (data: CallbackData) => void
  ): void {
    eventMethods.registerCallback(this.eventsContext, type, callback);
  }

  /**
   * Removes a callback registered with {@link NextCommerce.registerCallback}.
   * @category Events
   */
  public unregisterCallback(type: CallbackType, callback: Function): void {
    eventMethods.unregisterCallback(this.eventsContext, type, callback);
  }

  /**
   * Invokes all callbacks registered for a type (errors are caught and
   * logged).
   * @category Events
   */
  public triggerCallback(type: CallbackType, data: CallbackData): void {
    eventMethods.triggerCallback(this.eventsContext, type, data);
  }

  private get eventsContext(): eventMethods.NextCommerceEventsContext {
    return {
      eventBus: this.eventBus,
      callbacks: this.callbacks,
      logger: this.logger,
    };
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
    return analyticsMethods.trackViewItemList(
      this.logger,
      packageIds,
      _listId,
      listName
    );
  }

  /**
   * Reports one package as viewed. Warns and sends nothing when the package
   * is not in the loaded campaign, so an early call is silently dropped.
   * @category Analytics
   */
  public async trackViewItem(packageId: string | number): Promise<void> {
    return analyticsMethods.trackViewItem(this.logger, packageId);
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
    return analyticsMethods.trackAddToCart(this.logger, packageId, quantity);
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
    return analyticsMethods.trackRemoveFromCart(
      this.logger,
      packageId,
      quantity
    );
  }

  /**
   * Reports checkout starting, from the current cart. The built-in checkout
   * form already fires this — call it only for a hand-built flow.
   * @category Analytics
   */
  public async trackBeginCheckout(): Promise<void> {
    return analyticsMethods.trackBeginCheckout(this.logger);
  }

  /**
   * Reports a completed order from an order payload. The receipt page already
   * fires this; a second call doubles reported revenue.
   * @category Analytics
   */
  public async trackPurchase(orderData: any): Promise<void> {
    return analyticsMethods.trackPurchase(this.logger, orderData);
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
    return analyticsMethods.trackCustomEvent(this.logger, eventName, data);
  }

  // User tracking methods
  /**
   * Reports a newsletter or account sign-up. The address goes into the event
   * payload as `customer_email` in the clear — nothing hashes it — so it
   * reaches every configured provider and the browser data layer as plain
   * text.
   * @category Analytics
   */
  public async trackSignUp(email: string): Promise<void> {
    return analyticsMethods.trackSignUp(this.logger, email);
  }

  /**
   * Reports a returning visitor signing in. Carries the address in the clear,
   * exactly as {@link NextCommerce.trackSignUp} does.
   * @category Analytics
   */
  public async trackLogin(email: string): Promise<void> {
    return analyticsMethods.trackLogin(this.logger, email);
  }

  // Advanced analytics methods
  /**
   * Turns verbose analytics logging on or off at runtime. Unrelated to the
   * debug overlay, which is `?debugger=true` or `window.nextConfig.debugger`.
   * @category Analytics
   */
  public async setDebugMode(enabled: boolean): Promise<void> {
    return analyticsMethods.setDebugMode(this.logger, enabled);
  }

  /**
   * Discards the cached page context so the next event is built from the
   * current route. Needed in a single-page app, where no page load resets it.
   * @category Analytics
   */
  public async invalidateAnalyticsContext(): Promise<void> {
    return analyticsMethods.invalidateAnalyticsContext(this.logger);
  }

  // Attribution metadata methods
  /**
   * Adds one key to the attribution metadata sent with the order, merging so
   * the automatically collected fields survive.
   * @category Metadata
   */
  public addMetadata(key: string, value: any): void {
    attributionMethods.addMetadata(this.logger, key, value);
  }

  /**
   * Adds several keys to the attribution metadata. Merges rather than
   * replaces, despite the name — a true replace would wipe the automatic
   * fields.
   * @category Metadata
   */
  public setMetadata(metadata: Record<string, any>): void {
    attributionMethods.setMetadata(this.logger, metadata);
  }

  /**
   * Drops caller-supplied metadata while preserving the automatic fields
   * (`landing_page`, `referrer`, `device`, `device_type`, `domain`,
   * `timestamp`).
   * @category Metadata
   */
  public clearMetadata(): void {
    attributionMethods.clearMetadata(this.logger);
  }

  /**
   * The attribution metadata as stored. `undefined` means the read failed; an
   * empty bag is `{}`.
   * @category Metadata
   */
  public getMetadata(): Record<string, any> | undefined {
    return attributionMethods.getMetadata(this.logger);
  }

  /**
   * Overwrites the collected attribution — funnel, affiliate, `utm_*`. This
   * decides who is credited for the sale, so it is a reporting change.
   * @category Attribution
   */
  public setAttribution(attribution: Record<string, any>): void {
    attributionMethods.setAttribution(this.logger, attribution);
  }

  /**
   * Attribution in the shape sent to the order API, not the raw store — the
   * right thing to log when an order is attributed wrongly.
   * @category Attribution
   */
  public getAttribution(): Record<string, any> | undefined {
    return attributionMethods.getAttribution(this.logger);
  }

  /**
   * Prints the whole attribution state to the console. Returns nothing; use
   * {@link NextCommerce.getAttribution} when you need a value.
   * @category Attribution
   */
  public debugAttribution(): void {
    attributionMethods.debugAttribution(this.logger);
  }

  /**
   * All shipping methods available in the loaded campaign.
   * @category Shipping
   */
  public getShippingMethods(): ShippingMethodInfo[] {
    return shippingMethods.getShippingMethods();
  }

  /**
   * The currently selected shipping method, or `null` if none chosen yet.
   * @category Shipping
   */
  public getSelectedShippingMethod(): SelectedShippingMethod | null {
    return shippingMethods.getSelectedShippingMethod();
  }

  /**
   * Selects a shipping method by id and recalculates cart totals. Throws if
   * the id isn't in the campaign's shipping methods.
   * @category Shipping
   */
  public async setShippingMethod(methodId: number): Promise<void> {
    return shippingMethods.setShippingMethod(methodId);
  }

  /**
   * The resolved SDK version (runtime loader value if present, else build-
   * time).
   * @category Utility
   */
  public getVersion(): string {
    return utilityMethods.getVersion();
  }

  /**
   * Formats an amount using the campaign currency (or an override), e.g.
   * `$19.99`.
   * @category Utility
   */
  public formatPrice(amount: number, currency?: string): string {
    return utilityMethods.formatPrice(amount, currency);
  }

  /**
   * Lightweight pre-checkout validation (currently: cart must not be empty).
   * @category Utility
   */
  public validateCheckout(): { valid: boolean; errors: string[] } {
    return utilityMethods.validateCheckout();
  }

  /**
   * Applies a coupon code and recalculates totals. Returns `{ success,
   * message }` — `success: false` when the code is already applied or
   * invalid.
   * @category Coupons
   */
  public async applyCoupon(
    code: string
  ): Promise<{ success: boolean; message: string }> {
    return couponMethods.applyCoupon(code);
  }

  /**
   * Removes a previously applied coupon and recalculates totals.
   * @category Coupons
   */
  public removeCoupon(code: string): void {
    couponMethods.removeCoupon(code);
  }

  /**
   * The coupon codes currently applied to the cart.
   * @category Coupons
   */
  public getCoupons(): string[] {
    return couponMethods.getCoupons();
  }

  // Exit Intent - Simple approach
  /**
   * Arms the exit-intent popup, lazy-loading its enhancer on the first call.
   * Rethrows when that import fails.
   * @category Popups
   */
  public async exitIntent(options: ExitIntentOptions): Promise<void> {
    return popupMethods.exitIntent(
      { state: this.popupsState, logger: this.logger },
      options
    );
  }

  /**
   * Stops the exit-intent popup from appearing again. No-op when {@link NextCommerce.exitIntent} was never called.
   * @category Popups
   */
  public disableExitIntent(): void {
    popupMethods.disableExitIntent({ state: this.popupsState });
  }

  // FOMO Popup - Simple social proof
  /**
   * Starts the rotating social-proof popup, lazy-loading its enhancer on the
   * first call. With no config it uses the enhancer's own defaults.
   * @category Popups
   */
  public async fomo(config?: FomoConfig): Promise<void> {
    return popupMethods.fomo(
      { state: this.popupsState, logger: this.logger },
      config
    );
  }

  /**
   * Stops the social-proof popup rotation. No-op when {@link NextCommerce.fomo} was never called.
   * @category Popups
   */
  public stopFomo(): void {
    popupMethods.stopFomo({ state: this.popupsState });
  }

  // Upsell methods
  /**
   * Adds packages to the already-paid order, charging the saved payment
   * method. Throws when there is no order in session, when the order cannot
   * take upsells or is mid-processing, and when neither `packageId` nor
   * `items` is given.
   * @category Upsells
   */
  public async addUpsell(options: AddUpsellOptions): Promise<any> {
    return upsellMethods.addUpsell(
      { logger: this.logger, eventBus: this.eventBus },
      options
    );
  }

  /**
   * Whether the order in session can take a post-purchase upsell right now.
   * Also `false` while one is processing, so it guards a double submit.
   * @category Upsells
   */
  public canAddUpsells(): boolean {
    return upsellMethods.canAddUpsells();
  }

  /**
   * Package ids already accepted on this order, as strings rather than
   * numbers.
   * @category Upsells
   */
  public getCompletedUpsells(): string[] {
    return upsellMethods.getCompletedUpsells();
  }

  /**
   * Whether a package was already accepted on this order — checks the
   * completed list and the accepted entries of the upsell journey, so it
   * survives a reload.
   * @category Upsells
   */
  public isUpsellAlreadyAdded(packageId: number): boolean {
    return upsellMethods.isUpsellAlreadyAdded(packageId);
  }

  // URL Parameter Methods
  /**
   * Sets one captured URL parameter for the rest of the session. Does not
   * touch the address bar.
   * @category URL Parameters
   */
  public setParam(key: string, value: string): void {
    urlParamMethods.setParam(this.logger, key, value);
  }

  /**
   * Sets several captured URL parameters, replacing the keys named and
   * leaving the rest alone.
   * @category URL Parameters
   */
  public setParams(params: Record<string, string>): void {
    urlParamMethods.setParams(this.logger, params);
  }

  /**
   * Reads one captured URL parameter. `null` when it was never captured.
   * @category URL Parameters
   */
  public getParam(key: string): string | null {
    return urlParamMethods.getParam(key);
  }

  /**
   * Every URL parameter captured for this session.
   * @category URL Parameters
   */
  public getAllParams(): Record<string, string> {
    return urlParamMethods.getAllParams();
  }

  /**
   * Whether a parameter was captured, including one present with an empty
   * value.
   * @category URL Parameters
   */
  public hasParam(key: string): boolean {
    return urlParamMethods.hasParam(key);
  }

  /**
   * Forgets one captured URL parameter.
   * @category URL Parameters
   */
  public clearParam(key: string): void {
    urlParamMethods.clearParam(this.logger, key);
  }

  /**
   * Forgets every captured URL parameter — `utm_*` values included, which
   * attribution reads.
   * @category URL Parameters
   */
  public clearAllParams(): void {
    urlParamMethods.clearAllParams(this.logger);
  }

  /**
   * Adds parameters to the captured set without disturbing keys it does not
   * name.
   * @category URL Parameters
   */
  public mergeParams(params: Record<string, string>): void {
    urlParamMethods.mergeParams(this.logger, params);
  }
}
