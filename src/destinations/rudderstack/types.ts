import type { Engine } from '../../engine/engine';

/** The campaign every call carries, its empty fields left out. */
export interface RudderStackCampaign {
  campaign_name?: string;
  campaign_api_key?: string;
  /** ISO 4217, such as `USD`. */
  campaign_currency?: string;
  campaign_language?: string;
  /** The campaign's `id`, as a string. */
  campaign_id?: string;
  /** The tracking event's `session_id`. */
  campaign_session_id?: string;
}

/** What every `track` call carries besides its own fields. */
export interface RudderStackContext extends RudderStackCampaign {
  /** `meta[name="next-page-type"]`, else `nextConfig.pageType`, else `product`. */
  page_type: string;
  /** `meta[name="next-page-name"]`, else the page's title. */
  page_name: string;
}

/**
 * One product, as the RudderStack ecommerce spec names its fields.
 * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/ordering/#product-viewed
 */
export interface RudderStackProduct {
  /** The product's id, else `sku`. */
  product_id: string;
  /** The product's SKU, else the package's `external_id` on a cart line and `SKU-<product id>` on an order line. */
  sku: string;
  name: string;
  /** What one unit costs; on an order, before tax unless the campaign's prices include it. */
  price: number;
  quantity: number;
  /** The page, without its query string. */
  url: string;
  /** The campaign's name. */
  category?: string;
  /** On an order: the package's product name, else the campaign's name. */
  brand?: string;
  variant?: string;
  /** Position in `products`, from 0. */
  position: number;
  image_url?: string;
}

/** The page of a `page()` call and its `<Page type> Page View` track. */
export interface RudderStackPageProperties extends RudderStackCampaign {
  /** The page's path. */
  path: string;
  /** The page, without its query string. */
  url: string;
  title: string;
  /** Without the query string. */
  referrer: string;
}

/** The shopper, as `identify()` takes them. */
export interface RudderStackTraits {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  /** The state or province code. */
  state?: string;
  /** ISO 3166-1 alpha-2. */
  country?: string;
  postalCode?: string;
  /** Only when the shopper ticked the marketing checkbox. */
  acceptsMarketing?: true;
}

/** An upsell offer: the shown page, or the skipped package. */
export interface RudderStackUpsell {
  /** The order the offer is for. */
  order_id: string;
  /** `page_view` for a shown offer, else the package's `ref_id`. */
  product_id: string;
  /** `Upsell Page View` for a shown offer, else the package's name. */
  name: string;
  quantity: 1;
  currency: string;
}

/**
 * What the RudderStack destination sends: `page()` and `identify()`, then each `track()` event
 * with its properties, as 0.4.x sent them. The upsell events are not in the spec.
 * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/
 */
