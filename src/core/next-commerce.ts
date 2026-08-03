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
import * as cartMethods from '@/core/next-commerce.cart';
import * as campaignMethods from '@/core/next-commerce.campaign';
import * as eventMethods from '@/core/next-commerce.events';
import * as analyticsMethods from '@/core/next-commerce.analytics';
import * as attributionMethods from '@/core/next-commerce.attribution';
import * as shippingMethods from '@/core/next-commerce.shipping';
import type {
  ShippingMethodInfo,
  SelectedShippingMethod,
} from '@/core/next-commerce.shipping';
import * as utilityMethods from '@/core/next-commerce.utility';
import * as couponMethods from '@/core/next-commerce.coupons';
import * as popupMethods from '@/core/next-commerce.popups';
import type {
  PopupsState,
  ExitIntentOptions,
  FomoConfig,
} from '@/core/next-commerce.popups';
import * as upsellMethods from '@/core/next-commerce.upsells';
import type { AddUpsellOptions } from '@/core/next-commerce.upsells';
import * as urlParamMethods from '@/core/next-commerce.url-params';

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
   * {@inheritDoc core/next-commerce.cart!hasItemInCart}
   * @category Cart
   */
  public hasItemInCart(options: { packageId?: number }): boolean {
    return cartMethods.hasItemInCart(options);
  }

  /**
   * {@inheritDoc core/next-commerce.cart!addItem}
   * @category Cart
   */
  public async addItem(options: {
    packageId?: number;
    quantity?: number;
  }): Promise<void> {
    return cartMethods.addItem(options);
  }

  /**
   * {@inheritDoc core/next-commerce.cart!removeItem}
   * @category Cart
   */
  public async removeItem(options: { packageId?: number }): Promise<void> {
    return cartMethods.removeItem(options);
  }

  /**
   * {@inheritDoc core/next-commerce.cart!updateQuantity}
   * @category Cart
   */
  public async updateQuantity(options: {
    packageId?: number;
    quantity: number;
  }): Promise<void> {
    return cartMethods.updateQuantity(options);
  }

  /**
   * {@inheritDoc core/next-commerce.cart!clearCart}
   * @category Cart
   */
  public async clearCart(): Promise<void> {
    return cartMethods.clearCart();
  }

  /**
   * {@inheritDoc core/next-commerce.cart!swapCart}
   * @category Cart
   */
  public async swapCart(
    items: Array<{ packageId: number; quantity: number }>
  ): Promise<void> {
    return cartMethods.swapCart({ logger: this.logger }, items);
  }

  /**
   * {@inheritDoc core/next-commerce.cart!getCartData}
   * @category Cart
   */
  public getCartData(): CallbackData {
    return cartMethods.getCartData();
  }

  /**
   * {@inheritDoc core/next-commerce.cart!getCartTotals}
   * @category Cart
   */
  public getCartTotals() {
    return cartMethods.getCartTotals();
  }

  /**
   * {@inheritDoc core/next-commerce.cart!getCartCount}
   * @category Cart
   */
  public getCartCount(): number {
    return cartMethods.getCartCount();
  }

  /**
   * {@inheritDoc core/next-commerce.campaign!getCampaignData}
   * @category Campaign
   */
  public getCampaignData(): Campaign | null {
    return campaignMethods.getCampaignData();
  }

  /**
   * {@inheritDoc core/next-commerce.campaign!getPackage}
   * @category Campaign
   */
  public getPackage(id: number): any | null {
    return campaignMethods.getPackage(id);
  }

  /**
   * {@inheritDoc core/next-commerce.campaign!getVariantsByProductId}
   * @category Campaign
   */
  public getVariantsByProductId(productId: number): any | null {
    return campaignMethods.getVariantsByProductId(productId);
  }

  /**
   * {@inheritDoc core/next-commerce.campaign!getAvailableVariantAttributes}
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
   * {@inheritDoc core/next-commerce.campaign!getPackageByVariantSelection}
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
   * {@inheritDoc core/next-commerce.campaign!createVariantKey}
   * @category Campaign
   */
  public createVariantKey(attributes: Record<string, string>): string {
    return campaignMethods.createVariantKey(attributes);
  }

  /**
   * {@inheritDoc core/next-commerce.events!on}
   * @category Events
   */
  public on<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): void {
    eventMethods.on(this.eventsContext, event, handler);
  }

  /**
   * {@inheritDoc core/next-commerce.events!off}
   * @category Events
   */
  public off<K extends keyof EventMap>(event: K, handler: Function): void {
    eventMethods.off(this.eventsContext, event, handler);
  }

  /**
   * {@inheritDoc core/next-commerce.events!registerCallback}
   * @category Events
   */
  public registerCallback(
    type: CallbackType,
    callback: (data: CallbackData) => void
  ): void {
    eventMethods.registerCallback(this.eventsContext, type, callback);
  }

  /**
   * {@inheritDoc core/next-commerce.events!unregisterCallback}
   * @category Events
   */
  public unregisterCallback(type: CallbackType, callback: Function): void {
    eventMethods.unregisterCallback(this.eventsContext, type, callback);
  }

  /**
   * {@inheritDoc core/next-commerce.events!triggerCallback}
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
   * {@inheritDoc core/next-commerce.analytics!trackViewItemList}
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
   * {@inheritDoc core/next-commerce.analytics!trackViewItem}
   * @category Analytics
   */
  public async trackViewItem(packageId: string | number): Promise<void> {
    return analyticsMethods.trackViewItem(this.logger, packageId);
  }

  /**
   * {@inheritDoc core/next-commerce.analytics!trackAddToCart}
   * @category Analytics
   */
  public async trackAddToCart(
    packageId: string | number,
    quantity?: number
  ): Promise<void> {
    return analyticsMethods.trackAddToCart(this.logger, packageId, quantity);
  }

  /**
   * {@inheritDoc core/next-commerce.analytics!trackRemoveFromCart}
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
   * {@inheritDoc core/next-commerce.analytics!trackBeginCheckout}
   * @category Analytics
   */
  public async trackBeginCheckout(): Promise<void> {
    return analyticsMethods.trackBeginCheckout(this.logger);
  }

  /**
   * {@inheritDoc core/next-commerce.analytics!trackPurchase}
   * @category Analytics
   */
  public async trackPurchase(orderData: any): Promise<void> {
    return analyticsMethods.trackPurchase(this.logger, orderData);
  }

  /**
   * {@inheritDoc core/next-commerce.analytics!trackCustomEvent}
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
   * {@inheritDoc core/next-commerce.analytics!trackSignUp}
   * @category Analytics
   */
  public async trackSignUp(email: string): Promise<void> {
    return analyticsMethods.trackSignUp(this.logger, email);
  }

  /**
   * {@inheritDoc core/next-commerce.analytics!trackLogin}
   * @category Analytics
   */
  public async trackLogin(email: string): Promise<void> {
    return analyticsMethods.trackLogin(this.logger, email);
  }

  // Advanced analytics methods
  /**
   * {@inheritDoc core/next-commerce.analytics!setDebugMode}
   * @category Analytics
   */
  public async setDebugMode(enabled: boolean): Promise<void> {
    return analyticsMethods.setDebugMode(this.logger, enabled);
  }

  /**
   * {@inheritDoc core/next-commerce.analytics!invalidateAnalyticsContext}
   * @category Analytics
   */
  public async invalidateAnalyticsContext(): Promise<void> {
    return analyticsMethods.invalidateAnalyticsContext(this.logger);
  }

  // Attribution metadata methods
  /**
   * {@inheritDoc core/next-commerce.attribution!addMetadata}
   * @category Metadata
   */
  public addMetadata(key: string, value: any): void {
    attributionMethods.addMetadata(this.logger, key, value);
  }

  /**
   * {@inheritDoc core/next-commerce.attribution!setMetadata}
   * @category Metadata
   */
  public setMetadata(metadata: Record<string, any>): void {
    attributionMethods.setMetadata(this.logger, metadata);
  }

  /**
   * {@inheritDoc core/next-commerce.attribution!clearMetadata}
   * @category Metadata
   */
  public clearMetadata(): void {
    attributionMethods.clearMetadata(this.logger);
  }

  /**
   * {@inheritDoc core/next-commerce.attribution!getMetadata}
   * @category Metadata
   */
  public getMetadata(): Record<string, any> | undefined {
    return attributionMethods.getMetadata(this.logger);
  }

  /**
   * {@inheritDoc core/next-commerce.attribution!setAttribution}
   * @category Attribution
   */
  public setAttribution(attribution: Record<string, any>): void {
    attributionMethods.setAttribution(this.logger, attribution);
  }

  /**
   * {@inheritDoc core/next-commerce.attribution!getAttribution}
   * @category Attribution
   */
  public getAttribution(): Record<string, any> | undefined {
    return attributionMethods.getAttribution(this.logger);
  }

  /**
   * {@inheritDoc core/next-commerce.attribution!debugAttribution}
   * @category Attribution
   */
  public debugAttribution(): void {
    attributionMethods.debugAttribution(this.logger);
  }

  /**
   * {@inheritDoc core/next-commerce.shipping!getShippingMethods}
   * @category Shipping
   */
  public getShippingMethods(): ShippingMethodInfo[] {
    return shippingMethods.getShippingMethods();
  }

  /**
   * {@inheritDoc core/next-commerce.shipping!getSelectedShippingMethod}
   * @category Shipping
   */
  public getSelectedShippingMethod(): SelectedShippingMethod | null {
    return shippingMethods.getSelectedShippingMethod();
  }

  /**
   * {@inheritDoc core/next-commerce.shipping!setShippingMethod}
   * @category Shipping
   */
  public async setShippingMethod(methodId: number): Promise<void> {
    return shippingMethods.setShippingMethod(methodId);
  }

  /**
   * {@inheritDoc core/next-commerce.utility!getVersion}
   * @category Utility
   */
  public getVersion(): string {
    return utilityMethods.getVersion();
  }

  /**
   * {@inheritDoc core/next-commerce.utility!formatPrice}
   * @category Utility
   */
  public formatPrice(amount: number, currency?: string): string {
    return utilityMethods.formatPrice(amount, currency);
  }

  /**
   * {@inheritDoc core/next-commerce.utility!validateCheckout}
   * @category Utility
   */
  public validateCheckout(): { valid: boolean; errors: string[] } {
    return utilityMethods.validateCheckout();
  }

  /**
   * {@inheritDoc core/next-commerce.coupons!applyCoupon}
   * @category Coupons
   */
  public async applyCoupon(
    code: string
  ): Promise<{ success: boolean; message: string }> {
    return couponMethods.applyCoupon(code);
  }

  /**
   * {@inheritDoc core/next-commerce.coupons!removeCoupon}
   * @category Coupons
   */
  public removeCoupon(code: string): void {
    couponMethods.removeCoupon(code);
  }

  /**
   * {@inheritDoc core/next-commerce.coupons!getCoupons}
   * @category Coupons
   */
  public getCoupons(): string[] {
    return couponMethods.getCoupons();
  }

  // Exit Intent - Simple approach
  /**
   * {@inheritDoc core/next-commerce.popups!exitIntent}
   * @category Popups
   */
  public async exitIntent(options: ExitIntentOptions): Promise<void> {
    return popupMethods.exitIntent(
      { state: this.popupsState, logger: this.logger },
      options
    );
  }

  /**
   * {@inheritDoc core/next-commerce.popups!disableExitIntent}
   * @category Popups
   */
  public disableExitIntent(): void {
    popupMethods.disableExitIntent({ state: this.popupsState });
  }

  // FOMO Popup - Simple social proof
  /**
   * {@inheritDoc core/next-commerce.popups!fomo}
   * @category Popups
   */
  public async fomo(config?: FomoConfig): Promise<void> {
    return popupMethods.fomo(
      { state: this.popupsState, logger: this.logger },
      config
    );
  }

  /**
   * {@inheritDoc core/next-commerce.popups!stopFomo}
   * @category Popups
   */
  public stopFomo(): void {
    popupMethods.stopFomo({ state: this.popupsState });
  }

  // Upsell methods
  /**
   * {@inheritDoc core/next-commerce.upsells!addUpsell}
   * @category Upsells
   */
  public async addUpsell(options: AddUpsellOptions): Promise<any> {
    return upsellMethods.addUpsell(
      { logger: this.logger, eventBus: this.eventBus },
      options
    );
  }

  /**
   * {@inheritDoc core/next-commerce.upsells!canAddUpsells}
   * @category Upsells
   */
  public canAddUpsells(): boolean {
    return upsellMethods.canAddUpsells();
  }

  /**
   * {@inheritDoc core/next-commerce.upsells!getCompletedUpsells}
   * @category Upsells
   */
  public getCompletedUpsells(): string[] {
    return upsellMethods.getCompletedUpsells();
  }

  /**
   * {@inheritDoc core/next-commerce.upsells!isUpsellAlreadyAdded}
   * @category Upsells
   */
  public isUpsellAlreadyAdded(packageId: number): boolean {
    return upsellMethods.isUpsellAlreadyAdded(packageId);
  }

  // URL Parameter Methods
  /**
   * {@inheritDoc core/next-commerce.url-params!setParam}
   * @category URL Parameters
   */
  public setParam(key: string, value: string): void {
    urlParamMethods.setParam(this.logger, key, value);
  }

  /**
   * {@inheritDoc core/next-commerce.url-params!setParams}
   * @category URL Parameters
   */
  public setParams(params: Record<string, string>): void {
    urlParamMethods.setParams(this.logger, params);
  }

  /**
   * {@inheritDoc core/next-commerce.url-params!getParam}
   * @category URL Parameters
   */
  public getParam(key: string): string | null {
    return urlParamMethods.getParam(key);
  }

  /**
   * {@inheritDoc core/next-commerce.url-params!getAllParams}
   * @category URL Parameters
   */
  public getAllParams(): Record<string, string> {
    return urlParamMethods.getAllParams();
  }

  /**
   * {@inheritDoc core/next-commerce.url-params!hasParam}
   * @category URL Parameters
   */
  public hasParam(key: string): boolean {
    return urlParamMethods.hasParam(key);
  }

  /**
   * {@inheritDoc core/next-commerce.url-params!clearParam}
   * @category URL Parameters
   */
  public clearParam(key: string): void {
    urlParamMethods.clearParam(this.logger, key);
  }

  /**
   * {@inheritDoc core/next-commerce.url-params!clearAllParams}
   * @category URL Parameters
   */
  public clearAllParams(): void {
    urlParamMethods.clearAllParams(this.logger);
  }

  /**
   * {@inheritDoc core/next-commerce.url-params!mergeParams}
   * @category URL Parameters
   */
  public mergeParams(params: Record<string, string>): void {
    urlParamMethods.mergeParams(this.logger, params);
  }
}
