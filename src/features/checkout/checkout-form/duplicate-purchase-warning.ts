/**
 * The "you have already paid" warning a shopper sees when they land back on the checkout
 * with a completed order still in the tab.
 *
 * The order the shopper just placed is kept in `sessionStorage` under `next-order` so the
 * receipt and upsell pages can render it. Coming *back* to the checkout — browser back, a
 * bookmarked link, a bfcache restore — therefore looks exactly like a fresh checkout with
 * the previous order still to hand, and paying again would create a second, real order.
 * This module recognises that situation and puts a modal in the way.
 *
 * The shopper has two answers, and they are not symmetric:
 *
 * - **Back** returns them to the order they already placed (the success URL, with the
 *   order's `ref_id` on it), because that is the page they were trying to reach.
 * - **Close** keeps them on the checkout, and the form is emptied — the boxes are still
 *   holding the details of the order that already went through, and leaving them filled
 *   is what makes a duplicate purchase one click away. Nothing refills them afterwards,
 *   which is what makes the emptying stick.
 *
 * Each order is warned about **once per tab**: its `ref_id` is added to
 * `next-shown-order-warnings` **as the modal opens**, so re-entering the checkout does not
 * nag about an order the shopper has already been told about. The mark goes down before
 * the answer, not after, because this runs at boot *and* on every bfcache restore — a
 * shopper returning to a page that is still showing the warning would otherwise get a
 * second modal stacked on the first, with a backdrop left behind when they dismiss one.
 *
 * Extracted from `checkout-form.enhancer.ts` verbatim, bar two deletions: a
 * `modalShownTime` / `timeOnModal` pair that measured how long the modal was up for an
 * analytics call that no longer exists (both were `Date.now()` reads nothing consumed),
 * and the Close path's `populateFormData()` call. It needs three things from the form
 * ({@link DuplicatePurchaseWarningContext}).
 *
 * Both `sessionStorage` keys stay **literals at the call site** rather than becoming named
 * constants: `src/docs/extract` reads the key out of the `sessionStorage.*` call to build
 * `core/guide/reference/storage-keys.md`, so a key behind a constant is a key that page
 * loses — the same trap as a templated `logger` message.
 */

import type { Logger } from '@/core/logger';
import { GeneralModal } from '@/core/ui/general-modal';
import { preserveQueryParams } from '@/core/url-utils';
import { ORDER_STORAGE_KEY, SHOWN_ORDER_WARNINGS_KEY } from '@/core/storage';
import { useCheckoutStore } from '@/state/checkout';

import type { UIService } from '../services/ui-service';
import { getSuccessUrl } from '../utils/url-utils';

/** What this module needs from the checkout form. */
export interface DuplicatePurchaseWarningContext {
  logger: Logger;
  /**
   * The form's UI service, when it has one. Absent only before
   * `initializeUIService` has run, which is why the loading state is cleared behind a
   * check rather than plainly.
   */
  ui: UIService | undefined;
  /** Empties every box and resets the checkout store — `clearAllCheckoutFields`. */
  clearAllCheckoutFields: () => void;
}

/**
 * Shows the duplicate-purchase warning if this tab is holding a completed order.
 *
 * Returns immediately — and silently — when there is no stored order, when the stored
 * order is incomplete, or when this order has already been warned about, so it is safe to
 * call on every entry to the page.
 *
 * @example
 * ```ts
 * // at the end of boot, and again whenever the page is restored from bfcache
 * handlePurchaseEvent({
 *   logger,
 *   ui: this.ui,
 *   clearAllCheckoutFields: () => this.clearAllCheckoutFields(),
 * });
 * ```
 */
export async function handlePurchaseEvent(
  ctx: DuplicatePurchaseWarningContext
): Promise<void> {
  // Check for existing order in sessionStorage
  const orderDataStr = sessionStorage.getItem(ORDER_STORAGE_KEY);
  if (!orderDataStr) return;

  try {
    const orderData = JSON.parse(orderDataStr);
    const order = orderData?.state?.order;

    // Check if we have a valid order
    if (!order?.ref_id || !order?.number) return;

    // Check if we've already shown the modal for this order
    const shownOrdersStr = sessionStorage.getItem(SHOWN_ORDER_WARNINGS_KEY);
    const shownOrders = shownOrdersStr ? JSON.parse(shownOrdersStr) : [];

    if (shownOrders.includes(order.ref_id)) {
      ctx.logger.debug('Already shown warning for order', order.ref_id);
      return;
    }

    ctx.logger.info('Fresh purchase detected, showing attention modal', {
      orderNumber: order.number,
      refId: order.ref_id,
    });

    // Ensure checkout is not in processing state before showing modal
    const checkoutStore = useCheckoutStore.getState();
    checkoutStore.setProcessing(false);

    // Mark this order as shown *before* the modal opens: this runs again on every bfcache
    // restore, and a mark written after the answer lets a second modal stack on the first.
    shownOrders.push(order.ref_id);
    sessionStorage.setItem(
      SHOWN_ORDER_WARNINGS_KEY,
      JSON.stringify(shownOrders)
    );

    const action = await GeneralModal.show({
      title: 'Attention',
      content:
        'Your initial order has been successfully processed. Please check your email for the order confirmation. Entering your payment details again will result in a secondary purchase.',
      buttons: [
        { text: 'Close', action: 'cancel' },
        { text: 'Back', action: 'confirm' },
      ],
      className: 'purchase-warning-modal',
    });

    if (action === 'confirm') {
      // Handle back button - navigate to the success URL
      const successUrl = getSuccessUrl();
      if (successUrl) {
        // Add ref_id to the URL if not already present
        const url = new URL(successUrl, window.location.origin);
        if (!url.searchParams.has('ref_id') && order.ref_id) {
          url.searchParams.set('ref_id', order.ref_id);
        }
        // Preserve all current session parameters
        const finalUrl = preserveQueryParams(url.href);
        window.location.href = finalUrl;
      }
    } else {
      // User clicked 'Close' — they stay on the checkout and start again, so the form is
      // emptied and nothing puts the finished order's details back into it.

      // Ensure UI is in correct state
      if (ctx.ui) {
        ctx.ui.hideLoading('checkout');
      }

      // Clear all form fields and reset checkout state
      ctx.clearAllCheckoutFields();
    }
  } catch (error) {
    ctx.logger.error('Failed to parse order data from sessionStorage:', error);
    // Ensure we're not stuck in processing state
    const checkoutStore = useCheckoutStore.getState();
    checkoutStore.setProcessing(false);
  }
}
