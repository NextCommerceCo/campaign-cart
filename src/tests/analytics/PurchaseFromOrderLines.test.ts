import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { EventBus } from '@/core/events';
import { dataLayer } from '@/core/analytics/data-layer-manager';
import { EcommerceEvents } from '@/core/analytics/events/ecommerce-events';
import { setupCheckoutEventListeners } from '@/core/analytics/tracking/auto-event-checkout-handlers';
import type { AutoEventListenerContext } from '@/core/analytics/tracking/auto-event-listener.types';
import type { DataLayerEvent } from '@/core/analytics/types';
import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';

/**
 * Finding 163: `dl_purchase` must report the order the customer actually
 * placed — `order.lines` — and never the pre-order cart snapshot sitting in
 * `useCartStore`. These tests seed a cart that deliberately disagrees with the
 * order, so any leak from the cart shows up as a wrong SKU or a wrong value
 * rather than as a coincidence.
 */

/** Campaign the cart's package belongs to. The ORDER never mentions it. */
function seedCampaign(): void {
  useCampaignStore.setState({
    data: {
      name: 'Drone Campaign',
      packages: [
        {
          ref_id: 3,
          external_id: 13,
          product_sku: 'CART-ONLY-3',
          product_name: 'Cart Only Widget',
          price: '20.00',
          qty: 1,
          name: 'Cart Only Widget x1',
        },
      ],
    },
  } as never);
}

/** A cart that disagrees with every order below: different SKU, different money. */
function seedDisagreeingCart(): void {
  useCartStore.setState({
    items: [{ packageId: 3, quantity: 2, unit_price: '20.00' }],
    vouchers: ['SAVE10'],
    total: new Decimal(40),
    shippingMethod: undefined,
  } as never);
}

/** An order whose lines are NOT what the cart holds — e.g. a coupon reshaped it. */
const COUPON_CHANGED_ORDER = {
  ref_id: 'ord_abc',
  number: 'NX-10428',
  currency: 'EUR',
  total_incl_tax: '38.00',
  total_excl_tax: '30.00',
  total_tax: '3.00',
  total_discounts: '10.00',
  shipping_excl_tax: '5.00',
  shipping_incl_tax: '5.00',
  lines: [
    {
      id: 41207,
      image: 'https://example.test/order-line.png',
      is_upsell: false,
      product_sku: 'ORDER-SKU-1',
      product_title: 'Order Line Widget',
      variant_title: 'Large / Blue',
      quantity: 2,
      price_excl_tax: '30.00', // 15.00/unit after the coupon
      price_excl_tax_excl_discounts: '40.00', // 20.00/unit before it
      price_incl_tax: '33.00',
      price_incl_tax_excl_discounts: '44.00',
    },
  ],
};

/**
 * `createPurchaseEvent` returns `null` for a payload with no order identifier
 * (issue #71). Every order here has one, so a null is a test failure, not a case
 * to handle.
 */
function purchaseEvent(orderData: any): DataLayerEvent {
  const event = EcommerceEvents.createPurchaseEvent(orderData);
  if (!event) throw new Error('expected createPurchaseEvent to build an event');
  return event;
}

