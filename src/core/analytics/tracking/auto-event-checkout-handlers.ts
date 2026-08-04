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

const logger = createLogger('AutoEventListener');

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
  const handleOrderCompleted = (payload: any): void => {
    const order = payload?.order ?? payload;

    const event = EcommerceEvents.createPurchaseEvent({ order });

    // Purchase events ALWAYS redirect to confirmation/upsell pages
    (event as any)._willRedirect = true;
    logger.debug(
      'Marked purchase event for queueing with _willRedirect = true'
    );

    dataLayer.push(event);
    // Log the id that shipped, so a mismatch with the order number is visible
    // here rather than only in the analytics report.
    logger.info('Tracked purchase:', event.ecommerce?.transaction_id);
  };

  ctx.eventBus.on('order:completed', handleOrderCompleted);
  ctx.eventHandlers.set('order:completed', handleOrderCompleted);
  ctx.eventBus.on('express-checkout:completed', handleOrderCompleted);
  ctx.eventHandlers.set('express-checkout:completed', handleOrderCompleted);
}
