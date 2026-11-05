/** A discount on the cart's products or on its shipping. Amounts are in the cart's currency. */
export interface Discount {
  /** The offer's name. */
  name: string;
  /** The amount taken off. */
  amount: number;
  /** `coupon` for a code the shopper entered (it is in `coupons`); `offer` for an automatic offer or a bundle card's own code. */
  source: 'offer' | 'coupon';
  /** The code, for a coupon. */
  code?: string;
  /** The offer that gave it. */
  offer_id: number;
}

export interface CouponEvents {
  /**
   * A code takes money off and is on the cart. A code entered while the cart is empty waits for the
   * cart's first price.
   * @group Coupons
   */
  'coupon.applied': {
    code: string;
    /** What the code takes off, once the cart is priced. */
    amount?: number;
    /** The cart's discounts that carry this code. */
    discounts?: Discount[];
  };
  /**
   * A code was taken off the cart.
   * @group Coupons
   */
  'coupon.removed': {
    code: string;
    /** `shopper`: removed with `removeCoupon` or the page. `cleared`: the cart was cleared. */
    reason: 'shopper' | 'cleared';
  };
  /**
   * A code is not applied.
   * @group Coupons
   */
  'coupon.denied': {
    code: string;
    /** `no_discount`: it takes nothing off this cart. `duplicate`: it is already on the cart. `check_failed`: it could not be checked. */
    reason: 'no_discount' | 'duplicate' | 'check_failed';
    /** For developers and logs, never for shoppers. */
    message?: string;
  };
}
