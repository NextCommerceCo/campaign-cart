import type { Failure } from './sdk';

/** The chosen way to pay. */
export interface Payment {
  /** The API's code: `card_token`, `paypal`, `apple_pay`, `google_pay`, `klarna`, … */
  method: string;
}

export interface PaymentEvents {
  /**
   * The shopper is about to leave for the payment gateway (PayPal, 3-D Secure, …) to pay the order
   * `ref_id`.
   * @group Payments
   */
  'payment.redirected': Payment & {
    /** The order being paid. */
    ref_id: string;
    /** The gateway page. */
    url: string;
  };
  /**
   * A payment was not taken: a card declined on the checkout, the shopper back from a gateway
   * unpaid, or an upsell declined. The cart is kept. Once per order at a gateway.
   * @group Payments
   */
  'payment.failed': Payment & {
    /** The order the payment was for; none for a card declined before an order was created. */
    ref_id?: string;
    /** `declined` (`decline_code` from the gateway) or `payment_failed` (back from a gateway). */
    error: Failure;
  };
}
