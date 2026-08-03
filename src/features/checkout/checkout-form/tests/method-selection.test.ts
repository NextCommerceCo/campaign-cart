import { afterEach, describe, expect, it, vi } from 'vitest';

import { EcommerceEvents, nextAnalytics } from '@/core/analytics/index';
import { cartOperations } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';

import {
  handlePaymentMethodChange,
  handleShippingMethodChange,
  type PaymentMethodContext,
  type ShippingMethodContext,
} from '../method-selection';

/**
 * The two radio groups: how the shopper pays, and how the order ships.
 *
 * Two tests are marked `DEFECT:` and pin behaviour left exactly as found — both are about
 * the shipping table being hard-coded in the SDK rather than read from the campaign.
 */

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** A radio carrying `value`, already dispatched, as the handler receives it. */
function radioEvent(value: string): Event {
  const input = document.createElement('input');
  input.type = 'radio';
  input.value = value;
  document.body.appendChild(input);
  const event = new Event('change', { bubbles: true });
  Object.defineProperty(event, 'target', { value: input });
  return event;
}

function paymentContext(): PaymentMethodContext & {
  ui: { updatePaymentFormVisibility: ReturnType<typeof vi.fn> };
} {
  return { ui: { updatePaymentFormVisibility: vi.fn() } } as never;
}

function shippingContext(): ShippingMethodContext & {
  logger: ReturnType<typeof createMockLogger>;
} {
  return {
    hasTrackedShippingInfo: { value: false },
    logger: createMockLogger(),
  } as never;
}

function errorBanner(component: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-next-component', component);
  el.style.display = 'flex';
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  useCheckoutStore.getState().reset();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('handlePaymentMethodChange', () => {
  it('translates the page’s word for the method into the API’s', () => {
    const ctx = paymentContext();

    handlePaymentMethodChange(ctx, radioEvent('apple-pay'));

    expect(useCheckoutStore.getState().paymentMethod).toBe('apple_pay');
    expect(ctx.ui.updatePaymentFormVisibility).toHaveBeenCalledWith(
      'apple-pay'
    );
  });

  it('falls back to the card form for a value it does not recognise', () => {
    handlePaymentMethodChange(paymentContext(), radioEvent('bitcoin'));

    expect(useCheckoutStore.getState().paymentMethod).toBe('credit-card');
  });

  it('hides the errors belonging to the method being left', () => {
    const paypal = errorBanner('paypal-error');
    const credit = errorBanner('credit-error');

    handlePaymentMethodChange(paymentContext(), radioEvent('credit'));

    expect(paypal.style.display).toBe('none');
    expect(credit.style.display).toBe('none');
  });
});

describe('handleShippingMethodChange', () => {
  it('writes the choice to the checkout store and to the cart', () => {
    const setShipping = vi
      .spyOn(cartOperations, 'setShippingMethod')
      .mockResolvedValue(undefined);
    vi.spyOn(nextAnalytics, 'track').mockImplementation(() => {});

    handleShippingMethodChange(shippingContext(), radioEvent('2'));

    expect(useCheckoutStore.getState().shippingMethod).toEqual({
      id: 2,
      name: 'Subscription Shipping',
      price: 5,
      code: 'subscription',
    });
    expect(setShipping).toHaveBeenCalledWith(2);
  });

  it('reports add_shipping_info once, with the GA4 tier name', () => {
    vi.spyOn(cartOperations, 'setShippingMethod').mockResolvedValue(undefined);
    const track = vi.spyOn(nextAnalytics, 'track').mockImplementation(() => {});
    const tier = vi.spyOn(EcommerceEvents, 'createAddShippingInfoEvent');
    const ctx = shippingContext();

    handleShippingMethodChange(ctx, radioEvent('3'));
    handleShippingMethodChange(ctx, radioEvent('1'));

    expect(tier).toHaveBeenCalledExactlyOnceWith('Express');
    expect(track).toHaveBeenCalledTimes(1);
    expect(ctx.hasTrackedShippingInfo.value).toBe(true);
  });

  it('ignores a radio whose value is not a number', () => {
    const setShipping = vi
      .spyOn(cartOperations, 'setShippingMethod')
      .mockResolvedValue(undefined);

    handleShippingMethodChange(shippingContext(), radioEvent('free'));

    expect(setShipping).not.toHaveBeenCalled();
    // The store keeps whatever it already held — its default first method.
    expect(useCheckoutStore.getState().shippingMethod?.id).toBe(1);
  });

  /**
   * DEFECT (left as found): the three shipping methods are hard-coded here, keyed by
   * `ref_id` 1, 2 and 3.
   *
   * A campaign whose shipping methods have any other `ref_id` — which is every campaign
   * beyond the first few — gets a radio group where clicking a method does nothing at all:
   * no store write, no cart recalculation, no log. The shopper picks "Express", the total
   * does not move, and the order is placed on whatever method was already set.
   */
  it('DEFECT: a shipping method whose id is not 1, 2 or 3 is silently ignored', () => {
    const setShipping = vi
      .spyOn(cartOperations, 'setShippingMethod')
      .mockResolvedValue(undefined);
    const ctx = shippingContext();

    handleShippingMethodChange(ctx, radioEvent('7'));

    expect(setShipping).not.toHaveBeenCalled();
    // Still on whatever was already selected, with nothing said about it.
    expect(useCheckoutStore.getState().shippingMethod?.id).toBe(1);
    expect(ctx.logger.warn).not.toHaveBeenCalled();
  });

  /**
   * DEFECT (left as found): the prices in that table are hard-coded too.
   *
   * Method 2 is stored at $5 and method 3 at $28 whatever the campaign charges, so a
   * checkout summary reading `checkoutStore.shippingMethod.price` can show a shipping cost
   * the order will not be charged. The cart is corrected — `cartOperations.setShippingMethod`
   * looks the real one up — but the checkout store keeps the invented figure.
   */
  it('DEFECT: the stored price is the SDK’s constant, not the campaign’s', () => {
    vi.spyOn(cartOperations, 'setShippingMethod').mockResolvedValue(undefined);
    vi.spyOn(nextAnalytics, 'track').mockImplementation(() => {});

    handleShippingMethodChange(shippingContext(), radioEvent('3'));

    expect(useCheckoutStore.getState().shippingMethod?.price).toBe(28);
  });
});
