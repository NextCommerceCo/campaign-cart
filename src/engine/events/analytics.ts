import type { EventName } from './bus';
import type { EventContext } from './context';

/** A product line as GA4 reads it. Prices are numbers in `currency`. */
export interface AnalyticsItem {
  /** The package's SKU, else its id. */
  item_id: string;
  item_name: string;
  /** On order items: the product name, else the campaign name. */
  item_brand?: string;
  /** The campaign name. */
  item_category?: string;
  item_variant?: string;
  item_product_id?: string;
  item_variant_id?: string;
  item_sku?: string;
  item_image?: string;
  /** Unit price paid. */
  price: number;
  /** Unit discount, when the shopper paid less than the listed price. */
  discount?: number;
  quantity: number;
  currency: string;
  /** Position in `items`, from 0. */
  index: number;
}

/** GA4's ecommerce block. */
export interface Ecommerce {
  currency: string;
  /** Σ `price × quantity` of `items`. */
  value: number;
  items: AnalyticsItem[];
  /** The first coupon on the cart. */
  coupon?: string;
  /** The selected shipping method's price. */
  shipping?: number;
}

/** A paid order or upsell. */
export interface Purchase extends Ecommerce {
  transaction_id: string;
  tax: number;
  shipping: number;
  affiliation: 'Online Store' | 'Upsell';
  /** The order's discounts, when it has any. */
  discount?: number;
}

/** Every tracking event the analytics chunk sends, by its GA4 name, and its `params`. */
export interface AnalyticsMap {
  /**
   * Every page load, when the SDK is ready.
   * @group Pages
   */
  page_view: { page_location: string; page_title: string; page_referrer: string };
  /**
   * On ready, when the page shows exactly one package.
   * @group Pages
   */
  view_item: Ecommerce;
  /**
   * On ready, when the page shows more than one package.
   * @group Pages
   */
  view_item_list: Omit<Ecommerce, 'value'> & { item_list_id: 'product_list'; item_list_name: 'Product List' };
  /**
   * When the cart gained packages since the last report, after its price; on ready for a cart filled before the page.
   * @group Carts
   */
  add_to_cart: Ecommerce & {
    /** No package was added in this browser before. */
    first_in_session: boolean;
  };
  /**
   * When the cart lost packages since the last report, at the prices they were reported with.
   * @group Carts
   */
  remove_from_cart: Ecommerce;
  /**
   * After every price update.
   * @group Carts
   */
  update_cart: Ecommerce;
  /**
   * Once per checkout, when its form is ready.
   * @group Checkout
   */
  begin_checkout: Ecommerce;
  /**
   * Once, when the contact details saved an Open Cart.
   * @group Checkout
   */
  generate_lead: { currency: string; value: number; lead_source: 'checkout' };
  /**
   * Once per checkout, when the shipping address is valid or a shipping method is picked.
   * @group Checkout
   */
  add_shipping_info: Ecommerce & {
    /** The shipping method's name, `Standard` when the cart has none. */
    shipping_tier: string;
  };
  /**
   * Once per checkout, when a submit passes its checks.
   * @group Checkout
   */
  add_payment_info: Ecommerce & {
    /** `Credit Card` for a card, else the payment method; none before one is chosen. */
    payment_type?: string;
  };
  /**
   * Once per order, when it is paid; on a later page when the paying page was left before it was sent.
   * @group Orders
   */
  purchase: Purchase;
  /**
   * Once per accepted upsell, when the order is loaded with it.
   * @group Upsells
   */
  upsell_purchase: Purchase & {
    upsell: { original_order_id: string; upsell_number: number; package_id: string; package_name: string };
  };
  /**
   * Once per upsell page, when an offer is shown.
   * @group Upsells
   */
  view_upsell: { order_id: string; page_path: string; currency: string };
  /**
   * Every time an upsell is skipped.
   * @group Upsells
   */
  skip_upsell: { order_id: string; package_id?: number; package_name?: string };
  /**
   * Every time a promotion is shown.
   * @group Promotions
   */
  view_promotion: AnalyticsPromotion;
  /**
   * Every time a promotion is clicked.
   * @group Promotions
   */
  select_promotion: AnalyticsPromotion;
}

/** A promotion as GA4 reads it. */
export interface AnalyticsPromotion {
  promotion_id: string;
  promotion_name?: string;
  creative_name?: string;
}

export type AnalyticsName = keyof AnalyticsMap;

/** One tracking event: `name` decides the shape of `params`. */
export type AnalyticsEvent<K extends AnalyticsName = AnalyticsName> = {
  [N in K]: { name: N; id: string; time: string; params: AnalyticsMap[N]; context: EventContext };
}[K];

export interface AnalyticsTrace {
  trace: 'analytics';
  trigger: EventName;
  name: string;
  sent: boolean;
  reason: string;
  id?: string;
}

export interface AnalyticsEvents {
  /** @internal One tracking event under its GA4 name, for `next.analytics.on`. */
  analytics: AnalyticsEvent;
}
