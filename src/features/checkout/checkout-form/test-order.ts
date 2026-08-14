/**
 * The two developer shortcuts that fill the checkout without anyone typing: the debug
 * panel's "fill test data" button, and the Konami code that fills the form *and* places a
 * real test order.
 *
 * Both arrive as `document` events rather than clicks on the form, because the thing that
 * raises them is the debug UI, not the checkout:
 *
 * - `checkout:test-data-filled` — the panel has written values into the store, so the
 *   boxes are refilled from it and each one is given a `change` so the rest of the form
 *   reacts as if a shopper had typed it;
 * - `next:test-mode-activated` with `detail.method === 'konami'` — a whole checkout is
 *   assembled in the store (a fixed Arizona address, the `test_card` token, billing same
 *   as shipping, whatever shipping method is already on the cart) and an order is created
 *   a second later.
 *
 * **The Konami order is a real order.** It goes to the same endpoint with the same cart,
 * emits `order:completed`, and redirects like any other — which also empties the cart. It
 * is `test_card` that keeps it from taking money. It is available on any page carrying a
 * checkout form, with no test-mode flag needed; see
 * [`core/guide/subsystems/test-mode.md`](../../../core/guide/subsystems/test-mode.md).
 *
 * Extracted from `checkout-form.enhancer.ts` verbatim. Filling needs three things from the
 * form ({@link TestDataFillContext}), the Konami path six
 * ({@link KonamiTestOrderContext}).
 */

import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';
import type { Logger } from '@/core/logger';

import type { CheckoutValidator } from '../validation/checkout-validator';
import type { UIService } from '../services/ui-service';

/** Lets the debug panel finish writing the store before the boxes are refilled. */
const FILL_DELAY_MS = 150;
/** Lets the filled form settle — phone reformatting, province loading — before ordering. */
const ORDER_DELAY_MS = 1000;

/** The address a Konami order is placed with. Not a real customer. */
const TEST_FORM_DATA = {
  email: 'test@test.com',
  fname: 'Test',
  lname: 'Order',
  phone: '+14807581224',
  address1: 'Test Address 123',
  address2: '',
  city: 'Tempe',
  province: 'AZ',
  postal: '85281',
  country: 'US',
  accepts_marketing: true,
};

/** The shipping method used when neither the cart nor the campaign offers one. */
const FALLBACK_SHIPPING_METHOD = {
  id: 1,
  name: 'Standard Shipping',
  price: 0,
  code: 'standard',
};

/** What {@link handleTestDataFilled} needs from the checkout form. */
export interface TestDataFillContext {
  /** The scanned shipping fields, each of which is given a synthetic `change`. */
  fields: Map<string, HTMLElement>;
  /** Floats the labels of the boxes the fill just filled. */
  ui: UIService;
  /** Puts the stored checkout data back into the boxes — `populateFormData`. */
  populateFormData: () => void;
}

/** What {@link handleKonamiActivation} needs from the checkout form. */
export interface KonamiTestOrderContext {
  /** Cleared before the test data is written, so no stale message survives the fill. */
  validator: CheckoutValidator;
  logger: Logger;
  /** Puts the stored checkout data back into the boxes — `populateFormData`. */
  populateFormData: () => void;
  /** Builds and submits the test order — `CheckoutFormEnhancer.createTestOrder`. */
  createTestOrder: () => Promise<any>;
  /** Sends the browser onward exactly as a real order does. */
  handleOrderRedirect: (order: any) => void;
}

/**
 * Handles `checkout:test-data-filled` — refills the boxes from the store and tells the
 * rest of the form about it.
 *
 * @example
 * ```ts
 * document.addEventListener('checkout:test-data-filled', () =>
 *   handleTestDataFilled({ fields, ui, populateFormData })
 * );
 * ```
 */
export function handleTestDataFilled(ctx: TestDataFillContext): void {
  setTimeout(() => {
    ctx.populateFormData();

    ctx.fields.forEach(field => {
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement
      ) {
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Update UI for test data
    ctx.ui.updateLabelsForPopulatedData();
  }, FILL_DELAY_MS);
}

/**
 * Handles `next:test-mode-activated` — and does nothing unless the activation came from
 * the Konami code, so another activation method cannot place an order by accident.
 *
 * @example
 * ```ts
 * document.addEventListener('next:test-mode-activated', event =>
 *   handleKonamiActivation(this.konamiTestOrderContext(), event)
 * );
 * ```
 */
export async function handleKonamiActivation(
  ctx: KonamiTestOrderContext,
  event: Event
): Promise<void> {
  const checkoutStore = useCheckoutStore.getState();

  const customEvent = event as CustomEvent;
  const activationMethod = customEvent.detail?.method;

  if (activationMethod !== 'konami') return;

  try {
    checkoutStore.clearAllErrors();
    ctx.validator.clearAllErrors();
    checkoutStore.updateFormData(TEST_FORM_DATA);
    checkoutStore.setPaymentMethod('credit-card');
    checkoutStore.setPaymentToken('test_card');
    checkoutStore.setSameAsShipping(true);
    // Use existing shipping method from cart if available
    const cartStore = useCartStore.getState();
    const cartShipping = cartStore.shippingMethod;
    const existingShipping = cartShipping
      ? {
          id: cartShipping.id,
          name: cartShipping.name,
          price: cartShipping.price.toNumber(),
          code: cartShipping.code,
        }
      : checkoutStore.shippingMethod;
    if (existingShipping) {
      checkoutStore.setShippingMethod(existingShipping);
    } else {
      // Fallback to first available from campaign
      const campaignStore = useCampaignStore.getState();
      if (
        campaignStore.data?.shipping_methods &&
        campaignStore.data.shipping_methods.length > 0
      ) {
        const firstMethod = campaignStore.data.shipping_methods[0];
        if (firstMethod) {
          checkoutStore.setShippingMethod({
            id: firstMethod.ref_id,
            name: firstMethod.code,
            price: parseFloat(firstMethod.price || '0'),
            code: firstMethod.code,
          });
        }
      } else {
        // Last resort fallback
        checkoutStore.setShippingMethod(FALLBACK_SHIPPING_METHOD);
      }
    }

    ctx.populateFormData();

    setTimeout(async () => {
      try {
        const order = await ctx.createTestOrder();
        // Same as a real order: nothing is emitted here. The landing page fetches
        // the order back and the order store emits `order:completed` there.
        ctx.handleOrderRedirect(order);
      } catch (error) {
        ctx.logger.error('Failed to create test order:', error);
      }
    }, ORDER_DELAY_MS);
  } catch (error) {
    ctx.logger.error('Error filling test data for Konami order:', error);
  }
}
