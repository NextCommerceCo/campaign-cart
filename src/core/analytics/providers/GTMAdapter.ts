import { ProviderAdapter } from './ProviderAdapter';
import { DataLayerEvent } from '../types';

declare global {
  interface Window {
    dataLayer: any[];
    ElevarDataLayer?: any[];
    ElevarInvalidateContext?: () => void;
  }
}

/**
 * Google Tag Manager adapter
 */
export class GTMAdapter extends ProviderAdapter {
  constructor(config?: { blockedEvents?: string[] }) {
    super('GTM', { blockedEvents: config?.blockedEvents });
  }

  protected override isReady(): boolean {
    return this.isBrowser() && Array.isArray(window.dataLayer);
  }

  protected override getDebugDetails(): Record<string, string | number | boolean> {
    return {
      dataLayer: this.isBrowser() && Array.isArray(window.dataLayer),
      elevarDataLayer: this.isBrowser() && Array.isArray(window.ElevarDataLayer),
    };
  }

  /**
   * Send event to Google Tag Manager
   */
  sendEvent(event: DataLayerEvent): unknown {
    if (!this.isBrowser()) {
      return undefined;
    }

    // Ensure dataLayers exist
    window.dataLayer = window.dataLayer || [];
    window.ElevarDataLayer = window.ElevarDataLayer || [];

    // For Elevar events (dl_*), push to both ElevarDataLayer and dataLayer
    if (event.event.startsWith('dl_')) {
      // Push to ElevarDataLayer first (primary for Elevar processing)
      window.ElevarDataLayer.push(event);

      // Also push to standard dataLayer for GTM (with ecommerce clear)
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push(event);

      this.debug('Elevar event sent to both ElevarDataLayer and dataLayer', event);
      // dl_* events are pushed to the dataLayer as-is.
      return event;
    }

    // For non-Elevar events, use existing transformation
    const gtmEvent = this.transformToGTMFormat(event);

    // Clear ecommerce object before pushing new data (GTM best practice)
    if (this.isEcommerceEvent(event.event)) {
      window.dataLayer.push({ ecommerce: null });
    }

    // Push the event
    window.dataLayer.push(gtmEvent);

    this.debug('Event sent to GTM', gtmEvent);
    return gtmEvent;
  }

  /**
   * Transform event to GTM-specific format
   */
  private transformToGTMFormat(event: DataLayerEvent): any {
    const baseEvent = {
      event: event.event,
      event_timestamp: event.timestamp,
      event_id: event.id
    };

    // Get attribution data if present
    const attribution = (event as any).attribution;

    // Handle ecommerce events specially
    if (this.isEcommerceEvent(event.event)) {
      const gtmEvent: any = {
        ...baseEvent,
        ecommerce: this.buildEcommerceObject(event)
      };
      
      // Add attribution at root level for easy GTM access
      if (attribution && Object.keys(attribution).length > 0) {
        gtmEvent.attribution = attribution;
        
        // Also spread key attribution fields at root for convenience
        if (attribution.utm_source) gtmEvent.utm_source = attribution.utm_source;
        if (attribution.utm_medium) gtmEvent.utm_medium = attribution.utm_medium;
        if (attribution.utm_campaign) gtmEvent.utm_campaign = attribution.utm_campaign;
        if (attribution.funnel) gtmEvent.funnel = attribution.funnel;
        if (attribution.affiliate) gtmEvent.affiliate = attribution.affiliate;
        if (attribution.gclid) gtmEvent.gclid = attribution.gclid;
      }
      
      return gtmEvent;
    }

    // For non-ecommerce events
    const gtmEvent: any = {
      ...baseEvent,
      ...event.data
    };
    
    // Add attribution for non-ecommerce events too
    if (attribution && Object.keys(attribution).length > 0) {
      gtmEvent.attribution = attribution;
      
      // Also spread key attribution fields at root for convenience
      if (attribution.utm_source) gtmEvent.utm_source = attribution.utm_source;
      if (attribution.utm_medium) gtmEvent.utm_medium = attribution.utm_medium;
      if (attribution.utm_campaign) gtmEvent.utm_campaign = attribution.utm_campaign;
      if (attribution.funnel) gtmEvent.funnel = attribution.funnel;
      if (attribution.affiliate) gtmEvent.affiliate = attribution.affiliate;
      if (attribution.gclid) gtmEvent.gclid = attribution.gclid;
    }
    
    return gtmEvent;
  }

