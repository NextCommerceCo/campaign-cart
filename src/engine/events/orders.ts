import type { ShippingMethod } from './carts';
import type { Address, User } from './checkout';

/** One line of an order. Prices are numbers in the order's currency, as the shopper paid them. */
export interface OrderItem {
  /** The order line's id. */
  id: string;
  /** The product in the store. */
  product_id?: number;
  /** The product's name as customers see it. */
  product_title: string;
  /** The product variant. */
  variant_id?: number;
  /** The variant's name, such as `Black / M`. */
  variant_title?: string;
  /** The product's Stock Keeping Unit. */
  sku?: string;
  image?: string;
  quantity: number;
  /** What one unit cost after discounts. */
  price: number;
  /** What one unit cost before discounts. */
  original_price: number;
  /** What the line cost; `price` is `total / quantity`, rounded to the cent. */
  total: number;
  /** `true` for a line an upsell added. */
  upsell: boolean;
}

/** An order the store created, the same on every `order.*` event. Prices are numbers in `currency`. */
export interface Order {
  /** The order's reference: `ref_id` in post-purchase page URLs. */
  ref_id: string;
  /** The order number customers see. */
  number?: string;
  /** ISO 4217, such as `USD`. */
  currency?: string;
  /** `true` for a test order. */
  test: boolean;
  /** `true` once the order is paid; `false` while the shopper pays at a gateway. */
  paid: boolean;
  lines: OrderItem[];
  /** The codes the shopper applied at checkout in this tab, uppercase. */
  coupons: string[];
  /** The discounts on the order. */
  total_discount: number;
  /** The shipping method's name and price. */
  shipping_method?: Pick<ShippingMethod, 'name' | 'price'>;
  /** The tax in the order. */
  tax: number;
  /** What the shopper paid. */
  total: number;
  user?: Pick<User, 'email' | 'first_name' | 'last_name' | 'phone'>;
  shipping_address?: Address;
  billing_address?: Address;
  /** The API's code for the payment method, such as `card_token` or `paypal`. */
  payment_method?: string;
  /** `true` when upsells can be added to the order. */
  supports_upsells: boolean;
  /** The order's status page on the store. */
  status_url?: string;
}

export interface OrderEvents {
  /**
   * The store created the order, on the checkout: `paid` when it was paid at once, else
   * `payment.redirected` follows and the shopper pays at the gateway.
   * @group Orders
   */
  'order.created': Order;
  /**
   * A page after the checkout loaded the order; on every such page.
   * @group Orders
   */
  'order.loaded': Order;
  /**
   * The order is paid, once per order in this browser: on the checkout after `order.created` when
   * it was paid at once, else after `order.loaded` on the first page that loads it paid.
   * @group Orders
   */
  'order.paid': Order;
  /**
   * An upsell was added to the order, right after `upsell.accepted`.
   * @group Orders
   */
  'order.updated': Order;
}
