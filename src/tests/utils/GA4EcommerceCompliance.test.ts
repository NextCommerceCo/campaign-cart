import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { EcommerceEvents } from '@/utils/analytics/events/EcommerceEvents';
import { EventBuilder } from '@/utils/analytics/events/EventBuilder';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCartStore } from '@/stores/cartStore';

// GA4 recommended-events compliance regressions:
// - view_item must carry `value` alongside `currency`.
// - items must expose GA4 `discount` (per-unit) when a discount applies.

/** Campaign with one package: catalog 14.00/unit, retail 20.00/unit. */
function seedCampaign(): void {
  useCampaignStore.setState({
    data: {
      name: 'Drone Hawk',
      packages: [
        {
          ref_id: 3,
          external_id: 13,
          product_sku: 'DRONE-3',
          product_name: 'Drone Hawk',
          product_id: 100,
          product_variant_id: 200,
          product_variant_name: 'Standard',
          price: '14.00',
          price_retail: '20.00',
          qty: 1,
          name: 'Drone Hawk x1',
        },
      ],
    },
  } as never);
}

describe('GA4 ecommerce compliance', () => {
  beforeEach(() => {
    seedCampaign();
  });

  describe('purchase', () => {
    it('reports value as item revenue (excl tax + shipping), not the grand total', () => {
      const order = {
        number: 'ORD-100',
        currency: 'USD',
        total_incl_tax: '115', // grand total = 100 items + 10 tax + 5 shipping
        total_tax: '10',
        shipping_incl_tax: '5',
        lines: [
          {
            package: 3,
            product_sku: 'DRONE-3',
            product_title: 'Drone Hawk',
            price_excl_tax: '100', // line total excl tax, qty 2 → 50/unit
            price_incl_tax: '110',
            quantity: 2,
          },
        ],
      };

      const event = EcommerceEvents.createPurchaseEvent({
        order,
      }) as unknown as {
        ecommerce: {
          value: number;
          tax: number;
          shipping: number;
          items: any[];
        };
      };

      // value = Σ(price × quantity) = 50 × 2 = 100, NOT the 115 grand total.
      expect(event.ecommerce.value).toBeCloseTo(100, 2);
      expect(event.ecommerce.tax).toBeCloseTo(10, 2);
      expect(event.ecommerce.shipping).toBeCloseTo(5, 2);
      // Per-unit price is excl tax (matches the cart's pre-tax basis).
      expect(event.ecommerce.items[0].price).toBeCloseTo(50, 2);
      expect(event.ecommerce.items[0].quantity).toBe(2);
    });

    it('uses the incl-tax basis for a tax-INCLUSIVE (VAT) store', () => {
      // Campaign catalog price is the VAT-inclusive 60.00 the customer saw.
      useCampaignStore.setState({
        data: {
          name: 'Drone Hawk',
          packages: [{ ref_id: 3, price: '60.00', product_sku: 'DRONE-3' }],
        },
      } as never);

      const order = {
        number: 'ORD-200',
        currency: 'EUR',
        total_incl_tax: '125', // 120 items (incl VAT) + 5 shipping
        total_tax: '20',
        shipping_incl_tax: '5',
        shipping_excl_tax: '5',
        lines: [
          {
            package: 3,
            product_sku: 'DRONE-3',
            product_title: 'Drone Hawk',
            quantity: 2,
            // PRE-discount: incl (120 = 60×2) matches catalog → inclusive store.
            price_incl_tax_excl_discounts: '120',
            price_excl_tax_excl_discounts: '100',
            price_incl_tax: '120',
            price_excl_tax: '100',
          },
        ],
      };

      const event = EcommerceEvents.createPurchaseEvent({
        order,
      }) as unknown as {
        ecommerce: { value: number; items: any[] };
      };

      // VAT store: value uses the incl-tax displayed price → 60 × 2 = 120.
      expect(event.ecommerce.value).toBeCloseTo(120, 2);
      expect(event.ecommerce.items[0].price).toBeCloseTo(60, 2);
    });
  });

  describe('view_item', () => {
    it('includes value (item revenue) alongside currency', () => {
      const event = EcommerceEvents.createViewItemEvent({
        packageId: 3,
        quantity: 1,
        unit_price: '14.00',
      }) as unknown as { ecommerce: { value: number; items: any[] } };

      expect(event.ecommerce.value).toBeCloseTo(14, 2);
      // value reconciles with price × quantity of the single item.
      const item = event.ecommerce.items[0];
      expect(event.ecommerce.value).toBeCloseTo(item.price * item.quantity, 2);
    });
  });

  describe('add_shipping_info — shipping cost', () => {
    it('includes the selected shipping method price', () => {
      useCartStore.setState({
        items: [{ packageId: 3, quantity: 1, unit_price: '14.00' }],
        vouchers: [],
        total: new Decimal(19),
        shippingMethod: {
          id: 1,
          name: 'Ground',
          code: 'ground',
          originalPrice: new Decimal(5),
          price: new Decimal(5),
          discountAmount: new Decimal(0),
          discountPercentage: new Decimal(0),
        },
      } as never);

      const event = EcommerceEvents.createAddShippingInfoEvent(
        'Ground'
      ) as unknown as { ecommerce: { value: number; shipping: number } };

      expect(event.ecommerce.shipping).toBeCloseTo(5, 2);
      // value stays item revenue (excludes shipping) so totals reconcile.
      expect(event.ecommerce.value).toBeCloseTo(14, 2);
    });

    it('omits shipping when no method is selected', () => {
      useCartStore.setState({
        items: [{ packageId: 3, quantity: 1, unit_price: '14.00' }],
        vouchers: [],
        total: new Decimal(14),
        shippingMethod: undefined,
      } as never);

      const event = EcommerceEvents.createAddShippingInfoEvent() as unknown as {
        ecommerce: { shipping?: number };
      };
      expect(event.ecommerce.shipping).toBeUndefined();
    });
  });

  describe('formatEcommerceItem — discount', () => {
    it('sets per-unit discount from retail vs final price', () => {
      const item = EventBuilder.formatEcommerceItem({
        packageId: 3,
        quantity: 1,
        unit_price: '14.00',
      });
      // retail 20.00 − sold 14.00 = 6.00 per unit.
      expect(item.discount).toBeCloseTo(6, 2);
    });

    it('prefers the offer discount (original_unit_price) when present', () => {
      const item = EventBuilder.formatEcommerceItem({
        packageId: 3,
        quantity: 1,
        unit_price: '14.00',
        original_unit_price: '18.00',
      });
      // 18.00 original − 14.00 sold = 4.00 per unit.
      expect(item.discount).toBeCloseTo(4, 2);
    });

    it('omits discount when the item is sold at full price', () => {
      useCampaignStore.setState({
        data: {
          name: 'Drone Hawk',
          packages: [
            {
              ref_id: 9,
              external_id: 19,
              product_sku: 'NODISC-9',
              product_name: 'Full Price',
              price: '14.00',
              qty: 1,
              name: 'Full Price x1',
            },
          ],
        },
      } as never);

      const item = EventBuilder.formatEcommerceItem({
        packageId: 9,
        quantity: 1,
        unit_price: '14.00',
      });
      expect(item.discount).toBeUndefined();
    });
  });
});