export interface RudderStackEventMap {
  /**
   * `page(page type, page name, properties)`, then a `<Page type> Page View` track with `page_name` added.
   * @see https://www.rudderstack.com/docs/event-spec/standard-events/page/
   */
  page: RudderStackPageProperties;
  /**
   * `identify(email, traits)` once the shopper left their details, and `identify(email or order id, traits)` before each `Order Completed`.
   * @see https://www.rudderstack.com/docs/event-spec/standard-events/identify/
   */
  identify: RudderStackTraits;
  /**
   * A product the shopper sees.
   * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/ordering/#product-viewed
   */
  'Product Viewed': RudderStackProduct &
    RudderStackContext & {
      /** ISO 4217, such as `USD`. */
      currency: string;
    };
  /**
   * The products a page shows.
   * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/browsing/#product-list-viewed
   */
  'Product List Viewed': RudderStackContext & {
    products: RudderStackProduct[];
    /** ISO 4217, such as `USD`. */
    currency: string;
    list_id: 'product_list';
    category: 'Product List';
  };
  /**
   * A product added to the cart.
   * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/ordering/#product-added
   */
  'Product Added': RudderStackProduct &
    RudderStackContext & {
      /** The session id: the same on the cart, the checkout and the order. */
      cart_id: string;
      /** ISO 4217, such as `USD`. */
      currency: string;
    };
  /**
   * A product removed from the cart.
   * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/ordering/#product-removed
   */
  'Product Removed': RudderStackProduct &
    RudderStackContext & {
      /** The session id: the same on the cart, the checkout and the order. */
      cart_id: string;
      /** ISO 4217, such as `USD`. */
      currency: string;
    };
  /**
   * The cart after a price update.
   * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/ordering/#cart-viewed
   */
  'Cart Viewed': RudderStackContext & {
    /** The session id: the same on the cart, the checkout and the order. */
    cart_id: string;
    products: RudderStackProduct[];
    /** ISO 4217, such as `USD`. */
    currency: string;
    /** Σ `price × quantity` of `products`. */
    value: number;
  };
  /**
   * The checkout started.
   * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/ordering/#checkout-started
   */
  'Checkout Started': RudderStackContext & {
    /** Σ `price × quantity` of `products`. */
    value: number;
    /** The same as `value`. */
    revenue: number;
    /** ISO 4217, such as `USD`. */
    currency: string;
    /** The campaign's name. */
    affiliation: string;
    products: RudderStackProduct[];
    shipping?: number;
    /** The first code the shopper applied. */
    coupon?: string;
  };
  /**
   * The shipping step: once per checkout, for the first of its address and method.
   * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/ordering/#checkout-step-completed
   */
  'Checkout Step Completed': RudderStackContext & {
    /** The session id: the same on the cart, the checkout and the order. */
    checkout_id: string;
    step: 2;
    /** The method's name, else `Standard`. */
    shipping_method: string;
  };
  /**
   * The payment details were submitted.
   * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/ordering/#payment-info-entered
   */
  'Payment Info Entered': RudderStackContext & {
    /** The session id: the same on the cart, the checkout and the order. */
    checkout_id: string;
    step: 3;
    /** `Credit Card` for a card, else the API's code, such as `paypal`. */
    payment_method?: string;
  };
  /**
   * An order was paid: the order, or one accepted upsell with its own `order_id`.
   * @see https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/ordering/#order-completed
   */
  'Order Completed': RudderStackContext & {
    /** The session id: the same on the cart, the checkout and the order. */
    checkout_id: string;
    /** ISO 4217, such as `USD`. */
    currency: string;
    /** The tracking event's `event_id`: the order number, or `<ref_id>-US<n>` for an upsell. */
    order_id: string;
    /** `Online Store`, or `Upsell`. */
    affiliation: string;
    /** Σ `price × quantity` of `products`. */
    subtotal: number;
    /** The same as `subtotal`. */
    revenue: number;
    /** `subtotal + tax + shipping`. */
    total: number;
    shipping: number;
    tax: number;
    products: RudderStackProduct[];
    discount?: number;
    coupon?: string;
  };
  /**
   * An upsell offer was shown.
   * @see https://www.rudderstack.com/docs/event-spec/standard-events/track/
   */
  'Upsell Viewed': RudderStackUpsell & RudderStackContext;
  /**
   * An upsell offer was skipped.
   * @see https://www.rudderstack.com/docs/event-spec/standard-events/track/
   */
  'Upsell Skipped': RudderStackUpsell & RudderStackContext;
}

export type RudderStackName = keyof RudderStackEventMap;
export type TrackName = Exclude<RudderStackName, 'page' | 'identify'>;

/** One `rudderanalytics` call. */
export type RudderStackCall =
  | { call: 'page'; category: string; name: string; properties: RudderStackPageProperties }
  | { call: 'identify'; userId: string; traits: RudderStackTraits }
  | { call: 'track'; name: `${string} Page View`; properties: RudderStackPageProperties & { page_name: string } }
  | { [N in TrackName]: { call: 'track'; name: N; properties: RudderStackEventMap[N] } }[TrackName];

export interface RudderStackOptions {
  /** `campaign_api_key`. */
  apiKey?: string;
  /** `page_type` and the `page()` category; `product` when not set. */
  pageType?: string;
  /** `page_name` and the `page()` name; the page's title when not set. */
  pageName?: string;
}

/** What the remap reads beyond the event: the catalog, and the order as the Campaigns API returned it. */
export type RudderStackSource = Pick<Engine, 'getPackage' | 'getState'>;
