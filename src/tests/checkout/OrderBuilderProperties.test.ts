import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderBuilder } from '@/features/checkout/builders/order-builder';
import { useAttributionStore } from '@/state/attribution';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/features/checkout/utils/url-utils', () => ({
  getSuccessUrl: () => 'https://example.com/success',
  getFailureUrl: () => 'https://example.com/failed',
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Record<string, any> = {}) {
  return {
    packageId: 42,
    quantity: 2,
    is_upsell: false,
    ...overrides,
  };
}

/** Minimal checkout form data that satisfies buildOrder without error. */
const minimalFormData: Record<string, any> = {
  email: 'buyer@example.com',
  fname: 'Test',
  lname: 'User',
  address1: '123 Main St',
  city: 'Springfield',
  country: 'US',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset attribution store so getAttributionForApi() returns an empty-ish object
  useAttributionStore.getState().reset();

  // Ensure currency is available via configStore
  useConfigStore.setState(state => ({
    ...state,
    selectedCurrency: 'USD',
  }));

  // Clear campaignStore currency so configStore fallback is used
  useCampaignStore.setState(state => ({ ...state, currency: undefined }));
});

// ─── buildOrder ───────────────────────────────────────────────────────────────

describe('OrderBuilder.buildOrder — properties pass-through', () => {
  const builder = new OrderBuilder();

  it('includes properties on the line when item has a properties object', () => {
    const props = { color: 'red', size: 'M' };
    const item = makeItem({ properties: props });

    const order = builder.buildOrder(minimalFormData, [item], 'card_token');

    expect(order.lines[0].properties).toEqual(props);
  });

  it('omits the properties key when item has no properties field', () => {
    const item = makeItem(); // no properties key at all

    const order = builder.buildOrder(minimalFormData, [item], 'card_token');

    expect(Object.prototype.hasOwnProperty.call(order.lines[0], 'properties')).toBe(false);
  });

  it('omits the properties key when item.properties is explicitly undefined', () => {
    const item = makeItem({ properties: undefined });

    const order = builder.buildOrder(minimalFormData, [item], 'card_token');

    expect(Object.prototype.hasOwnProperty.call(order.lines[0], 'properties')).toBe(false);
  });

  it('maps properties correctly per-item in a mixed array', () => {
    const props = { flavor: 'vanilla' };
    const items = [
      makeItem({ packageId: 1, properties: props }),
      makeItem({ packageId: 2 }), // no properties
      makeItem({ packageId: 3, properties: undefined }), // explicit undefined
    ];

    const order = builder.buildOrder(minimalFormData, items, 'card_token');

    expect(order.lines[0].properties).toEqual(props);
    expect(Object.prototype.hasOwnProperty.call(order.lines[1], 'properties')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(order.lines[2], 'properties')).toBe(false);
  });

  it('maps package_id, quantity, and is_upsell alongside properties', () => {
    const props = { gift: 'true' };
    const item = makeItem({ packageId: 99, quantity: 3, is_upsell: true, properties: props });

    const order = builder.buildOrder(minimalFormData, [item], 'card_token');

    const line = order.lines[0];
    expect(line.package_id).toBe(99);
    expect(line.quantity).toBe(3);
    expect(line.is_upsell).toBe(true);
    expect(line.properties).toEqual(props);
  });

  it('defaults is_upsell to false when item.is_upsell is falsy', () => {
    const itemFalse = makeItem({ is_upsell: false });
    const itemUndefined = makeItem({ is_upsell: undefined });
    const itemNull = makeItem({ is_upsell: null });

    const order = builder.buildOrder(
      minimalFormData,
      [itemFalse, itemUndefined, itemNull],
      'card_token',
    );

    expect(order.lines[0].is_upsell).toBe(false);
    expect(order.lines[1].is_upsell).toBe(false);
    expect(order.lines[2].is_upsell).toBe(false);
  });
});

// ─── buildExpressOrder ────────────────────────────────────────────────────────

describe('OrderBuilder.buildExpressOrder — properties pass-through', () => {
  const builder = new OrderBuilder();

  it('includes properties on the line when item has a properties object', () => {
    const props = { engraving: 'Happy Birthday' };
    const item = makeItem({ properties: props });

    const order = builder.buildExpressOrder([item], 'paypal');

    expect(order.lines[0].properties).toEqual(props);
  });

  it('omits the properties key when item has no properties field', () => {
    const item = makeItem(); // no properties key

    const order = builder.buildExpressOrder([item], 'paypal');

    expect(Object.prototype.hasOwnProperty.call(order.lines[0], 'properties')).toBe(false);
  });
});

// ─── buildTestOrder ───────────────────────────────────────────────────────────

describe('OrderBuilder.buildTestOrder — properties pass-through', () => {
  const builder = new OrderBuilder();

  it('includes properties on the line when item has a properties object', () => {
    const props = { note: 'fragile' };
    const item = makeItem({ properties: props });

    const order = builder.buildTestOrder([item]);

    expect(order.lines[0].properties).toEqual(props);
  });

  it('uses the default line when cartItems is empty', () => {
    const order = builder.buildTestOrder([]);

    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]).toEqual({ package_id: 1, quantity: 1, is_upsell: false });
  });
});