describe('dl_purchase reports the order, not the cart (finding 163)', () => {
  beforeEach(() => {
    seedCampaign();
    seedDisagreeingCart();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useCampaignStore.setState({ data: null } as never);
    useCartStore.setState({ items: [], vouchers: [] } as never);
  });

  describe('createPurchaseEvent', () => {
    it('takes items and value from order.lines while the cart says otherwise', () => {
      const event = purchaseEvent({
        order: COUPON_CHANGED_ORDER,
      });
      const ecommerce = event.ecommerce;

      expect(ecommerce?.items).toHaveLength(1);
      expect(ecommerce?.items?.[0]?.item_id).toBe('ORDER-SKU-1');
      // 15.00/unit × 2 = 30.00 — the order's money, not the cart's 40.00.
      expect(ecommerce?.value).toBeCloseTo(30, 2);
      expect(ecommerce?.transaction_id).toBe('NX-10428');
      expect(ecommerce?.currency).toBe('EUR');
    });

    it('carries the per-unit discount the order line records', () => {
      const event = purchaseEvent({
        order: COUPON_CHANGED_ORDER,
      });
      // 40.00 before discounts − 30.00 charged = 10.00 over 2 units = 5.00/unit.
      expect(event.ecommerce?.items?.[0]?.discount).toBeCloseTo(5, 2);
    });

    it('reports the order-wide discount total', () => {
      const event = purchaseEvent({
        order: COUPON_CHANGED_ORDER,
      });
      expect(event.ecommerce?.discount).toBeCloseTo(10, 2);
    });

    it('maps the line variant, SKU and image off the order line', () => {
      const event = purchaseEvent({
        order: COUPON_CHANGED_ORDER,
      });
      const item = event.ecommerce?.items?.[0];
      expect(item?.item_variant).toBe('Large / Blue');
      expect(item?.item_sku).toBe('ORDER-SKU-1');
      expect(item?.item_image).toBe('https://example.test/order-line.png');
    });

    it('reports no items rather than the cart when the order carries no lines', () => {
      const event = purchaseEvent({
        order: {
          number: 'NX-EMPTY',
          currency: 'USD',
          total_incl_tax: '50.00',
          total_tax: '5.00',
          shipping_incl_tax: '5.00',
          lines: [],
        },
      });

      expect(event.ecommerce?.items).toEqual([]);
      // 50 − 5 tax − 5 shipping = 40, from the ORDER's totals.
      expect(event.ecommerce?.value).toBeCloseTo(40, 2);
    });

    it('still honours items handed in explicitly by next.trackPurchase()', () => {
      const event = purchaseEvent({
        order: { number: 'NX-MANUAL', currency: 'USD', lines: [] },
        items: [{ packageId: 3, quantity: 1, unit_price: '11.00' }],
      });

      expect(event.ecommerce?.items).toHaveLength(1);
      expect(event.ecommerce?.value).toBeCloseTo(11, 2);
    });
  });

  describe('handleOrderLoaded', () => {
    let pushed: DataLayerEvent[];
    let ctx: AutoEventListenerContext;

    beforeEach(() => {
      pushed = [];
      vi.spyOn(dataLayer, 'push').mockImplementation((e: DataLayerEvent) => {
        pushed.push(e);
      });

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
    });

    it('reports the order on order:completed', () => {
      EventBus.getInstance().emit(
        'order:completed',
        COUPON_CHANGED_ORDER as never
      );

      expect(pushed).toHaveLength(1);
      const ecommerce = pushed[0]?.ecommerce;
      expect(ecommerce?.transaction_id).toBe('NX-10428');
      expect(ecommerce?.currency).toBe('EUR');
      expect(ecommerce?.items?.[0]?.item_id).toBe('ORDER-SKU-1');
      expect(ecommerce?.value).toBeCloseTo(30, 2);
      expect(ecommerce?.tax).toBeCloseTo(3, 2);
      expect(ecommerce?.shipping).toBeCloseTo(5, 2);
    });

    it('unwraps a { method, order } payload handed to createPurchaseEvent', () => {
      // ExpressCheckoutProcessor emits `{ method, order }`, not the order. Read
      // as an order the wrapper has no number, no lines and no currency, so the
      // event fell back to a `order_<timestamp>` id, USD, and the cart's items
      // (finding 192). That event is no longer wired to purchase reporting, but
      // the unwrap still guards `next.trackPurchase()`, which is handed whatever
      // the caller has — so the check moves to where the logic lives.
      const event = EcommerceEvents.createPurchaseEvent({
        method: 'paypal',
        order: COUPON_CHANGED_ORDER,
      });

      const ecommerce = event?.ecommerce;
      expect(ecommerce?.transaction_id).toBe('NX-10428');
      expect(ecommerce?.transaction_id).not.toMatch(/^order_\d+$/);
      expect(ecommerce?.currency).toBe('EUR');
      expect(ecommerce?.items?.[0]?.item_id).toBe('ORDER-SKU-1');
      expect(ecommerce?.value).toBeCloseTo(30, 2);
    });

    it('reports nothing from the express-checkout event any more', () => {
      // It used to produce a purchase, before the money had moved. The order
      // store's `order:completed` on the landing page is the only producer now —
      // see auto-event-checkout-handlers.ts.
      EventBus.getInstance().emit('express-checkout:completed', {
        method: 'paypal',
        order: COUPON_CHANGED_ORDER,
      } as never);

      expect(pushed).toEqual([]);
    });
  });
});
