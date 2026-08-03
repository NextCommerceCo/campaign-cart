/**
 * The two radio groups on a checkout page — **how the shopper pays** and **how the order
 * ships** — and what each choice changes.
 *
 * They are one module because they are the same shape of job: a `change` on a radio, a
 * value written into the checkout store, and one side effect on the page. They keep
 * separate context objects because they share nothing — the payment side needs the UI
 * service, the shipping side needs the analytics latch.
 *
 * **Payment method.** The radio's value is the page's word (`credit`, `paypal`,
 * `apple-pay`…); the store's is the API's (`credit-card`, `paypal`, `apple_pay`…), so
 * every value is mapped rather than passed through, and an unrecognised one falls back to
 * the card form instead of leaving the shopper with no payment fields. Any payment error
 * still on the page is hidden — it belonged to the method they just moved away from.
 *
 * **Shipping method.** The choice goes to the checkout store *and* to the cart, because
 * the cart is what recalculates the totals. `add_shipping_info` is reported the first time
 * a method is chosen and never again.
 *
 * Extracted from `checkout-form.enhancer.ts` verbatim. Payment needs one thing from the
 * form ({@link PaymentMethodContext}), shipping two ({@link ShippingMethodContext}).
 */

import { nextAnalytics, EcommerceEvents } from '@/core/analytics/index';
import type { Logger } from '@/core/logger';
import { cartOperations } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';

import type { UIService } from '../services/ui-service';

/** The page's word for a payment method → the one the orders API uses. */
const PAYMENT_METHOD_MAP: Record<
  string,
  | 'card_token'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay'
  | 'klarna'
  | 'credit-card'
> = {
  credit: 'credit-card',
  paypal: 'paypal',
  'apple-pay': 'apple_pay',
  'google-pay': 'google_pay',
  klarna: 'klarna',
};

/** The shipping methods this handler recognises, by the radio's numeric value. */
const SHIPPING_METHODS = [
  { id: 1, name: 'Standard Shipping', price: 0, code: 'standard' },
  { id: 2, name: 'Subscription Shipping', price: 5, code: 'subscription' },
  {
    id: 3,
    name: 'Expedited: Standard Overnight',
    price: 28,
    code: 'overnight',
  },
];

/** GA4's `shipping_tier` for each method code. */
const SHIPPING_TIER_MAP: Record<string, string> = {
  standard: 'Standard',
  subscription: 'Subscription',
  overnight: 'Express',
};

/** What {@link handlePaymentMethodChange} needs from the checkout form. */
export interface PaymentMethodContext {
  /** Reveals the chosen method's fields and collapses the rest. */
  ui: UIService;
}

/** What {@link handleShippingMethodChange} needs from the checkout form. */
export interface ShippingMethodContext {
  /**
   * Ref, shared with `autofill-detection.ts` and the address router, so
   * `add_shipping_info` is reported once per checkout however the address was completed.
   */
  hasTrackedShippingInfo: { value: boolean };
  logger: Logger;
}

/**
 * Handles a `change` on a payment-method radio.
 *
 * `add_payment_info` is **not** reported here: for a card it fires when the card fields
 * are complete (`CreditCardService`), and for an express method when the button is pressed
 * (`ExpressCheckoutProcessor`).
 *
 * @example
 * ```ts
 * radio.addEventListener('change', event =>
 *   handlePaymentMethodChange({ ui: this.ui }, event)
 * );
 * ```
 */
export function handlePaymentMethodChange(
  ctx: PaymentMethodContext,
  event: Event
): void {
  const target = event.target as HTMLInputElement;
  const checkoutStore = useCheckoutStore.getState();

  const mappedMethod = PAYMENT_METHOD_MAP[target.value] || 'credit-card';
  checkoutStore.setPaymentMethod(mappedMethod as any);

  // Hide any payment-specific errors when switching methods
  const paypalError = document.querySelector(
    '[data-next-component="paypal-error"]'
  );
  if (paypalError instanceof HTMLElement) {
    paypalError.style.display = 'none';
  }

  const creditError = document.querySelector(
    '[data-next-component="credit-error"]'
  );
  if (creditError instanceof HTMLElement) {
    creditError.style.display = 'none';
  }

  ctx.ui.updatePaymentFormVisibility(target.value);

  // Note: For credit card payments, add_payment_info is tracked when card fields are complete (via CreditCardService)
  // For express payments (PayPal, Apple Pay, Google Pay), it's tracked when the button is clicked (via ExpressCheckoutProcessor)
}

/**
 * Handles a `change` on `input[name="shipping_method"]`.
 *
 * A radio whose value is not `1`, `2` or `3` is ignored — nothing is written and nothing
 * is reported.
 *
 * @example
 * ```ts
 * radio.addEventListener('change', event =>
 *   handleShippingMethodChange({ hasTrackedShippingInfo, logger }, event)
 * );
 * ```
 */
export function handleShippingMethodChange(
  ctx: ShippingMethodContext,
  event: Event
): void {
  const target = event.target as HTMLInputElement;
  const checkoutStore = useCheckoutStore.getState();

  const parsedValue = parseInt(target.value);
  if (isNaN(parsedValue)) return;

  const selectedMethod = SHIPPING_METHODS.find(m => m.id === parsedValue);
  if (selectedMethod) {
    checkoutStore.setShippingMethod(selectedMethod);

    void cartOperations.setShippingMethod(selectedMethod.id);

    // Track add_shipping_info event when shipping method is selected
    if (!ctx.hasTrackedShippingInfo.value) {
      try {
        // Map shipping codes to tier names for GA4
        const shippingTier =
          SHIPPING_TIER_MAP[selectedMethod.code] || selectedMethod.name;
        nextAnalytics.track(
          EcommerceEvents.createAddShippingInfoEvent(shippingTier)
        );
        ctx.hasTrackedShippingInfo.value = true;
        ctx.logger.info('Tracked add_shipping_info event', { shippingTier });
      } catch (error) {
        ctx.logger.warn('Failed to track add_shipping_info event:', error);
      }
    }
  }
}
