import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EcommerceEvents, nextAnalytics } from '@/core/analytics/index';
import { useCampaignStore } from '@/state/campaign';
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
 * The shipping half is answered entirely by the campaign: which ids exist, what each one
 * is called, and what it costs. Every test here therefore starts by saying what the
 * campaign offers, and the ids deliberately are not 1, 2 and 3 — the three the SDK used
 * to hard-code (finding 180).
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
  logger: ReturnType<typeof createMockLogger>;
} {
  return {
    ui: { updatePaymentFormVisibility: vi.fn() },
    logger: createMockLogger(),
  } as never;
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

/** The shipping methods this campaign offers, as the API returns them. */
function campaignOffers(
  methods: Array<{ ref_id: number; code: string; price: string }>
): void {
  useCampaignStore.setState({ data: { shipping_methods: methods } } as never);
}

beforeEach(() => {
  campaignOffers([
    { ref_id: 7, code: 'standard', price: '0.00' },
    { ref_id: 12, code: 'overnight', price: '12.50' },
    { ref_id: 19, code: 'pickup', price: '3.00' },
  ]);
  // Every test starts with no method chosen, so "the store still holds nothing" is a
  // statement about the handler rather than about what ran before it.
  useCheckoutStore.setState({ shippingMethod: undefined });
});

afterEach(() => {
  document.body.innerHTML = '';
  useCheckoutStore.getState().reset();
  useCampaignStore.setState({ data: null } as never);
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

  it.each([
    ['ideal', 'ideal'],
    ['bancontact', 'bancontact'],
    ['twint', 'twint'],
    ['swish', 'swish'],
    ['affirm', 'affirm'],
    ['link', 'link'],
    ['sepa-direct', 'sepa_direct'],
    // What this SDK's own type called SEPA until 2026-08-14.
    ['sepa-debit', 'sepa_direct'],
  ])(
    'keeps the redirect method the shopper picked: %s',
    (radioValue, stored) => {
      handlePaymentMethodChange(paymentContext(), radioEvent(radioValue));

      expect(useCheckoutStore.getState().paymentMethod).toBe(stored);
    }
  );

  it('reads a method the same whichever separator the markup uses', () => {
    handlePaymentMethodChange(paymentContext(), radioEvent('APPLE_PAY'));

    expect(useCheckoutStore.getState().paymentMethod).toBe('apple_pay');
  });

  it('keeps a method it does not know, so the API is the one that decides', () => {
    // A store can be given a new way to pay before this SDK release knows its
    // name. Substituting a card would end the checkout at "Payment token is
    // required" without ever asking the API — issue #74's failure exactly.
    const ctx = paymentContext();

    handlePaymentMethodChange(ctx, radioEvent('Pix'));

    expect(useCheckoutStore.getState().paymentMethod).toBe('pix');
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Pix')
    );
  });

  it('selects nothing for a radio with no value', () => {
    useCheckoutStore.setState({ paymentMethod: 'ideal' });

    handlePaymentMethodChange(paymentContext(), radioEvent(''));

    expect(useCheckoutStore.getState().paymentMethod).toBe('ideal');
  });

  it('does not warn about a method it does offer', () => {
    const ctx = paymentContext();

    handlePaymentMethodChange(ctx, radioEvent('ideal'));

    expect(ctx.logger.warn).not.toHaveBeenCalled();
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
  it('writes the campaign’s method to the checkout store and to the cart', () => {
    const setShipping = vi
      .spyOn(cartOperations, 'setShippingMethod')
      .mockResolvedValue(undefined);
    vi.spyOn(nextAnalytics, 'track').mockImplementation(() => {});

    handleShippingMethodChange(shippingContext(), radioEvent('12'));

    expect(useCheckoutStore.getState().shippingMethod).toEqual({
      id: 12,
      name: 'overnight',
      price: 12.5,
      code: 'overnight',
    });
    expect(setShipping).toHaveBeenCalledWith(12);
  });

  it('stores the campaign’s price, so a summary shows what the order will charge', () => {
    vi.spyOn(cartOperations, 'setShippingMethod').mockResolvedValue(undefined);
    vi.spyOn(nextAnalytics, 'track').mockImplementation(() => {});
    campaignOffers([{ ref_id: 12, code: 'overnight', price: '28.00' }]);

    handleShippingMethodChange(shippingContext(), radioEvent('12'));

    expect(useCheckoutStore.getState().shippingMethod?.price).toBe(28);
  });

  it('reports add_shipping_info once, with the GA4 tier name', () => {
    vi.spyOn(cartOperations, 'setShippingMethod').mockResolvedValue(undefined);
    const track = vi.spyOn(nextAnalytics, 'track').mockImplementation(() => {});
    const tier = vi.spyOn(EcommerceEvents, 'createAddShippingInfoEvent');
    const ctx = shippingContext();

    handleShippingMethodChange(ctx, radioEvent('12'));
    handleShippingMethodChange(ctx, radioEvent('7'));

    expect(tier).toHaveBeenCalledExactlyOnceWith('Express');
    expect(track).toHaveBeenCalledTimes(1);
    expect(ctx.hasTrackedShippingInfo.value).toBe(true);
  });

  it('reports a code GA4 has no tier name for as itself', () => {
    vi.spyOn(cartOperations, 'setShippingMethod').mockResolvedValue(undefined);
    vi.spyOn(nextAnalytics, 'track').mockImplementation(() => {});
    const tier = vi.spyOn(EcommerceEvents, 'createAddShippingInfoEvent');

    handleShippingMethodChange(shippingContext(), radioEvent('19'));

    expect(tier).toHaveBeenCalledExactlyOnceWith('pickup');
  });

  it('ignores a radio whose value is not a number', () => {
    const setShipping = vi
      .spyOn(cartOperations, 'setShippingMethod')
      .mockResolvedValue(undefined);

    handleShippingMethodChange(shippingContext(), radioEvent('free'));

    expect(setShipping).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().shippingMethod).toBeUndefined();
  });

  /**
   * Finding 180, fixed: the methods come from the campaign, so an id the campaign does
   * not list is a markup or configuration mistake — not a method to select.
   *
   * It is refused rather than written, because writing it would put a `ref_id` on the
   * order that the campaign cannot price, and the warning names the ids that do exist so
   * the mistake is one console line to diagnose.
   */
  it('refuses an id the campaign does not list, and says which ids it has', () => {
    const setShipping = vi
      .spyOn(cartOperations, 'setShippingMethod')
      .mockResolvedValue(undefined);
    const ctx = shippingContext();

    handleShippingMethodChange(ctx, radioEvent('3'));

    expect(setShipping).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().shippingMethod).toBeUndefined();
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      'Shipping method 3 is not one this campaign offers',
      { availableIds: [7, 12, 19] }
    );
  });

  it('refuses every id while the campaign has not loaded', () => {
    const setShipping = vi
      .spyOn(cartOperations, 'setShippingMethod')
      .mockResolvedValue(undefined);
    useCampaignStore.setState({ data: null } as never);
    const ctx = shippingContext();

    handleShippingMethodChange(ctx, radioEvent('12'));

    expect(setShipping).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      'Shipping method 12 is not one this campaign offers',
      { availableIds: [] }
    );
  });
});
