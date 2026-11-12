import type { Line } from '../cart/types';
import type { Discount } from './coupons';

/** A package billed again every interval. */
export interface Subscription {
  /** The unit of the renewal interval. */
  interval: 'day' | 'month';
  /** How many `interval`s between renewals. */
  interval_count: number;
  /** What each renewal charges, after discounts. @priced */
  price?: number;
  /** What each renewal charges before discounts. @priced */
  original_price?: number;
}

/** A line of the cart. Its prices are there once the server priced the cart. */
export interface CartItem extends Line {
  /** The product in the store. @campaign */
  product_id?: number;
  /** The product's name as customers see it, as on an order line; the package's name for a package without one. @campaign */
  product_title?: string;
  /** The product variant, for a product with variants. @campaign */
  variant_id?: number;
  /** The variant's name, such as `Black / M`, for a product with variants. @campaign */
  variant_title?: string;
  /** The product's Stock Keeping Unit. @campaign */
  sku?: string;
  /** The package's image URL. @campaign */
  image?: string;
  /** What one package costs after discounts. @priced */
  price?: number;
  /** What one package costs before discounts; equal to `price` when nothing is taken off. @priced */
  original_price?: number;
  /** The discount on the line. @priced */
  total_discount?: number;
  /** `price × quantity`. @priced */
  total?: number;
  /** The line before discounts: `total = subtotal − total_discount`. @priced */
  subtotal?: number;
  /** `total_discount ÷ subtotal × 100`, to two decimals; `0` without a discount. @priced */
  discount_percentage?: number;
  /** The discounts on the line. @priced */
  discounts?: Discount[];
  /** For a package billed again every interval. @campaign */
  subscription?: Subscription;
}

/** The selected shipping method, and what shipping costs. */
export interface ShippingMethod {
  /** The method's `ref_id`. */
  id: number;
  /** Such as `standard`. @campaign */
  code?: string;
  /** The method's name. @priced */
  name?: string;
  /** What shipping costs after discounts; `0` is free shipping. @priced */
  price?: number;
  /** What shipping costs before discounts. @priced */
  original_price?: number;
  /** The discounts on shipping, such as a free-shipping offer. @priced */
  discounts?: Discount[];
}

/**
 * The cart every `cart.*` event carries. Prices are numbers in `currency`, there once the server
 * priced these lines: `total = subtotal − total_discount + shipping_method.price`.
 */
export interface Cart {
  /** Every line in the cart, the same package's lines merged. */
  lines: CartItem[];
  /** The codes the shopper applied, uppercase. A bundle card's own codes are not listed. */
  coupons: string[];
  /** ISO 4217, such as `USD`. @campaign */
  currency?: string;
  /** The selected shipping method, and what shipping costs. */
  shipping_method?: ShippingMethod;
  /** The products before discounts, without shipping. @priced */
  subtotal?: number;
  /** The discounts on the products, without shipping's: the sum of `discounts`. @priced */
  total_discount?: number;
  /** What the shopper pays. @priced */
  total?: number;
  /** `total − shipping_method.price`: the products after discounts, without shipping. @priced */
  total_before_shipping?: number;
  /** The discounts on the products, one per offer. @priced */
  discounts?: Discount[];
  /** `total_discount ÷ subtotal × 100`, to two decimals; `0` without a discount. @priced */
  discount_percentage?: number;
  /** Units in the cart: each line's quantity. */
  quantity: number;
}

/** A package added to or removed from the cart by one change. */
export interface CartChange {
  /** The package's `ref_id` in the campaign. */
  package_id: number;
  /** The product in the store. @campaign */
  product_id?: number;
  /** The product variant. @campaign */
  variant_id?: number;
  /** How many packages were added or removed. */
  quantity: number;
  /** The package's quantity in the cart before the change. */
  from: number;
  /** The package's quantity in the cart after the change. */
  to: number;
  /** What one package costs, when the server has already priced it. @priced */
  price?: number;
}

export interface CartEvents {
  /**
   * Lines, coupons or shipping changed, at once, before the server prices them.
   * @group Carts
   */
  'cart.updated': Cart;
  /**
   * Pricing starts; once for a burst of changes.
   * @group Carts
   */
  'cart.calculating': Cart;
  /**
   * Server totals arrived.
   * @group Carts
   */
  'cart.calculated': Cart;
  /**
   * Packages one change added, after its `cart.updated`.
   * @group Carts
   */
  'cart.added': Cart & {
    /** What the change added. */
    changes: CartChange[];
  };
  /**
   * Packages one change removed, after its `cart.updated`.
   * @group Carts
   */
  'cart.removed': Cart & {
    /** What the change removed. */
    changes: CartChange[];
  };
  /** @internal The shipping method a change selected, once the cart was priced with it or could not be: the moment of 0.4.x shipping events. */
  'shipping.settled': ShippingMethod;
}
