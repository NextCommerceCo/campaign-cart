import { ORDER_STORAGE_KEY } from '@/core/storage';
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
      ORDER_STORAGE_KEY,
      JSON.stringify({ state: { order: { ref_id: 'abc' } } })
    );
    const show = vi.spyOn(GeneralModal, 'show');
    const ctx = context();

    await handlePurchaseEvent(ctx);

    expect(show).not.toHaveBeenCalled();
  });

  it('warns about an order once per tab', async () => {
    sessionStorage.setItem(ORDER_STORAGE_KEY, storedOrder('abc'));
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
    sessionStorage.setItem(ORDER_STORAGE_KEY, '{not json');
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
    sessionStorage.setItem(ORDER_STORAGE_KEY, storedOrder('abc'));
    modalAnswers('cancel');
    const ctx = context();

    await handlePurchaseEvent(ctx);

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
    sessionStorage.setItem(ORDER_STORAGE_KEY, storedOrder('abc'));
    modalAnswers('confirm');
    const ctx = context();

    await handlePurchaseEvent(ctx);

    expect(window.location.href).toContain('/thank-you/');
    expect(window.location.href).toContain('ref_id=abc');
    expect(ctx.clearAllCheckoutFields).not.toHaveBeenCalled();
  });

  /**
   * Finding 181, fixed: the "already warned" mark is written **before** the modal opens.
   *
   * `handlePurchaseEvent` runs at boot *and* on every bfcache restore, so a shopper who
   * comes back to a checkout that is still showing the warning used to get a second modal
   * stacked on the first: two backdrops, and the page still dimmed after they dismissed
   * one. The second entry now finds the mark already there and returns.
   */
  it('shows one modal however many times it is called for the same order', async () => {
    sessionStorage.setItem(ORDER_STORAGE_KEY, storedOrder('abc'));
    let openModals = 0;
    vi.spyOn(GeneralModal, 'show').mockImplementation(() => {
      openModals += 1;
      return Promise.resolve('cancel');
    });
    const ctx = context();

    await Promise.all([handlePurchaseEvent(ctx), handlePurchaseEvent(ctx)]);

    expect(openModals).toBe(1);
    expect(
      JSON.parse(sessionStorage.getItem('next-shown-order-warnings') ?? '[]')
    ).toEqual(['abc']);
  });

  it('records the order as warned before the shopper has answered', async () => {
    sessionStorage.setItem(ORDER_STORAGE_KEY, storedOrder('abc'));
    let markWhileOpen: string | null = null;
    vi.spyOn(GeneralModal, 'show').mockImplementation(() => {
      markWhileOpen = sessionStorage.getItem('next-shown-order-warnings');
      return Promise.resolve('cancel');
    });

    await handlePurchaseEvent(context());

    expect(JSON.parse(markWhileOpen ?? '[]')).toEqual(['abc']);
  });

  /**
   * Finding 181, fixed: the "Close" branch used to refill the form and then empty it.
   *
   * `populateFormData` is async and was not awaited, so its second half ran *after*
   * `clearAllCheckoutFields` had emptied every box and reset the store — and it wrote back
   * the values it captured before the reset. The previous order's address reappeared in a
   * form that was just cleared.
   *
   * Close means "stay here and start again", so the form is only cleared. Nothing refills
   * it, which is what makes the clearing final.
   */
  it('clears the form on close without refilling it first', async () => {
    sessionStorage.setItem(ORDER_STORAGE_KEY, storedOrder('abc'));
    modalAnswers('cancel');
    const ctx = context();

    await handlePurchaseEvent(ctx);

    expect(ctx.populateFormData).not.toHaveBeenCalled();
    expect(ctx.clearAllCheckoutFields).toHaveBeenCalledTimes(1);
  });
});
