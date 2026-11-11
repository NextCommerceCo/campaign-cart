import type { Attribution } from '../../engine/visit/attribution';
import type { DataLayerCustomer } from './customer';

/**
 * The fields every `dl_*` push carries, in the 0.4.x Elevar format.
 * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
 */
export interface DataLayerPush {
  /** The `dl_*` name. */
  event: string;
  /** The tracking event's `event_id`; the transaction id on `dl_purchase` and `dl_upsell_purchase`. */
  event_id: string;
  /** Its ISO time. */
  event_time: string;
  /** In the Elevar format; `dl_purchase` and `dl_upsell_purchase` carry the order's customer in it. */
  user_properties: { visitor_type: 'guest' };
  /** The page, without the query string. */
  page_location: string;
  page_title: string;
  page_referrer: string;
  /** The campaign, at the top level as 0.4.30 sent it. */
  campaign_id?: string;
  campaign_name?: string;
  /** ISO 4217, such as `USD`. */
  campaign_currency?: string;
  campaign_language?: string;
  /** The campaign's public API key. */
  campaign_api_key: string;
  campaign_session_id: string;
  /** UTM parameters, affiliate and click ids, landing page; URLs in `metadata` without their query string. */
  attribution: Attribution;
  _metadata: { source: 'NextDataLayer'; version: string };
}

/** A purchase push: every field of a push, with the customer in `user_properties`. */
export type DataLayerPurchasePush = Omit<DataLayerPush, 'user_properties'> & { user_properties: DataLayerCustomer };

/** One product of a push's `ecommerce.items`, GA4-style. */
export interface DataLayerItem {
  /** The SKU, else the package's external id; `SKU-<product id>` on an order line without one. */
  item_id: string;
  item_name: string;
  /** The product name, else the campaign name; order lines only. */
  item_brand?: string;
  /** The campaign name. */
  item_category?: string;
  item_variant?: string;
  item_product_id?: string;
  item_variant_id?: string;
  item_sku?: string;
  item_image?: string;
  /** What one unit costs, after discounts. */
  price: number;
  /** The discount on one unit, when there is one. */
  discount?: number;
  /** In units: a package of 2 added once is 2. */
  quantity: number;
  /** ISO 4217, such as `USD`. */
  currency: string;
  /** Position in `items`, from 0. */
  index: number;
}

/** A push's `ecommerce`, GA4-style. */
export interface DataLayerEcommerce {
  /** ISO 4217, such as `USD`. */
  currency: string;
  /** Σ `price × quantity` of `items`. */
  value: number;
  items: DataLayerItem[];
  /** The first code on the cart. */
  coupon?: string;
  /** The shipping method's price, once one is picked. */
  shipping?: number;
}

/** A paid order, or one accepted upsell, as `ecommerce`. */
export interface DataLayerPurchase {
  currency: string;
  /** The push's `event_id`. */
  transaction_id: string;
  /** Σ `price × quantity` of `items`. */
  value: number;
  /** 0 on an upsell. */
  tax: number;
  /** 0 on an upsell. */
  shipping: number;
  affiliation: 'Online Store' | 'Upsell';
  /** The order's lines without its upsells, or the upsell's one line. */
  items: DataLayerItem[];
  /** The code the order was placed with. */
  coupon?: string;
  /** The order's total discount, when above 0. */
  discount?: number;
}

/** The fields of an exit-intent popup's push. */
export interface DataLayerExitIntent {
  event_category: 'engagement';
  /** `exit_intent_<moment>`, or `exit_intent_<button action>` on `dl_exit_intent_action`. */
  event_action: string;
  /** The popup's image URL, else its template; the coupon code or button action on `dl_exit_intent_action`. */
  event_label: string;
}

/** A promotion push's `ecommerce`. */
export interface DataLayerPromotion {
  promotion_id: string;
  promotion_name?: string;
  creative_name?: string;
}

/** An exit-intent popup, as its pushes describe it. */
export interface DataLayerPopup {
  /** Its image URL, else empty. */
  image_url: string;
  /** Its template, else empty. */
  template: string;
}

/**
 * Every `dl_*` push the GTM destination sends to `window.NextDataLayer` and `window.dataLayer`:
 * the 0.4.x format, kept for GTM containers built on it.
 * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
 */
