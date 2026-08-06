/**
 * AutoEventListener — checkout domain handlers
 *
 * One subscription, `order:loaded`, which is what raises `dl_purchase`. The
 * reasoning for why the checkout page's own events are not wired here is on
 * {@link setupCheckoutEventListeners}.
 *
 * Checkout-started and express-checkout-started are deliberately not wired
 * either: both would fire a second `dl_begin_checkout` on top of the one
 * `CheckoutFormEnhancer` already tracks via
 * `nextAnalytics.track(EcommerceEvents.createBeginCheckoutEvent())`, and a
 * duplicated begin_checkout doubles the top of the funnel in every report.
 */

import { createLogger } from '@/core/logger';
import { dataLayer } from '../data-layer-manager';
import { EcommerceEvents } from '../events/ecommerce-events';
import type { AutoEventListenerContext } from './auto-event-listener.types';
import {
  isAwaitingGatewayPayment,
  isPaymentFailureLanding,
  purchaseTransactionId,
} from './purchase-tracking';

const logger = createLogger('AutoEventListener');

/**
 * Report a paid order as `dl_purchase`, or explain in the log why it was not
 * reported.
 *
 * Called from one place only — the page the shopper lands on after checkout, once
 * it has fetched its order. Nothing here is queued for a later page: this page is
 * where the shopper stays, so the tag has time to get its request out.
 *
 * Unpaid orders are the whole of issue #71 — see `./purchase-tracking`. An order
 * still holding a `payment_complete_url` is not reported however it got here, and
 * neither is one whose page is the failure leg of a redirect payment.
 */
function reportPurchase(order: any): void {
  const transactionId = purchaseTransactionId(order);

  if (isAwaitingGatewayPayment(order)) {
    logger.info(
      `Not tracking purchase for ${transactionId ?? 'unidentified order'}: ` +
        'the order is still awaiting payment at the gateway. It will be tracked ' +
        'when the shopper returns to the success page.'
    );
    return;
  }

  if (isPaymentFailureLanding()) {
    logger.info(
      `Not tracking purchase for ${transactionId ?? 'unidentified order'}: ` +
        'this page is where a failed payment lands, not the success page.'
    );
    return;
  }

  const event = EcommerceEvents.createPurchaseEvent({ order });
  if (!event) return;

  dataLayer.push(event);
  // Log the id that shipped, so a mismatch with the order number is visible
  // here rather than only in the analytics report.
  logger.info('Tracked purchase:', event.ecommerce?.transaction_id);
}

/**
 * Set up checkout event listeners
 */
export function setupCheckoutEventListeners(
  ctx: AutoEventListenerContext
): void {
  // `order:loaded` is the ONLY producer of an automatic `dl_purchase`. It fires
  // when a page opened with `?ref_id=` has fetched its order back from the orders
  // API — the first moment the SDK holds an order the API calls finished.
  //
  // `order:completed` and `express-checkout:completed` are deliberately not wired
  // here, though both used to be. Neither means the customer paid: the orders API
  // fires them when it *accepts* the order, which for PayPal is one redirect
  // before any money moves, and a card order needing 3-D Secure gets there unpaid
  // too. That is issue #71. Gating them on "is it paid" would have been enough to
  // stop the phantom purchases, but keeping them bought nothing:
  //
  // - **They are redundant when they work.** The SDK builds its own success URL
  //   and appends `ref_id` to it (`getNextPageUrlFromMeta`), as do both fallbacks
  //   (`order_status_url`, `/checkout/confirmation/?ref_id=`). So the page the
  //   shopper lands on fetches the order and `order:loaded` reports it anyway.
  // - **They do not help when they fail.** An event raised as the page navigates
  //   away is parked in `sessionStorage` and replayed on the *next SDK page*,
  //   whatever page that is — the arbitrary-page replay that produced #71 — and
  //   dropped entirely after five minutes.
  // - **Two producers cost a race.** Both reached the success page and the dedupe
  //   discarded whichever arrived second, so the payload that shipped depended on
  //   which won: the checkout-page copy could read the cart, the success-page copy
  //   could not.
  //
  // The one case this gives up: an order whose success page never boots the SDK
  // (a merchant redirecting to the platform's own `order_status_url`) now reports
  // nothing, where before it reported late, on a page that was not the success
  // page. A conversion missing is easier to notice, and to trust, than one dated
  // wrong.
  const handleOrderLoaded = (order: any): void => {
    reportPurchase(order);
  };

  ctx.eventBus.on('order:loaded', handleOrderLoaded);
  ctx.eventHandlers.set('order:loaded', handleOrderLoaded);
}
