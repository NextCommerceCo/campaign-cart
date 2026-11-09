/** A promotion the page shows: the exit-intent popup, or an element marked `data-next-promotion`. */
export interface Promotion {
  /** `exitIntent({ id })` or `data-next-promotion`; `exit_intent` for the exit-intent popup by default. */
  id: string;
  /** `exit_intent` for the exit-intent popup, `banner` for a marked element. */
  type: 'exit_intent' | 'banner';
  /** `exitIntent({ name })` or `data-next-promotion-name`, when set. */
  name?: string;
  /** The popup's template name or image URL, or `data-next-promotion-creative`. */
  creative?: string;
}

export interface PromotionEvents {
  /**
   * The promotion is on screen: the popup opened, or half of a marked element is visible.
   * @group Promotions
   */
  'promotion.viewed': Promotion;
  /**
   * The promotion was clicked, before its action runs: an `apply-coupon` button then applies its code.
   * @group Promotions
   */
  'promotion.clicked': Promotion & {
    /** The template button's `data-exit-intent-action`, such as `apply-coupon`. */
    action?: string;
    /** The button's `data-coupon-code`. */
    coupon_code?: string;
  };
  /**
   * The popup closed; once for each `promotion.viewed` of a popup, unless the page removed it.
   * @group Promotions
   */
  'promotion.closed': Promotion & {
    /** `clicked`: after `promotion.clicked`. `dismissed`: Esc or the overlay. `close_button`: the × button. */
    reason: 'clicked' | 'dismissed' | 'close_button';
  };
}
