import { describe, it, expect, beforeEach } from 'vitest';
import { EcommerceEvents } from '@/utils/analytics/events/EcommerceEvents';
import { useCampaignStore } from '@/stores/campaignStore';

// Regression tests for issue #54: accepted-upsell GTM dataLayer event
// (dl_upsell_purchase) for bundle-path upsells reported quantity 1 and an
// unresolved package (item_id "undefined", package_id "0"), with item.price
// set to the full multi-unit total instead of the per-unit price.

/** Campaign with a single drone package priced at 14.00 per unit. */
function seedCampaign(): void {
  useCampaignStore.setState({
    data: {
      name: 'Drone Hawk - Using Offers',
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
          qty: 1,
          name: 'Drone Hawk x1',
        },
      ],
    },
  } as never);
}

/** Build the accepted-upsell event the way AutoEventListener does. */
function buildEvent(packageId: number, quantity: number, value: number) {
  const event = EcommerceEvents.createAcceptedUpsellEvent({
    orderId: 'ORD1',
    packageId,
    quantity,
    value,
    currency: 'CAD',
    upsellNumber: 1,
    item: { packageId, quantity, price: value },
  }) as unknown as {
    ecommerce: { value: number; items: any[] };
    upsell_metadata: { package_id: string; package_name: string };
  };
  return event;
}

describe('createAcceptedUpsellEvent — bundle path (issue #54)', () => {
  beforeEach(() => {
    seedCampaign();
  });

  it('resolves the real package instead of "undefined" / "0"', () => {
    const { ecommerce, upsell_metadata } = buildEvent(3, 3, 42);
    const item = ecommerce.items[0];

    expect(item.item_id).toBe('DRONE-3');
    expect(item.item_id).not.toBe('undefined');
    expect(item.item_name).toBe('Drone Hawk');
    expect(upsell_metadata.package_id).toBe('3');
    expect(upsell_metadata.package_name).not.toBe('Package 0');
  });

  it('reports the accepted quantity, not 1, with a per-unit price', () => {
    const { ecommerce } = buildEvent(3, 3, 42);
    const item = ecommerce.items[0];

    expect(item.quantity).toBe(3);
    expect(item.price).toBe(14); // 42 / 3
    expect(item.price * item.quantity).toBe(ecommerce.value);
  });

  it('keeps revenue correct (no double-count) and equal to the line total', () => {
    const { ecommerce } = buildEvent(3, 3, 42);
    expect(ecommerce.value).toBe(42);
  });

  it('derives per-unit price from the order delta for discounted bundles', () => {
    // tier-cards case: 3 units charged 25.2 total -> 8.4 per unit (discounted),
    // which differs from the 14.00 campaign list price.
    const { ecommerce } = buildEvent(3, 3, 25.2);
    const item = ecommerce.items[0];

    expect(ecommerce.value).toBe(25.2);
    expect(item.quantity).toBe(3);
    expect(item.price).toBeCloseTo(8.4, 5);
    expect(item.price * item.quantity).toBeCloseTo(ecommerce.value, 5);
  });
});
