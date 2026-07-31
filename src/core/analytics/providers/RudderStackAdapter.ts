import {
  ProviderAdapter,
  notSupported,
  asSkipResult,
  DispatchError,
  type SkipResult,
} from './ProviderAdapter';
import { DataLayerEvent } from '../types';
import { createLogger } from '@/core/logger';
import { useConfigStore } from '@/state/config';
import { useCampaignStore } from '@/state/campaign';

const logger = createLogger('RudderStack');

declare global {
  interface Window {
    rudderanalytics: {
      track: (event: string, properties?: any, options?: any) => void;
      page: (
        category?: string,
        name?: string,
        properties?: any,
        options?: any
      ) => void;
      identify: (userId: string, traits?: any, options?: any) => void;
      reset: () => void;
      ready: (callback: () => void) => void;
    };
  }
}

/**
 * A built-but-not-yet-dispatched RudderStack call: `descriptor` is the shape
 * shown in the debug overlay, `dispatch()` performs the actual SDK call(s).
 */
interface RudderPlan {
  descriptor: unknown;
  dispatch: () => void;
}

/**
 * RudderStack Analytics adapter
 * Maps SDK events to RudderStack events matching the old integration format
 */
export class RudderStackAdapter extends ProviderAdapter {
  private pageViewSent = false;
  private loadWarned = false;

  constructor() {
    super('RudderStack');
  }

  /** Warn once, with the fix, when the RudderStack SDK never loads. */
  private warnScriptMissing(): void {
    if (this.loadWarned) return;
    this.loadWarned = true;
    this.logger.warn(
      'rudderanalytics not found — add the RudderStack JavaScript SDK snippet ' +
        'to the page so events can be delivered. See ' +
        'https://www.rudderstack.com/docs/sources/event-streams/sdks/rudderstack-javascript-sdk/'
    );
  }

  /**
   * Forward the campaign_* identifiers stamped on the event by DataLayerManager
   * (issue #473) onto the RudderStack payload, keeping their snake_case names.
   * Empty values omitted.
   */
  private buildContextProps(event: DataLayerEvent): Record<string, string> {
    const keys = [
      'campaign_name',
      'campaign_api_key',
      'campaign_currency',
      'campaign_language',
      'campaign_id',
      'campaign_session_id',
    ];
    const out: Record<string, string> = {};
    for (const key of keys) {
      const value = (event as Record<string, any>)[key];
      if (value !== undefined && value !== null && value !== '') {
        out[key] = String(value);
      }
    }
    return out;
  }

  /**
   * Check if RudderStack is loaded
   */
  private isRudderStackLoaded(): boolean {
    return (
      this.isBrowser() &&
      typeof window.rudderanalytics === 'object' &&
      typeof window.rudderanalytics.track === 'function'
    );
  }

  protected override isReady(): boolean {
    return this.isRudderStackLoaded();
  }

  protected override getDebugDetails(): Record<
    string,
    string | number | boolean
  > {
    return {
      scriptLoaded: this.isRudderStackLoaded(),
      pageViewSent: this.pageViewSent,
    };
  }

  /**
   * Send event to RudderStack.
   *
   * Returns the transformed payload actually dispatched (the RudderStack call +
   * its arguments) so the debug overlay can show exactly what this provider
   * sent. When RudderStack has not loaded yet, the returned promise resolves to
   * that payload once the send completes (or rejects on load timeout).
   */
  sendEvent(event: DataLayerEvent): unknown | Promise<unknown> {
    if (!this.enabled) {
      this.debug('RudderStack adapter disabled');
      return undefined;
    }

    // Log all events being sent to RudderStack
    logger.info(`Processing event "${event.event}"`, {
      eventName: event.event,
      eventData: event,
    });

    // Build the payload up front — independent of whether the SDK has loaded —
    // so the debug overlay can show what we'd send even if the send fails.
    const plan = this.buildPlan(event);
    const skip = asSkipResult(plan);
    if (skip) return skip;
    const ready = plan as RudderPlan;

    // If RudderStack is not loaded yet, wait for it before dispatching. On
    // timeout, surface the prepared descriptor so it's still inspectable.
    if (!this.isRudderStackLoaded()) {
      return this.waitForRudderStack()
        .then(() => {
          ready.dispatch();
          return ready.descriptor;
        })
        .catch(() => {
          this.warnScriptMissing();
          throw new DispatchError('RudderStack load timeout', ready.descriptor);
        });
    }

    ready.dispatch();
    return ready.descriptor;
  }

