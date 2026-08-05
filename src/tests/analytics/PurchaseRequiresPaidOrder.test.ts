import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/core/events';
import { dataLayer } from '@/core/analytics/data-layer-manager';
import { EcommerceEvents } from '@/core/analytics/events/ecommerce-events';
import { setupCheckoutEventListeners } from '@/core/analytics/tracking/auto-event-checkout-handlers';
import { pendingEventsHandler } from '@/core/analytics/tracking/pending-events-handler';
import { resetReportedPurchases } from '@/core/analytics/tracking/purchase-tracking';
import type { AutoEventListenerContext } from '@/core/analytics/tracking/auto-event-listener.types';
import type { DataLayerEvent } from '@/core/analytics/types';

/**
 * Issue #71: `dl_purchase` fired for orders nobody had paid for.
 *
 * `ExpressCheckoutProcessor` emits `express-checkout:completed` the moment the
 * orders API accepts a PayPal order — one redirect *before* the customer pays —
 * and the event was then parked in sessionStorage and replayed on the next SDK
 * page in the session. Pressing back from PayPal, or landing on
 * `payment_failed_url`, therefore reported a purchase that never happened; a
 * merchant's affiliate network approved six payouts against it.
 *
 * These tests read `window.NextDataLayer` rather than a mocked `dataLayer.push`,
 * because the once-per-order rule lives inside `push` — it has to, so that an
 * event replayed from the queue after the redirect is deduped too.
 */

/** A PayPal order as the API returns it: created, unpaid, gateway URL attached. */
const AWAITING_PAYPAL = {
  ref_id: 'ord_pending',
  number: 'NX-PENDING',
  currency: 'USD',
  total_incl_tax: '49.99',
  total_tax: '0',
  shipping_incl_tax: '0',
  payment_complete_url: 'https://paypal.test/checkout?token=EC-42',
  lines: [
    {
      package: 3,
      product_sku: 'DRONE-3',
      product_title: 'Drone Hawk',
      price_excl_tax: '49.99',
      price_incl_tax: '49.99',
      quantity: 1,
    },
  ],
};

/** The same order after PayPal took the money and the receipt page loaded it. */
const PAID = {
  ...AWAITING_PAYPAL,
  payment_complete_url: undefined,
  order_status_url: 'https://shop.test/status/ord_pending',
};

const purchases = (): DataLayerEvent[] =>
  window.NextDataLayer.filter(e => e.event === 'dl_purchase');

describe('dl_purchase requires a paid order (issue #71)', () => {
  let ctx: AutoEventListenerContext;

  beforeEach(() => {
    window.NextDataLayer = [];
    resetReportedPurchases();
    pendingEventsHandler.clearPendingEvents();

    ctx = {
      eventBus: EventBus.getInstance(),
      eventHandlers: new Map(),
      shouldProcessEvent: () => true,
      waitForCartCalculation: async () => {},
    };
    setupCheckoutEventListeners(ctx);
  });

  afterEach(() => {
    for (const [name, handler] of ctx.eventHandlers) {
      EventBus.getInstance().off(name as never, handler);
    }
    resetReportedPurchases();
    pendingEventsHandler.clearPendingEvents();
  });

  it('reports nothing when the shopper leaves for the gateway and comes back unpaid', () => {
    EventBus.getInstance().emit('express-checkout:completed', {
      method: 'paypal',
      order: AWAITING_PAYPAL,
    } as never);

    // Nothing on the checkout page…
    expect(purchases()).toHaveLength(0);

    // …and nothing parked for the next page either. This second assertion is the
    // one that catches the bug: the old code queued the event instead of pushing
    // it, so it left the checkout page clean and fired on whatever page the
    // shopper reached next — pressing back from PayPal, in the report.
    pendingEventsHandler.processPendingEvents();
    expect(purchases()).toHaveLength(0);
  });

  it('reports the purchase once the gateway returns and the order loads', () => {
    EventBus.getInstance().emit('order:loaded', PAID as never);

    expect(purchases()).toHaveLength(1);
    expect(purchases()[0]?.ecommerce?.transaction_id).toBe('NX-PENDING');
  });

  it('reports the same order only once across both emission paths', () => {
    // The full card journey: the order is charged on the checkout page, so its
    // event is queued for after the redirect; the receipt page then loads the
    // same order and reports it; then the queue replays. One purchase.
    EventBus.getInstance().emit('order:completed', PAID as never);
    EventBus.getInstance().emit('order:loaded', PAID as never);
    pendingEventsHandler.processPendingEvents();
    EventBus.getInstance().emit('order:loaded', PAID as never);

    expect(purchases()).toHaveLength(1);
  });

  it('drops a queued purchase whose order was already reported', () => {
    // What the pending-events queue does after a redirect: the identical event,
    // pushed a second time on the next page.
    const event = EcommerceEvents.createPurchaseEvent({ order: PAID });
    if (!event) throw new Error('expected a dl_purchase event');

    dataLayer.push(event);
    dataLayer.push({ ...event });

    expect(purchases()).toHaveLength(1);
  });

  it('does not report a card order still waiting on 3-D Secure', () => {
    // Same gate, different method: `order:completed` fires for a card order
    // whose payment needs another step, and that order is not paid either.
    EventBus.getInstance().emit('order:completed', {
      ...PAID,
      number: 'NX-3DS',
      payment_complete_url: 'https://acs.bank.test/3ds?tx=1',
    } as never);

    // Replayed like test one: an unpaid order must not be reported on the page
    // the shopper lands on after the bank, whichever page that is.
    pendingEventsHandler.processPendingEvents();
    expect(purchases()).toHaveLength(0);
  });

  it('emits no event at all for a payload with no order identifier', () => {
    expect(
      EcommerceEvents.createPurchaseEvent({ order: { currency: 'USD' } })
    ).toBeNull();

    EventBus.getInstance().emit('order:loaded', { currency: 'USD' } as never);
    expect(purchases()).toHaveLength(0);
  });
});
