import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCheckoutStore } from '@/state/checkout';

import * as animation from '../billing-animation';
import {
  handleBillingAddressToggle,
  type BillingToggleContext,
} from '../billing-toggle';

/**
 * The checkbox that decides whether the order carries a separate billing address.
 *
 * The animation is stubbed here — it has its own test — so what is being pinned is the
 * decision layer: which direction the section is sent, what reaches the checkout store,
 * and what a click landing mid-animation does.
 *
 * One test is marked `DEFECT:` and pins a timer nobody can cancel, left as found.
 */

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function context(
  overrides: Partial<BillingToggleContext> = {}
): BillingToggleContext & { logger: ReturnType<typeof createMockLogger> } {
  const logger = createMockLogger();
  return {
    animationInProgress: { value: false },
    debounceTimer: {},
    animation: {
      inProgress: { value: false },
      timeouts: new Set(),
      listenerAbort: { value: null },
      logger,
    },
    billingFields: new Map<string, HTMLElement>(),
    logger,
    ...overrides,
  } as never;
}

/** A ticked or unticked checkbox, already dispatched, as the handler receives it. */
function toggleEvent(checked: boolean): Event {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'use_shipping_address';
  input.checked = checked;
  document.body.appendChild(input);
  const event = new Event('change', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: input });
  return event;
}

function billingSection(): HTMLElement {
  const section = document.createElement('div');
  section.setAttribute('data-next-component', 'different-billing-address');
  document.body.appendChild(section);
  return section;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(animation, 'expandBillingForm').mockImplementation(() => {});
  vi.spyOn(animation, 'collapseBillingForm').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  useCheckoutStore.getState().reset();
});

describe('handleBillingAddressToggle', () => {
  it('collapses the section and records "same as shipping" when ticked', () => {
    const section = billingSection();
    const ctx = context();

    handleBillingAddressToggle(ctx, toggleEvent(true));
    vi.advanceTimersByTime(10);

    expect(animation.collapseBillingForm).toHaveBeenCalledWith(
      ctx.animation,
      section
    );
    expect(animation.expandBillingForm).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().sameAsShipping).toBe(true);
  });

  it('expands the section, seeds the billing country and empties the rest', () => {
    billingSection();
    useCheckoutStore.getState().updateFormData({ country: 'CA' });
    const countrySelect = document.createElement('select');
    countrySelect.innerHTML = '<option value="CA">Canada</option>';
    const changes = vi.fn();
    countrySelect.addEventListener('change', changes);
    const ctx = context({
      billingFields: new Map([['billing-country', countrySelect]]),
    });

    handleBillingAddressToggle(ctx, toggleEvent(false));
    vi.advanceTimersByTime(10);
    expect(animation.expandBillingForm).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    expect(countrySelect.value).toBe('CA');
    expect(changes).toHaveBeenCalledTimes(1);
    expect(useCheckoutStore.getState().billingAddress).toEqual({
      first_name: '',
      last_name: '',
      address1: '',
      address2: '',
      city: '',
      province: '',
      postal: '',
      country: 'CA',
      phone: '',
    });
  });

  it('finds a section written with the legacy os-checkout-element spelling', () => {
    const section = document.createElement('div');
    section.setAttribute('os-checkout-element', 'different-billing-address');
    document.body.appendChild(section);

    handleBillingAddressToggle(context(), toggleEvent(true));
    vi.advanceTimersByTime(10);

    expect(animation.collapseBillingForm).toHaveBeenCalledWith(
      expect.anything(),
      section
    );
  });

  it('reports a page with no billing section instead of animating nothing', () => {
    const ctx = context();

    handleBillingAddressToggle(ctx, toggleEvent(false));
    vi.advanceTimersByTime(10);

    expect(ctx.logger.error).toHaveBeenCalledWith(
      '[Billing] CRITICAL: Billing section not found!'
    );
    expect(animation.expandBillingForm).not.toHaveBeenCalled();
  });

  it('refuses a click that lands mid-animation and puts the box back', () => {
    billingSection();
    const ctx = context({ animationInProgress: { value: true } });
    const event = toggleEvent(true);

    handleBillingAddressToggle(ctx, event);
    vi.advanceTimersByTime(100);

    expect((event.target as HTMLInputElement).checked).toBe(false);
    expect(animation.collapseBillingForm).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      '[Billing] Click blocked - animation in progress'
    );
  });

  it('debounces a double-click into one animation', () => {
    billingSection();
    const ctx = context();

    handleBillingAddressToggle(ctx, toggleEvent(false));
    handleBillingAddressToggle(ctx, toggleEvent(false));
    vi.advanceTimersByTime(10);

    expect(animation.expandBillingForm).toHaveBeenCalledTimes(1);
  });

  /**
   * DEFECT (left as found): the 50 ms timer that seeds the billing country is not tracked
   * anywhere, so nothing can cancel it.
   *
   * `destroy()` clears the 10 ms debounce and the animation's own fallback timers, but
   * this one is a bare `setTimeout` — a form torn down in that window still writes
   * `billingAddress` into the checkout store and still dispatches a `change` on a detached
   * `<select>`. On a page that swaps the checkout out (a step change, an SPA route) that
   * is a store write from a form the shopper can no longer see.
   */
  it('DEFECT: the billing-country timer survives everything the form can cancel', () => {
    billingSection();
    const ctx = context();

    handleBillingAddressToggle(ctx, toggleEvent(false));
    vi.advanceTimersByTime(10);

    // Everything teardown can reach: the debounce handle and the animation's timers.
    if (ctx.debounceTimer.value) clearTimeout(ctx.debounceTimer.value);
    ctx.animation.timeouts.forEach(timeout => clearTimeout(timeout));

    vi.advanceTimersByTime(50);

    expect(useCheckoutStore.getState().billingAddress).toBeDefined();
  });
});