  /**
   * Wait for RudderStack to be loaded
   */
  private async waitForRudderStack(timeout: number = 5000): Promise<void> {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      // Check if ready callback is available
      if (window.rudderanalytics?.ready) {
        window.rudderanalytics.ready(() => resolve());

        // Still set a timeout in case ready never fires
        setTimeout(() => {
          if (this.isRudderStackLoaded()) {
            resolve();
          } else {
            reject(new Error('RudderStack ready timeout'));
          }
        }, timeout);
      } else {
        // Fallback to polling
        const checkInterval = setInterval(() => {
          if (this.isRudderStackLoaded()) {
            clearInterval(checkInterval);
            resolve();
          } else if (Date.now() - start > timeout) {
            clearInterval(checkInterval);
            reject(new Error('RudderStack load timeout'));
          }
        }, 100);
      }
    });
  }

  /**
   * Build the RudderStack call(s) for an event WITHOUT dispatching: returns a
   * {@link RudderPlan} pairing the overlay descriptor with a `dispatch()` that
   * performs the actual `window.rudderanalytics.*` calls, or a
   * {@link notSupported} skip result when nothing would be sent. Splitting build
   * from dispatch lets the overlay show the payload even when the send fails.
   */
  private buildPlan(event: DataLayerEvent): RudderPlan | SkipResult {
    switch (event.event) {
      case 'dl_page_view':
      case 'page_view':
        return this.buildPageViewPlan(event);

      case 'dl_user_data':
      case 'user_data':
        return this.buildUserDataPlan(event);

      default: {
        const rudderEventName = this.mapEventName(event.event);
        if (!rudderEventName)
          return notSupported('no RudderStack mapping for this event');
        const properties = this.buildEventProperties(event, rudderEventName);
        return {
          descriptor: { method: 'track', event: rudderEventName, properties },
          dispatch: () => {
            window.rudderanalytics.track(rudderEventName, properties);
            this.debug(
              `Event sent to RudderStack: ${rudderEventName}`,
              properties
            );
          },
        };
      }
    }
  }

  /** Build the `page()` + custom `track()` plan for a page-view event. */
  private buildPageViewPlan(event: DataLayerEvent): RudderPlan | SkipResult {
    if (this.pageViewSent) {
      return notSupported('duplicate page view');
    }

    // The page-view event carries its data on `event.page`
    // ({ title, url, path, referrer }) — see AutoEventListener. `event.data`
    // is only present for legacy/manual pushes, so fall back to it.
    const page = (event as any).page || event.data || {};
    // page_type / page_name are NOT on the event — resolve them from the config
    // store (pageType) and the document title, never a hard-coded 'unknown'.
    const { pageType, pageName } = this.getPageMetadata();

    const properties = {
      path: page.path || window.location.pathname,
      url: page.url || page.page_location || window.location.href,
      title: page.title || document.title,
      referrer: page.referrer || document.referrer,
      ...this.buildContextProps(event),
    };

    const pageTypeCapitalized =
      pageType.charAt(0).toUpperCase() + pageType.slice(1);
    const eventName = `${pageTypeCapitalized} Page View`;
    const customProperties = { page_name: pageName, ...properties };

    return {
      descriptor: {
        calls: [
          { method: 'page', category: pageType, name: pageName, properties },
          { method: 'track', event: eventName, properties: customProperties },
        ],
      },
      dispatch: () => {
        window.rudderanalytics.page(pageType, pageName, properties);
        window.rudderanalytics.track(eventName, customProperties);
        this.pageViewSent = true;
        this.debug('Page View tracked', { pageType, pageName, eventName });
      },
    };
  }

  /** Build the `identify()` plan for a user-data event. */
  private buildUserDataPlan(event: DataLayerEvent): RudderPlan | SkipResult {
    const userData = event.user_properties || event.data || {};

    if (!(userData.customer_email || userData.email || userData.user_id)) {
      // Supported event, but no email/user_id to identify — nothing to send.
      return notSupported('no identifiable user (guest)');
    }

    const userId =
      userData.user_id || userData.customer_email || userData.email;

    const traits = {
      email: userData.customer_email || userData.email,
      firstName:
        userData.customer_first_name ||
        userData.firstName ||
        userData.first_name,
      lastName:
        userData.customer_last_name || userData.lastName || userData.last_name,
      phone: userData.customer_phone || userData.phone,
      city: userData.customer_city || userData.city,
      state: userData.customer_state || userData.state,
      country: userData.customer_country || userData.country,
      postalCode:
        userData.customer_zip || userData.postalCode || userData.postal_code,
      acceptsMarketing:
        userData.customer_accepts_marketing ||
        userData.acceptsMarketing ||
        userData.accepts_marketing,
    };

    // Remove undefined values
    Object.keys(traits).forEach(
      key =>
        traits[key as keyof typeof traits] === undefined &&
        delete traits[key as keyof typeof traits]
    );

    return {
      descriptor: { method: 'identify', userId, traits },
      dispatch: () => {
        window.rudderanalytics.identify(userId, traits);
        this.debug('User Identified', { userId, traits });
      },
    };
  }

  /**
   * Map data layer event names to RudderStack event names
   */
  private mapEventName(eventName: string): string | null {
    // Names follow the RudderStack Ecommerce Events Spec:
    // https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/
    const eventMapping: Record<string, string> = {
      // Ecommerce events
      dl_view_item: 'Product Viewed',
      dl_select_item: 'Product Clicked',
      dl_view_item_list: 'Product List Viewed',
      dl_add_to_cart: 'Product Added',
      dl_remove_from_cart: 'Product Removed',
      dl_view_cart: 'Cart Viewed',
      dl_cart_updated: 'Cart Viewed',
      dl_begin_checkout: 'Checkout Started',
      // Spec has no "shipping info" event; shipping selection is a checkout
      // step. Payment uses the spec's exact "Payment Info Entered" name.
      dl_add_shipping_info: 'Checkout Step Completed',
      dl_add_payment_info: 'Payment Info Entered',
      dl_purchase: 'Order Completed',
      // Accepted upsell is a separate post-purchase transaction (its own
      // transaction_id, `<order>-US<n>`) → a second Order Completed.
      dl_upsell_purchase: 'Order Completed',

      // Standard names
      view_item: 'Product Viewed',
      select_item: 'Product Clicked',
      view_item_list: 'Product List Viewed',
      add_to_cart: 'Product Added',
      remove_from_cart: 'Product Removed',
      view_cart: 'Cart Viewed',
      begin_checkout: 'Checkout Started',
      add_shipping_info: 'Checkout Step Completed',
      add_payment_info: 'Payment Info Entered',
      purchase: 'Order Completed',

      // Upsell offer events (custom — not part of the spec)
      dl_viewed_upsell: 'Upsell Viewed',
      dl_skipped_upsell: 'Upsell Skipped',

      // User events
      dl_sign_up: 'Signed Up',
      dl_login: 'Logged In',
      sign_up: 'Signed Up',
      login: 'Logged In',
    };

    return eventMapping[eventName] || null;
  }

  /**
   * Build event properties based on event type
   */
  private buildEventProperties(
    event: DataLayerEvent,
    rudderEventName: string
  ): any {
    const data = event.data || event.ecommerce || {};
    const pageMetadata = this.getPageMetadata();

    // Page context + campaign_* identifiers on every track event.
    const baseProps = {
      page_type: pageMetadata.pageType,
      page_name: pageMetadata.pageName,
      ...this.buildContextProps(event),
    };

    // Stable per-session id (survives the whole funnel) used for the spec's
    // cart_id / checkout_id — RudderStack correlates cart → checkout → order by
    // these. No dedicated cart/checkout id exists client-side, so the session id
    // is the closest stable proxy (a per-event timestamp would break grouping).
    const sessionId: string | undefined = (event._metadata as any)?.session_id;

    switch (rudderEventName) {
      case 'Product Viewed':
      case 'Product Clicked':
        return this.buildProductViewedProps(data, baseProps);

      case 'Product List Viewed':
        return this.buildProductListViewedProps(data, baseProps);

      case 'Product Added':
      case 'Product Removed':
        return this.buildProductAddedRemovedProps(data, baseProps, sessionId);

      case 'Cart Viewed':
        return this.buildCartViewedProps(data, baseProps, sessionId);

      case 'Checkout Started':
        return this.buildCheckoutStartedProps(data, baseProps);

      case 'Checkout Step Completed':
        return this.buildShippingStepProps(data, baseProps, sessionId);

      case 'Payment Info Entered':
        return this.buildPaymentInfoProps(data, baseProps, sessionId);

      case 'Order Completed': {
        const props = this.buildOrderCompletedProps(data, baseProps, sessionId);
        this.identifyFromUserProperties(event.user_properties, props.order_id);
        return props;
      }

      case 'Upsell Viewed':
      case 'Upsell Skipped':
        return this.buildUpsellProps(event, baseProps);

      default:
        return { ...data, ...baseProps };
    }
  }

  /**
   * Coerce a value to a finite number, defaulting to 0.
   */
  private toNumber(value: unknown): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Build Product Viewed / Product Clicked properties.
   * Spec: top-level Product fields + currency.
   */
  private buildProductViewedProps(data: any, baseProps: any): any {
    const item = (data.items || [])[0] || {};
    const campaignData = this.getCampaignData(data);

    return {
      ...this.formatProduct(item),
      currency: data.currency || campaignData.campaignCurrency || 'USD',
      ...baseProps,
    };
  }

  /**
   * Build Product List Viewed properties.
   * Spec: list_id, category, products[].
   */
  private buildProductListViewedProps(data: any, baseProps: any): any {
    const campaignData = this.getCampaignData(data);
    const props: any = {
      products: this.formatProducts(data.items || []),
      currency: data.currency || campaignData.campaignCurrency || 'USD',
    };

    const listId = data.item_list_id || data.list_id;
    if (listId) props.list_id = listId;
    const category = data.item_list_name || data.item_list_id;
    if (category) props.category = category;

    return { ...props, ...baseProps };
  }

  /**
   * Build Product Added / Product Removed properties.
   * Spec: cart_id + top-level Product fields. cart_id is the per-session id
   * (see buildEventProperties); omitted only if the session id is unavailable.
   */
  private buildProductAddedRemovedProps(
    data: any,
    baseProps: any,
    cartId?: string
  ): any {
    const item = (data.items || [])[0] || {};
    const campaignData = this.getCampaignData(data);

    return {
      ...(cartId ? { cart_id: cartId } : {}),
      ...this.formatProduct(item),
      currency: data.currency || campaignData.campaignCurrency || 'USD',
      ...baseProps,
    };
  }

  /**
   * Build Cart Viewed properties.
   * Spec: cart_id + products[]; value/currency added for reporting.
   */
  private buildCartViewedProps(data: any, baseProps: any, cartId?: string): any {
    const campaignData = this.getCampaignData(data);

    return {
      ...(cartId ? { cart_id: cartId } : {}),
      products: this.formatProducts(data.items || []),
      currency: data.currency || campaignData.campaignCurrency || 'USD',
      value: this.toNumber(data.value),
      ...baseProps,
    };
  }

  /**
   * Build Checkout Step Completed properties for the shipping step.
   * Spec: checkout_id, step, shipping_method, payment_method.
   */
  private buildShippingStepProps(
    data: any,
    baseProps: any,
    checkoutId?: string
  ): any {
    // Step 2 by convention: 1 = contact/customer, 2 = shipping, 3 = payment.
    const props: any = {
      ...(checkoutId ? { checkout_id: checkoutId } : {}),
      step: 2,
    };
    if (data.shipping_tier) props.shipping_method = data.shipping_tier;
    return { ...props, ...baseProps };
  }

  /**
   * Build Payment Info Entered properties.
   * Spec: checkout_id, order_id, step, shipping_method, payment_method.
   */
  private buildPaymentInfoProps(
    data: any,
    baseProps: any,
    checkoutId?: string
  ): any {
    const props: any = {
      ...(checkoutId ? { checkout_id: checkoutId } : {}),
      step: 3,
    };
    if (data.payment_type) props.payment_method = data.payment_type;
    return { ...props, ...baseProps };
  }

  /**
   * Build Checkout Started properties.
   * Spec: order_id, affiliation, value, revenue, shipping, tax, discount,
   * coupon, currency, products[].
   */
  private buildCheckoutStartedProps(data: any, baseProps: any): any {
    const campaignData = this.getCampaignData(data);
    // value = order revenue after discounts/coupons; revenue = the same figure
    // excluding shipping and tax. At checkout start both equal item revenue.
    const value = this.toNumber(data.value);

    const props: any = {
      value,
      revenue: value,
      currency: data.currency || campaignData.campaignCurrency || 'USD',
      affiliation: data.affiliation || campaignData.campaignName || 'Funnels',
      products: this.formatProducts(data.items || []),
    };

    if (data.shipping !== undefined)
      props.shipping = this.toNumber(data.shipping);
    if (data.tax) props.tax = this.toNumber(data.tax);
    if (data.discount) props.discount = this.toNumber(data.discount);
    if (data.coupon) props.coupon = data.coupon;

    return { ...props, ...baseProps };
  }

  /**
   * Build Order Completed properties.
   * Spec: order_id, affiliation, subtotal, total, revenue, shipping, tax,
   * discount, coupon, currency, products[].
   */
  private buildOrderCompletedProps(
    data: any,
    baseProps: any,
    checkoutId?: string
  ): any {
    const campaignData = this.getCampaignData(data);
    // `value` from the pipeline is item revenue (Σ price × qty), excluding tax
    // and shipping — GA4 semantics. Map it per the RudderStack spec:
    //   revenue / subtotal = item revenue (excl. tax & shipping)
    //   total              = grand total the customer paid (incl. tax & shipping)
    const value = this.toNumber(data.value);
    const tax = this.toNumber(data.tax);
    const shipping = this.toNumber(data.shipping);
    const total = Math.round((value + tax + shipping) * 100) / 100;

    const props: any = {
      ...(checkoutId ? { checkout_id: checkoutId } : {}),
      order_id: data.transaction_id || '',
      affiliation: data.affiliation || campaignData.campaignName || 'Funnels',
      subtotal: value,
      revenue: value,
      total,
      shipping,
      tax,
      currency: data.currency || campaignData.campaignCurrency || 'USD',
      products: this.formatProducts(data.items || []),
    };

    if (data.discount) props.discount = this.toNumber(data.discount);
    if (data.coupon) props.coupon = data.coupon;

    return { ...props, ...baseProps };
  }

  /**
   * Build Upsell Viewed / Upsell Skipped properties. These custom events carry
   * their payload on `event.upsell` ({ package_id, package_name, price,
   * currency }) with the source order on `event.order_id`.
   */
  private buildUpsellProps(event: DataLayerEvent, baseProps: any): any {
    const upsell = (event as any).upsell || {};
    const campaignData = this.getCampaignData({});

    const props: any = {
      order_id: event.order_id || '',
      product_id: upsell.package_id || '',
      name: upsell.package_name || '',
      quantity: 1,
      currency: upsell.currency || campaignData.campaignCurrency || 'USD',
    };

    if (upsell.price !== undefined) props.price = this.toNumber(upsell.price);

    return { ...props, ...baseProps };
  }

  /**
   * Identify the customer from the event's user_properties (fired on purchase).
   * Traits use the RudderStack-recommended names.
   */
  private identifyFromUserProperties(
    userProperties: Record<string, any> | undefined,
    fallbackId?: string
  ): void {
    const props = userProperties || {};
    const userId = props.customer_id || props.customer_email || fallbackId;
    if (!userId) return;

    const traits: Record<string, any> = {
      email: props.customer_email,
      firstName: props.customer_first_name,
      lastName: props.customer_last_name,
      phone: props.customer_phone,
      city: props.customer_city,
      state: props.customer_province || props.customer_province_code,
      country: props.customer_country,
      postalCode: props.customer_zip,
    };
    Object.keys(traits).forEach(
      key => traits[key] === undefined && delete traits[key]
    );

    if (Object.keys(traits).length > 0) {
      window.rudderanalytics.identify(String(userId), traits);
      this.debug('User Identified on Purchase', { userId });
    }
  }

  /**
   * Map a GA4-format item (item_id / item_product_id / item_sku / index /
   * item_image …) to a RudderStack spec Product object. Optional fields are
   * only included when present so the payload stays clean.
   */
  private formatProduct(item: any): Record<string, any> {
    const product: Record<string, any> = {
      // product_id = the product's database ID; sku = the stock-keeping unit.
      // GA4 `item_id` holds the product SKU, `item_product_id` the numeric id.
      product_id: String(
        item.item_product_id ?? item.product_id ?? item.item_id ?? item.id ?? ''
      ),
      sku: String(item.item_sku ?? item.item_id ?? item.sku ?? ''),
      name: item.item_name ?? item.name ?? '',
      price: this.toNumber(item.price),
      quantity: parseInt(item.quantity, 10) || 1,
      url: window.location.href,
    };

    const category = item.item_category ?? item.category;
    if (category) product.category = category;
    const brand = item.item_brand ?? item.brand;
    if (brand) product.brand = brand;
    const variant = item.item_variant ?? item.variant;
    if (variant) product.variant = variant;
    if (item.coupon) product.coupon = item.coupon;
    // GA4 `index` is the 0-based list position.
    const position = item.index ?? item.position;
    if (typeof position === 'number') product.position = position;
    const imageUrl = item.item_image ?? item.image_url ?? item.image;
    if (imageUrl) product.image_url = imageUrl;

    return product;
  }

  /**
   * Map an array of GA4-format items to RudderStack spec Product objects.
   */
  private formatProducts(items: any[]): any[] {
    if (!Array.isArray(items)) return [];
    return items.map(item => this.formatProduct(item));
  }

  /**
   * Resolve the page type and a human page name.
   *
   * `pageType` comes from the config store (set from `meta[name="next-page-type"]`
   * / `window.nextConfig`, default `product`) — the canonical source, so it is
   * never `unknown` on a configured page. `pageName` has no dedicated field in
   * the SDK: an optional `meta[name="next-page-name"]` wins, otherwise the
   * document title, falling back to the page type. Empty strings are treated as
   * absent so a value is always returned.
   */
  private getPageMetadata(): { pageType: string; pageName: string } {
    let pageType = '';
    try {
      pageType = useConfigStore.getState().pageType || '';
    } catch {
      // Store unavailable (SSR/tests) — fall back to the meta tag.
      pageType =
        document
          .querySelector('meta[name="next-page-type"]')
          ?.getAttribute('content') || '';
    }
    if (!pageType) pageType = 'unknown';

    const pageNameMeta = document
      .querySelector('meta[name="next-page-name"]')
      ?.getAttribute('content');
    const pageName = pageNameMeta || document.title || pageType;

    return { pageType, pageName };
  }

  /**
   * Get campaign data from event or SDK
   */
  private getCampaignData(data: any): any {
    // Explicit values on the event win.
    if (data?.campaignName) {
      return {
        campaignName: data.campaignName,
        campaignApiKey: data.campaignApiKey || '',
        campaignCurrency: data.campaignCurrency || 'USD',
        campaignLanguage: data.campaignLanguage || '',
      };
    }

    // Read the stores directly. They are populated when the campaign loads and
    // are available before the `window.next` global is set, so these fields are
    // not empty just because a page view fired early in init.
    try {
      const campaign = useCampaignStore.getState().data;
      if (campaign) {
        return {
          campaignName: campaign.name || '',
          campaignApiKey: useConfigStore.getState().apiKey || '',
          campaignCurrency: campaign.currency || 'USD',
          campaignLanguage: campaign.language || '',
        };
      }
    } catch {
      // Stores unavailable (SSR/tests) — fall back to the window.next SDK global.
    }

    // Last resort: the public SDK global.
    if (this.isBrowser() && (window as any).next) {
      const sdk = (window as any).next;
      const campaignData = sdk.getCampaignData?.();
      if (campaignData) {
        return {
          campaignName: campaignData.name || '',
          campaignApiKey:
            (window as any).nextDebug?.stores?.config?.getState()?.apiKey || '',
          campaignCurrency: campaignData.currency || 'USD',
          campaignLanguage: campaignData.language || '',
        };
      }
    }

    return {
      campaignName: '',
      campaignApiKey: '',
      campaignCurrency: 'USD',
      campaignLanguage: '',
    };
  }
}
