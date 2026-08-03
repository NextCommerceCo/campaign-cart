import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GeneralModal } from '@/core/ui/general-modal';
import { useCheckoutStore } from '@/state/checkout';

import {
  handlePurchaseEvent,
  type DuplicatePurchaseWarningContext,
} from '../duplicate-purchase-warning';

/**
 * The warning that stands between a shopper who has already paid and a second charge.
 *
 * Everything here turns on one stored object: `next-order` in `sessionStorage`. It is
 * written when an order completes and read by the receipt and upsell pages, so coming back
 * to the checkout in the same tab always looks like "a fresh checkout with a completed
 * order to hand".
 *
 * Two tests are marked `DEFECT:` and pin behaviour left exactly as found.
 */

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function storedOrder(refId: string, number = 'ORD-1'): string {
  return JSON.stringify({ state: { order: { ref_id: refId, number } } });
}

function context(): DuplicatePurchaseWarningContext & {
  logger: ReturnType<typeof createMockLogger>;
  populateFormData: ReturnType<typeof vi.fn>;
  clearAllCheckoutFields: ReturnType<typeof vi.fn>;
  ui: { hideLoading: ReturnType<typeof vi.fn> };
} {
  return {
    logger: createMockLogger(),
    ui: { hideLoading: vi.fn() },
    populateFormData: vi.fn(),
    clearAllCheckoutFields: vi.fn(),
  } as never;
}

/** Resolves the modal with `action` on the next tick, as a real button press would. */
function modalAnswers(action: 'cancel' | 'confirm'): void {
  vi.spyOn(GeneralModal, 'show').mockResolvedValue(action);
}

let originalLocation: PropertyDescriptor | undefined;

beforeEach(() => {
  originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: 'https://shop.example/checkout/',
      origin: 'https://shop.example',
      search: '',
    },
  });
  sessionStorage.clear();
});

afterEach(() => {
  if (originalLocation)
    Object.defineProperty(window, 'location', originalLocation);
  sessionStorage.clear();
  document.head.innerHTML = '';
  useCheckoutStore.getState().reset();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('handlePurchaseEvent — when it stays out of the way', () => {
  it('does nothing when the tab holds no order', async () => {
    const show = vi.spyOn(GeneralModal, 'show');
    const ctx = context();

    await handlePurchaseEvent(ctx);

    expect(show).not.toHaveBeenCalled();
    expect(ctx.clearAllCheckoutFields).not.toHaveBeenCalled();
  });

  it('does nothing when the stored order has no number yet', async () => {
    sessionStorage.setItem(
      'next-order',
      JSON.stringify({ state: { order: { ref_id: 'abc' } } })
    );
    const show = vi.spyOn(GeneralModal, 'show');
    const ctx = context();

    await handlePurchaseEvent(ctx);

    expect(show).not.toHaveBeenCalled();
  });

  it('warns about an order once per tab', async () => {
    sessionStorage.setItem('next-order', storedOrder('abc'));
    sessionStorage.setItem(
      'next-shown-order-warnings',
      JSON.stringify(['abc'])
    );
    const show = vi.spyOn(GeneralModal, 'show');
    const ctx = context();

    await handlePurchaseEvent(ctx);

    expect(show).not.toHaveBeenCalled();
    expect(ctx.logger.debug).toHaveBeenCalledWith(
      'Already shown warning for order',
      'abc'
    );
  });

  it('logs and clears processing when the stored order is not JSON', async () => {
    sessionStorage.setItem('next-order', '{not json');
    useCheckoutStore.setState({ isProcessing: true });
    const ctx = context();

    await handlePurchaseEvent(ctx);

    expect(ctx.logger.error).toHaveBeenCalledWith(
      'Failed to parse order data from sessionStorage:',
      expect.anything()
    );
    expect(useCheckoutStore.getState().isProcessing).toBe(false);
  });
});

describe('handlePurchaseEvent — the two answers', () => {
  it('empties the form when the shopper closes the warning', async () => {
    sessionStorage.setItem('next-order', storedOrder('abc'));
    modalAnswers('cancel');
    const ctx = context();

    await handlePurchaseEvent(ctx);

    expect(ctx.populateFormData).toHaveBeenCalledTimes(1);
    expect(ctx.ui.hideLoading).toHaveBeenCalledWith('checkout');
    expect(ctx.clearAllCheckoutFields).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(sessionStorage.getItem('next-shown-order-warnings') ?? '[]')
    ).toEqual(['abc']);
  });

  it('sends the shopper to the order they already placed, with its ref_id', async () => {
    const meta = document.createElement('meta');
    meta.name = 'next-success-url';
    meta.content = '/thank-you/';
    document.head.appendChild(meta);
    sessionStorage.setItem('next-order', storedOrder('abc'));
    modalAnswers('confirm');
    const ctx = context();

    await handlePurchaseEvent(ctx);

    expect(window.location.href).toContain('/thank-you/');
    expect(window.location.href).toContain('ref_id=abc');
    expect(ctx.clearAllCheckoutFields).not.toHaveBeenCalled();
  });

  /**
   * DEFECT (left as found): the "already warned" mark is written **after** the shopper
   * answers, and nothing guards a second entry while the modal is open.
   *
   * `handlePurchaseEvent` runs at boot *and* on every bfcache restore, so a shopper who
   * comes back to a checkout that is still showing the warning gets a second modal stacked
   * on the first: two backdrops, and the page still dimmed after they dismiss one.
   */
  it('DEFECT: two calls while the modal is open show two modals', async () => {
    sessionStorage.setItem('next-order', storedOrder('abc'));
    let openModals = 0;
    vi.spyOn(GeneralModal, 'show').mockImplementation(async () => {
      openModals += 1;
      return 'cancel';
    });
    const ctx = context();

    await Promise.all([handlePurchaseEvent(ctx), handlePurchaseEvent(ctx)]);

    expect(openModals).toBe(2);
    // …and the order is recorded twice, because both calls read the list before either
    // wrote it.
    expect(
      JSON.parse(sessionStorage.getItem('next-shown-order-warnings') ?? '[]')
    ).toEqual(['abc']);
  });

  /**
   * DEFECT (left as found): the "Close" branch refills the form and then empties it.
   *
   * `populateFormData` is async and is not awaited, so its second half runs *after*
   * `clearAllCheckoutFields` has emptied every box and reset the store — and it writes
   * back the values it captured before the reset. On a form whose stored country differs
   * from the detected one (the path that awaits the province list) the shopper watches the
   * previous order's address reappear in a form that was just cleared.
   *
   * The call order below is what the test can observe; the race itself is in
   * `form-population.ts`, which captures `formData` on entry.
   */
  it('DEFECT: the close path populates the form and then clears it', async () => {
    sessionStorage.setItem('next-order', storedOrder('abc'));
    modalAnswers('cancel');
    const calls: string[] = [];
    const ctx = context();
    ctx.populateFormData = vi.fn(() => calls.push('populate')) as never;
    ctx.clearAllCheckoutFields = vi.fn(() => calls.push('clear')) as never;

    await handlePurchaseEvent(ctx);

    expect(calls).toEqual(['populate', 'clear']);
  });
});
