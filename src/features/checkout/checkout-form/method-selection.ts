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
 * `apple-pay`…); the store's is close to the API's (`credit-card`, `paypal`, `apple_pay`…),
 * so every value goes through {@link toCheckoutPaymentMethod} — which is also what the
 * startup pass reads, so the two cannot disagree about what a radio means. A name the SDK
 * does not know is warned about and then kept, because the API, not this table, decides
 * what can be charged. Any payment error still on the page is hidden — it belonged to the
 * method they just moved away from.
 *
 * **Shipping method.** The radio's value is a shipping method's `ref_id`, and **the
 * campaign says which ids exist, what each is called and what it costs** — the SDK holds
 * no shipping table of its own. The choice goes to the checkout store *and* to the cart,
 * because the cart is what recalculates the totals, and both are written from the same
 * campaign entry so a summary can never quote a price the order will not charge. An id
 * the campaign does not list is refused with a warning rather than written.
 * `add_shipping_info` is reported the first time a method is chosen and never again.
 *
 * Extracted from `checkout-form.enhancer.ts` verbatim; the shipping half has since had
 * finding 180 fixed in it — it read a hard-coded table of three ids and two invented
 * prices. Payment needs one thing from the form ({@link PaymentMethodContext}), shipping
 * two ({@link ShippingMethodContext}).
 */

import { nextAnalytics, EcommerceEvents } from '@/core/analytics/index';
import type { Logger } from '@/core/logger';
import { useCampaignStore } from '@/state/campaign';
import { cartOperations } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';

import {
  isKnownPaymentMethod,
  toCheckoutPaymentMethod,
} from '../constants/field-mappings';
import type { UIService } from '../services/ui-service';

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
  /** Reports a radio value the SDK has no payment method for. */
  logger: Logger;
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
 * A method the SDK does not know by name is **kept**, not replaced: it is stored as the
 * page wrote it and sent to the API, which is the only thing that can say whether it can
 * charge that way. Replacing it with a card is what issue #74 was — the store held
 * `credit-card` for a shopper who chose iDEAL, and the order was then refused for having
 * no card token, so no order existed to redirect with. The warning is there because the
 * likelier cause is a typo in the markup, and a shopper meeting an API error is a slow way
 * to find that out.
 *
 * A radio with no value at all selects nothing — there is no method to send.
 *
 * @example
 * ```ts
 * radio.addEventListener('change', event =>
 *   handlePaymentMethodChange({ ui: this.ui, logger: this.logger }, event)
 * );
 * ```
 */
export function handlePaymentMethodChange(
  ctx: PaymentMethodContext,
  event: Event
): void {
  const target = event.target as HTMLInputElement;
  const checkoutStore = useCheckoutStore.getState();

  const mappedMethod = toCheckoutPaymentMethod(target.value);
  if (mappedMethod && !isKnownPaymentMethod(mappedMethod)) {
    ctx.logger.warn(
      `Payment method "${target.value}" is not one the SDK knows — sending it to the API as it stands`
    );
  }
  if (mappedMethod) checkoutStore.setPaymentMethod(mappedMethod);

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
 * The radio's value is a `ref_id` from the campaign's `shipping_methods`, and the method
 * written to the store is that campaign entry: its `code` is both the name and the code,
 * its `price` is the price. A value that is not a number, or a `ref_id` this campaign does
 * not offer, selects nothing and is warned about — the campaign cannot price it, so
 * putting it on the order would be a charge nobody agreed to.
 *
 * @example
 * ```ts
 * // campaign: shipping_methods: [{ ref_id: 12, code: 'overnight', price: '12.50' }]
 * radio.addEventListener('change', event =>
 *   handleShippingMethodChange({ hasTrackedShippingInfo, logger }, event)
 * );
 * // radio value "12" → checkout store { id: 12, name: 'overnight', price: 12.5, … }
 * ```
 */
export function handleShippingMethodChange(
  ctx: ShippingMethodContext,
  event: Event
): void {
  const target = event.target as HTMLInputElement;
  const checkoutStore = useCheckoutStore.getState();

  const methodId = parseInt(target.value, 10);
  if (isNaN(methodId)) return;

  const campaignMethods =
    useCampaignStore.getState().data?.shipping_methods ?? [];
  const campaignMethod = campaignMethods.find(m => m.ref_id === methodId);

  if (!campaignMethod) {
    ctx.logger.warn(
      `Shipping method ${methodId} is not one this campaign offers`,
      { availableIds: campaignMethods.map(m => m.ref_id) }
    );
    return;
  }

  const price = parseFloat(campaignMethod.price ?? '0');
  const selectedMethod = {
    id: campaignMethod.ref_id,
    // The campaign carries no display name for a shipping method, so the code is the
    // name everywhere — `cartOperations.setShippingMethod` and the order builder do the
    // same, and the cart is what the totals come from.
    name: campaignMethod.code,
    price: isNaN(price) ? 0 : price,
    code: campaignMethod.code,
  };

  checkoutStore.setShippingMethod(selectedMethod);

  void cartOperations.setShippingMethod(selectedMethod.id);

  // Track add_shipping_info event when shipping method is selected
  if (!ctx.hasTrackedShippingInfo.value) {
    try {
      // Map shipping codes to tier names for GA4
      const shippingTier =
        SHIPPING_TIER_MAP[selectedMethod.code] ?? selectedMethod.code;
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