export interface DataLayerEventMap {
  /**
   * Every page load, with the cart.
   * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
   */
  dl_user_data: DataLayerPush & {
    /** The cart's total, as the API priced it. */
    cart_total: string;
    ecommerce: DataLayerEcommerce;
  };
  /**
   * The page shows one package.
   * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
   */
  dl_view_item: DataLayerPush & { ecommerce: DataLayerEcommerce };
  /**
   * The page shows more than one package.
   * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
   */
  dl_view_item_list: DataLayerPush & {
    ecommerce: Omit<DataLayerEcommerce, 'value'> & { item_list_id: 'product_list'; item_list_name: 'Product List' };
  };
  /**
   * Lines added to the cart, one push per burst.
   * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
   */
  dl_add_to_cart: DataLayerPush & {
    ecommerce: DataLayerEcommerce;
    /** No package was added in this tab before. */
    first_in_session: boolean;
  };
  /**
   * Lines removed from the cart, one push per burst.
   * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
   */
  dl_remove_from_cart: DataLayerPush & { ecommerce: DataLayerEcommerce };
  /**
   * The cart after a price update. Not an Elevar event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_cart_updated: DataLayerPush & {
    cart_total: string;
    ecommerce: DataLayerEcommerce;
    /** The 0.4.x cart summary. */
    cart: {
      currency: string;
      items: Array<{ package_id: number; quantity: number; price: number }>;
      /** Σ `quantity`. */
      total_items: number;
      /** Σ `price × quantity`. */
      total_value: number;
    };
  };
  /**
   * The checkout started.
   * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
   */
  dl_begin_checkout: DataLayerPush & { cart_total: string; ecommerce: DataLayerEcommerce };
  /**
   * The contact details saved an Open Cart. Not an Elevar event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_generate_lead: DataLayerPush & { currency: string; value: number; lead_source: 'checkout' };
  /**
   * Once per checkout: the first of a valid shipping address and a picked shipping method.
   * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
   */
  dl_add_shipping_info: DataLayerPush & {
    ecommerce: DataLayerEcommerce & { currencyCode: string; shipping_tier: string };
    event_category: 'ecommerce';
    /** The cart's total. */
    event_value: number;
    /** The shipping method's name, else `Standard`. */
    shipping_tier: string;
  };
  /**
   * A checkout submit passed its checks.
   * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
   */
  dl_add_payment_info: DataLayerPush & {
    ecommerce: DataLayerEcommerce & { payment_type?: string };
    event_category: 'ecommerce';
    /** The cart's total. */
    event_value: number;
    /** `Credit Card` for a card, else the payment method; none before one is picked. */
    payment_type?: string;
  };
  /**
   * An order was paid, without its upsells.
   * @see https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables
   */
  dl_purchase: DataLayerPurchasePush & { pageType: 'purchase'; ecommerce: DataLayerPurchase };
  /**
   * One upsell was accepted. Not an Elevar event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_upsell_purchase: DataLayerPurchasePush & {
    pageType: 'upsell';
    ecommerce: DataLayerPurchase;
    upsell_metadata: {
      /** The order's `ref_id`. */
      original_order_id: string;
      /** 1 for the first upsell on the order. */
      upsell_number: number;
      package_id: string;
      package_name: string;
    };
  };
  /**
   * An upsell page showed an offer. Not an Elevar event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_viewed_upsell: DataLayerPush & {
    /** The order's `ref_id`. */
    order_id: string;
    page_path: string;
    upsell: { package_id: 'page_view'; package_name: 'Upsell Page View'; currency: string };
  };
  /**
   * An upsell was skipped. Not an Elevar event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_skipped_upsell: DataLayerPush & {
    /** The order's `ref_id`. */
    order_id: string;
    /** The first package offered; `unknown` when there was none. */
    upsell: { package_id: string; package_name: string };
  };
  /**
   * A promotion was shown. Not an Elevar event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_view_promotion: DataLayerPush & { ecommerce: DataLayerPromotion };
  /**
   * A promotion was clicked. Not an Elevar event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_select_promotion: DataLayerPush & { ecommerce: DataLayerPromotion };
  /**
   * The exit-intent popup opened. It has no tracking event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_exit_intent_shown: DataLayerPush & DataLayerExitIntent & { exit_intent: DataLayerPopup };
  /**
   * The exit-intent popup's image was clicked. It has no tracking event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_exit_intent_accepted: DataLayerPush & DataLayerExitIntent & { exit_intent: DataLayerPopup };
  /**
   * A close or apply-coupon button of the exit-intent popup, or a custom action once it has run. It has no tracking event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_exit_intent_action: DataLayerPush &
    DataLayerExitIntent & {
      /** `close`, `apply-coupon` or `custom`, with the code an apply-coupon button applied. */
      exit_intent: { action: string; coupon_code: string };
    };
  /**
   * Esc or the overlay closed the exit-intent popup. It has no tracking event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_exit_intent_dismissed: DataLayerPush & DataLayerExitIntent & { exit_intent: DataLayerPopup };
  /**
   * The exit-intent popup's × button closed it. It has no tracking event.
   * @see https://docs.getelevar.com/docs/data-layer-overview
   */
  dl_exit_intent_closed: DataLayerPush & DataLayerExitIntent & { exit_intent: DataLayerPopup };
}

export type DataLayerName = keyof DataLayerEventMap;
