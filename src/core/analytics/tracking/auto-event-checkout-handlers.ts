/**
 * AutoEventListener — checkout domain handlers
 *
 * Order completed (purchase). Checkout-started and express-checkout-started are
 * deliberately NOT wired here: both would fire a second `dl_begin_checkout` on
 * top of the one `CheckoutFormEnhancer` already tracks via
 * `nextAnalytics.track(EcommerceEvents.createBeginCheckoutEvent())`, and a
 * duplicated begin_checkout doubles the top of the funnel in every report.
 */

import { createLogger } from '@/core/logger';
import { dataLayer } from '../data-layer-manager';
import { EcommerceEvents } from '../events/ecommerce-events';
import type { AutoEventListenerContext } from './auto-event-listener.types';
import {
  isAwaitingGatewayPayment,
  purchaseTransactionId,
} from './purchase-tracking';

const logger = createLogger('AutoEventListener');

/**
 * Report a paid order as `dl_purchase`, or explain in the log why it was not
 * reported.
 *
 * `redirecting` is true for the checkout-page paths, where a redirect follows the
 * order within milliseconds: the event is parked in `sessionStorage` and replayed
 * on the next page, because a tag fired against a document that is already
 * navigating away often never gets its request out. It is false on the receipt
 * page, which is where the shopper stays.
 *
 * Unpaid orders are the whole of issue #71 — see `./purchase-tracking`. They are
 * not reported here at all; the receipt page reports them once the gateway has
 * taken the money and sent the shopper back to `success_url?ref_id=…`.
 */
function reportPurchase(order: any, redirecting: boolean): void {
  const transactionId = purchaseTransactionId(order);

  if (isAwaitingGatewayPayment(order)) {
    logger.info(
      `Not tracking purchase for ${transactionId ?? 'unidentified order'}: ` +
        'the order is still awaiting payment at the gateway. It will be tracked ' +
        'when the shopper returns to the success page.'
    );
    return;
  }

  const event = EcommerceEvents.createPurchaseEvent({ order });
  if (!event) return;

  if (redirecting) {
    (event as any)._willRedirect = true;
    logger.debug(
      'Marked purchase event for queueing with _willRedirect = true'
    );
  }

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
  // Order completed.
  //
  // The two events this handles do not deliver the same shape: `order:completed`
  // passes the order itself, while `express-checkout:completed` wraps it as
  // `{ method, order }`. Read as an order, that wrapper has no `number`, no
  // `lines` and no `currency` — so every PayPal / Apple Pay / Google Pay
  // purchase reported a made-up `order_<timestamp>` transaction id in USD with
  // the cart's items. Unwrap first, then hand the order over whole:
  // `createPurchaseEvent` reads its lines, totals, tax basis and currency
  // straight off it, and reads nothing from the cart.
  //
  // Neither event means "the customer paid". `express-checkout:completed` fires
  // when the orders API *accepts* the order, which for PayPal is one redirect
  // before any money moves, and a card order needing 3-D Secure reaches
  // `order:completed` unpaid too. `reportPurchase` is what tells them apart.
  const handleOrderCompleted = (payload: any): void => {
    reportPurchase(payload?.order ?? payload, true);
  };

  // The paid-order path, and the only one express checkout ever takes: the
  // gateway returns the shopper to `success_url?ref_id=…`, the order store loads
  // that order, and it is now a real, paid order with a real order number.
  const handleOrderLoaded = (order: any): void => {
    reportPurchase(order, false);
  };

  ctx.eventBus.on('order:completed', handleOrderCompleted);
  ctx.eventHandlers.set('order:completed', handleOrderCompleted);
  ctx.eventBus.on('express-checkout:completed', handleOrderCompleted);
  ctx.eventHandlers.set('express-checkout:completed', handleOrderCompleted);
  ctx.eventBus.on('order:loaded', handleOrderLoaded);
  ctx.eventHandlers.set('order:loaded', handleOrderLoaded);
}