  /**
   * Build ecommerce object structure for GTM
   *
   * Field selection follows the GA4 ecommerce reference
   * (https://developers.google.com/analytics/devguides/collection/ga4/ecommerce):
   * only the parameters GA4 defines for each event are emitted, so list and
   * promotion events don't carry an out-of-spec `value`.
   */
  private buildEcommerceObject(event: DataLayerEvent): any {
    const ecommerceData = this.extractEcommerceData(event);
    const eventType = this.getEcommerceEventType(event.event);
    const data = event.data ?? {};
    const eco = ((event as any).ecommerce ?? {}) as Record<string, any>;
    const pick = (key: string): any => eco[key] ?? data[key];

    const ecommerceObject: any = {
      currency: ecommerceData.currency
    };

    // `value` (item revenue) applies to value-bearing events only. GA4 does not
    // define `value` for list/select/promotion events, so emitting it there is
    // out of spec — see eventHasValue().
    if (this.eventHasValue(eventType)) {
      ecommerceObject.value = parseFloat(this.formatCurrency(ecommerceData.value));
    }

    // Add items if present
    if (ecommerceData.items.length > 0) {
      ecommerceObject.items = this.formatItems(ecommerceData.items);
    }

    // Transaction details for purchase and refund (both require transaction_id;
    // tax/shipping are recommended on both).
    if (eventType === 'purchase' || eventType === 'refund') {
      ecommerceObject.transaction_id = ecommerceData.transaction_id;
      ecommerceObject.tax = ecommerceData.tax;
      ecommerceObject.shipping = ecommerceData.shipping;

      if (eventType === 'purchase') {
        ecommerceObject.affiliation = data.affiliation || 'Online Store';
        const customerType = pick('customer_type');
        if (customerType) ecommerceObject.customer_type = customerType;
      }
    }

    // Order-level coupon — purchase, refund and the checkout funnel events
    // (begin_checkout, add_shipping_info, add_payment_info) all accept it.
    if (ecommerceData.coupon && this.eventAcceptsCoupon(eventType)) {
      ecommerceObject.coupon = ecommerceData.coupon;
    }

    // Add cart_id for add_to_cart events
    if (eventType === 'add_to_cart' && data.cart_id) {
      ecommerceObject.cart_id = data.cart_id;
    }

    // List context for view_item_list AND select_item (GA4 puts item_list_* on
    // both events, not just the list view).
    if (eventType === 'view_item_list' || eventType === 'select_item') {
      const listId = pick('item_list_id');
      const listName = pick('item_list_name');
      if (listId) ecommerceObject.item_list_id = listId;
      if (listName) ecommerceObject.item_list_name = listName;
    }

    // Promotion fields for view_promotion / select_promotion.
    if (eventType === 'view_promotion' || eventType === 'select_promotion') {
      for (const key of [
        'creative_name',
        'creative_slot',
        'promotion_id',
        'promotion_name'
      ]) {
        const value = pick(key);
        if (value != null) ecommerceObject[key] = value;
      }
    }

    // Add shipping_tier for add_shipping_info events
    if (eventType === 'add_shipping_info' && pick('shipping_tier')) {
      ecommerceObject.shipping_tier = pick('shipping_tier');
    }

    // Add payment_type for add_payment_info events
    if (eventType === 'add_payment_info' && pick('payment_type')) {
      ecommerceObject.payment_type = pick('payment_type');
    }

    return ecommerceObject;
  }

