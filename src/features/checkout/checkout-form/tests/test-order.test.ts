import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';

import {
  handleKonamiActivation,
  handleTestDataFilled,
  type KonamiTestOrderContext,
  type TestDataFillContext,
} from '../test-order';

/**
 * The two developer shortcuts, and what they do to a live page.
 *
 * The Konami path is worth pinning carefully because it is available on any page carrying
 * a checkout form, with no test-mode flag, and it places a **real** order — see
 * `core/guide/subsystems/test-mode.md`.
 *
 * Three tests are marked `DEFECT:` and pin behaviour left exactly as found.
 */

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function fillContext(
  fields: Map<string, HTMLElement> = new Map()
): TestDataFillContext & {
  ui: { updateLabelsForPopulatedData: ReturnType<typeof vi.fn> };
  populateFormData: ReturnType<typeof vi.fn>;
} {
  return {
    fields,
    ui: { updateLabelsForPopulatedData: vi.fn() },
    populateFormData: vi.fn(),
  } as never;
}

function konamiContext(
  overrides: Partial<KonamiTestOrderContext> = {}
): KonamiTestOrderContext & {
  logger: ReturnType<typeof createMockLogger>;
  createTestOrder: ReturnType<typeof vi.fn>;
  handleOrderRedirect: ReturnType<typeof vi.fn>;
  populateFormData: ReturnType<typeof vi.fn>;
} {
  return {
    validator: { clearAllErrors: vi.fn() },
    logger: createMockLogger(),
    populateFormData: vi.fn(),
    createTestOrder: vi.fn().mockResolvedValue({ ref_id: 'test-1' }),
    handleOrderRedirect: vi.fn(),
    ...overrides,
  } as never;
}

function activation(method: string): Event {
  return new CustomEvent('next:test-mode-activated', { detail: { method } });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  document.body.innerHTML = '';
  useCheckoutStore.getState().reset();
  useCartStore.getState().reset();
});

describe('handleTestDataFilled', () => {
  it('refills the boxes and tells every field it changed', () => {
    const input = document.createElement('input');
    const changed = vi.fn();
    input.addEventListener('change', changed);
    const ctx = fillContext(new Map([['email', input]]));

    handleTestDataFilled(ctx);
    expect(ctx.populateFormData).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);

    expect(ctx.populateFormData).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(ctx.ui.updateLabelsForPopulatedData).toHaveBeenCalledTimes(1);
  });
});

describe('handleKonamiActivation', () => {
  it('ignores an activation that did not come from the Konami code', async () => {
    const ctx = konamiContext();

    await handleKonamiActivation(ctx, activation('url-parameter'));
    vi.advanceTimersByTime(2000);

    expect(ctx.createTestOrder).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().paymentToken).toBeUndefined();
  });

  it('fills the store with the test checkout and pays with the test card', async () => {
    const ctx = konamiContext();

    await handleKonamiActivation(ctx, activation('konami'));

    const checkout = useCheckoutStore.getState();
    expect(checkout.formData.email).toBe('test@test.com');
    expect(checkout.formData.postal).toBe('85281');
    expect(checkout.paymentMethod).toBe('credit-card');
    expect(checkout.paymentToken).toBe('test_card');
    expect(checkout.sameAsShipping).toBe(true);
    expect(ctx.populateFormData).toHaveBeenCalledTimes(1);
  });

  it('creates the order a second later and redirects like any other', async () => {
    const ctx = konamiContext();

    await handleKonamiActivation(ctx, activation('konami'));
    expect(ctx.createTestOrder).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(ctx.createTestOrder).toHaveBeenCalledTimes(1);
    // Redirect only. A test order goes through the same door as a real one, and
    // that door emits nothing: `order:completed` comes from the order store on the
    // page the redirect lands on (issue #71). The context has no `emit` to call.
    expect(ctx.handleOrderRedirect).toHaveBeenCalledWith({ ref_id: 'test-1' });
    expect('emit' in ctx).toBe(false);
  });

  it('falls back to the campaign’s first shipping method when nothing is chosen yet', async () => {
    useCampaignStore.setState({
      data: {
        shipping_methods: [
          { ref_id: 42, code: 'campaign-standard', price: '9.99' },
        ],
      },
    } as never);
    // Neither the cart nor the checkout has a method — the only state in which the
    // campaign is consulted at all.
    useCheckoutStore.setState({ shippingMethod: undefined });

    await handleKonamiActivation(konamiContext(), activation('konami'));

    expect(useCheckoutStore.getState().shippingMethod).toEqual({
      id: 42,
      name: 'campaign-standard',
      price: 9.99,
      code: 'campaign-standard',
    });
  });

  /**
   * The campaign lookup used to be all but unreachable: `checkoutStore.reset()` merged an
   * initial state with no `shippingMethod` key, so the previously chosen method survived
   * the reset and whatever was set first won for the rest of the tab.
   *
   * `initialState` now names every field, so a reset really does clear the method and the
   * campaign's own first method is what a test order after it ships on.
   */
  it('takes the campaign’s method after a reset has cleared the stale one', async () => {
    useCampaignStore.setState({
      data: {
        shipping_methods: [
          { ref_id: 42, code: 'campaign-standard', price: '9.99' },
        ],
      },
    } as never);
    useCheckoutStore.setState({
      shippingMethod: { id: 3, name: 'stale', price: 28, code: 'overnight' },
    });
    useCheckoutStore.getState().reset();

    await handleKonamiActivation(konamiContext(), activation('konami'));

    expect(useCheckoutStore.getState().shippingMethod?.id).toBe(42);
  });

  it('reports a failed test order rather than throwing into the timer', async () => {
    const ctx = konamiContext({
      createTestOrder: vi.fn().mockRejectedValue(new Error('gateway down')),
    });

    await handleKonamiActivation(ctx, activation('konami'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(ctx.logger.error).toHaveBeenCalledWith(
      'Failed to create test order:',
      expect.anything()
    );
    expect(ctx.handleOrderRedirect).not.toHaveBeenCalled();
  });

  /**
   * DEFECT (left as found): the one-second wait before the order is a bare `setTimeout`
   * that nothing holds a handle to.
   *
   * `CheckoutFormEnhancer.destroy()` clears the `begin_checkout` delay and the billing
   * timers, but it cannot reach this one — so a form destroyed inside that second still
   * creates a real order, emits `order:completed`, and redirects the browser away from
   * whatever replaced it. The 150 ms timer in {@link handleTestDataFilled} is the same
   * shape.
   */
  it('DEFECT: nothing can cancel the pending test order', async () => {
    const ctx = konamiContext();

    await handleKonamiActivation(ctx, activation('konami'));
    // There is no returned handle and nothing in the context to clear.
    await vi.advanceTimersByTimeAsync(1000);

    expect(ctx.createTestOrder).toHaveBeenCalledTimes(1);
  });

  /**
   * DEFECT (left as found): the Konami path writes a fixed US address over whatever the
   * shopper had typed, and never puts it back.
   *
   * On a live page — no test mode required — the code is ten keystrokes away from
   * replacing a real visitor's address and email with `test@test.com` in Tempe, AZ, and
   * then placing an order on it.
   */
  it('DEFECT: it overwrites a real shopper’s details on a live page', async () => {
    useCheckoutStore.getState().updateFormData({
      email: 'real.shopper@example.com',
      city: 'Bristol',
    });

    await handleKonamiActivation(konamiContext(), activation('konami'));

    expect(useCheckoutStore.getState().formData.email).toBe('test@test.com');
    expect(useCheckoutStore.getState().formData.city).toBe('Tempe');
  });
});
