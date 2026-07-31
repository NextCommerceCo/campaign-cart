import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dataLayer } from '@/core/analytics/DataLayerManager';
import { EcommerceEvents } from '@/core/analytics/events/EcommerceEvents';
import { useCampaignStore } from '@/state/campaign';
import type { CampaignStore } from '@/state/campaign';
import type { DataLayerEvent } from '@/core/analytics/types';

/**
 * Finding 46: a 100%-discount order has `ecommerce.value === 0` — item revenue
 * is genuinely zero, and `EcommerceEvents.createPurchaseEvent` computes this
 * correctly (see GA4EcommerceCompliance.test.ts). But
 * `DataLayerManager.validateEvent` tested required fields with a falsy check
 * (`!value`), so `0` was treated the same as "missing" and the whole
 * `dl_purchase` event was dropped before it ever reached `window.NextDataLayer`
 * — silently, with no error surfaced anywhere. A free order was therefore
 * invisible to every analytics destination. This test exercises the real
 * `dataLayer` singleton end-to-end (push -> validateEvent -> NextDataLayer),
 * not just a validator function in isolation.
 */
describe('a 100%-discount order still produces a dl_purchase event (finding 46)', () => {
  const lastPushed = (): DataLayerEvent =>
    window.NextDataLayer[window.NextDataLayer.length - 1];

  beforeEach(() => {
    window.NextDataLayer = [];
    useCampaignStore.setState({ data: null } as Partial<CampaignStore>);
  });

  afterEach(() => {
    useCampaignStore.setState({ data: null } as Partial<CampaignStore>);
  });

  it('reaches window.NextDataLayer with a correct zero-value payload', () => {
    const order = {
      number: 'ORD-FREE-1',
      currency: 'USD',
      total_incl_tax: '0',
      total_tax: '0',
      shipping_incl_tax: '0',
      lines: [
        {
          package: 3,
          product_sku: 'DRONE-3',
          product_title: 'Drone Hawk',
          price_excl_tax: '0', // 100% discount — genuinely free
          price_incl_tax: '0',
          quantity: 1,
        },
      ],
    };

    const event = EcommerceEvents.createPurchaseEvent({ order });
    // Sanity check: the event itself is correctly zero (not the bug).
    expect(event.ecommerce?.value).toBe(0);

    dataLayer.push(event);

    const pushed = lastPushed();
    expect(
      pushed,
      'dl_purchase with value 0 must reach window.NextDataLayer'
    ).toBeDefined();
    expect(pushed.event).toBe('dl_purchase');
    expect(pushed.ecommerce?.value).toBe(0);
    expect(pushed.ecommerce?.transaction_id).toBe('ORD-FREE-1');
    expect(pushed.ecommerce?.currency).toBe('USD');
    expect(pushed.ecommerce?.items).toHaveLength(1);
    expect(pushed.ecommerce?.items?.[0]?.item_id).toBe('DRONE-3');
  });

  it('also reaches the data layer for a zero-value upsell purchase', () => {
    const upsellPurchase: DataLayerEvent = {
      event: 'dl_upsell_purchase',
      ecommerce: {
        currency: 'USD',
        transaction_id: 'ORD-FREE-1-US1',
        value: 0,
        items: [
          { item_id: 'SKU-1', item_name: 'Upsell', price: 0, quantity: 1 },
        ],
      },
    };
    dataLayer.push(upsellPurchase);

    const pushed = lastPushed();
    expect(
      pushed,
      'dl_upsell_purchase with value 0 must reach window.NextDataLayer'
    ).toBeDefined();
    expect(pushed.event).toBe('dl_upsell_purchase');
    expect(pushed.ecommerce?.value).toBe(0);
  });
});