  /**
   * Whether GA4 defines a `value` (revenue) parameter for this event. List,
   * select and promotion events carry items but no event-level value.
   */
  private eventHasValue(eventType: string): boolean {
    return [
      'view_item',
      'add_to_cart',
      'add_to_wishlist',
      'remove_from_cart',
      'view_cart',
      'begin_checkout',
      'add_shipping_info',
      'add_payment_info',
      'purchase',
      'refund'
    ].includes(eventType);
  }

  /**
   * Whether GA4 accepts an order-level `coupon` on this event.
   */
  private eventAcceptsCoupon(eventType: string): boolean {
    return [
      'begin_checkout',
      'add_shipping_info',
      'add_payment_info',
      'purchase',
      'refund'
    ].includes(eventType);
  }

  /**
   * Format items array for GTM
   */
  private formatItems(items: any[]): any[] {
    return items.map((item, index) => {
      // Required/always-present fields.
      const formatted: any = {
        item_id: item.item_id || item.id || item.product_id || item.sku,
        item_name: item.item_name || item.name || item.title,
        index: item.index ?? index,
        price: parseFloat(this.formatCurrency(item.price || 0)),
        quantity: item.quantity || 1
      };

      // Optional GA4 item fields — only emitted when actually present, so we
      // don't pad every item with `affiliation: 'Online Store'` / `discount: 0`.
      const optional: Record<string, any> = {
        affiliation: item.affiliation,
        coupon: item.coupon,
        discount: item.discount,
        item_brand: item.item_brand || item.brand,
        item_category: item.item_category || item.category,
        item_category2: item.item_category2 || item.category2,
        item_category3: item.item_category3 || item.category3,
        item_category4: item.item_category4 || item.category4,
        item_category5: item.item_category5 || item.category5,
        item_list_id: item.item_list_id || item.list_id,
        item_list_name: item.item_list_name || item.list_name,
        item_variant: item.item_variant || item.variant,
        item_image:
          item.item_image || item.image || item.image_url || item.imageUrl,
        item_sku: item.item_sku || item.sku,
        location_id: item.location_id,
        // Item-level promotion attribution (view_promotion / select_promotion).
        promotion_id: item.promotion_id,
        promotion_name: item.promotion_name,
        creative_name: item.creative_name,
        creative_slot: item.creative_slot,
        // Google Ads / Merchant Center feed linkage.
        google_business_vertical: item.google_business_vertical
      };

      for (const [key, value] of Object.entries(optional)) {
        if (value !== undefined && value !== null) {
          formatted[key] = value;
        }
      }

      return formatted;
    });
  }

  /**
   * Check if event is an ecommerce event
   */
  private isEcommerceEvent(eventName: string): boolean {
    const ecommerceEvents = [
      'dl_add_to_cart',
      'dl_add_to_wishlist',
      'dl_remove_from_cart',
      'dl_view_cart',
      'dl_begin_checkout',
      'dl_add_payment_info',
      'dl_add_shipping_info',
      'dl_purchase',
      'dl_refund',
      'dl_view_item',
      'dl_view_item_list',
      'dl_select_item',
      'dl_select_promotion',
      'dl_view_promotion',
      // Standard GA4 ecommerce events
      'add_to_cart',
      'add_to_wishlist',
      'remove_from_cart',
      'view_cart',
      'begin_checkout',
      'add_payment_info',
      'add_shipping_info',
      'purchase',
      'refund',
      'view_item',
      'view_item_list',
      'select_item',
      'select_promotion',
      'view_promotion'
    ];

    return ecommerceEvents.includes(eventName);
  }

  /**
   * Get standardized ecommerce event type
   */
  private getEcommerceEventType(eventName: string): string {
    // Remove 'dl_' prefix if present
    return eventName.replace(/^dl_/, '');
  }
}