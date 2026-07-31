import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RudderStackAdapter } from '@/core/analytics/providers/RudderStackAdapter';
import type { DataLayerEvent } from '@/core/analytics/types';
import { useConfigStore } from '@/state/config';

/**
 * Locks in the RudderStack Ecommerce Events Spec mapping:
 * https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/
 * The pipeline emits GA4-format items (item_id / item_product_id / item_sku /
 * index / item_image); the adapter must translate them to spec Product fields.
 */
describe('RudderStackAdapter mapping', () => {
  let track: ReturnType<typeof vi.fn>;
  let identify: ReturnType<typeof vi.fn>;
  let adapter: RudderStackAdapter;

  const ga4Item = {
    item_id: 'SKU-9', // GA4 item_id holds the product SKU
    item_sku: 'SKU-9',
    item_product_id: '123', // numeric product id
    item_variant_id: '456',
    item_name: 'Widget',
    item_brand: 'Acme',
    item_category: 'Campaign',
    item_variant: 'Blue',
    item_image: 'https://cdn.test/widget.jpg',
    price: 13.5,
    quantity: 2,
    index: 3,
    coupon: 'SAVE10',
    currency: 'USD',
  };

  const propsFor = (name: string): any => {
    const call = track.mock.calls.find(c => c[0] === name);
    return call?.[1];
  };

  beforeEach(() => {
    track = vi.fn();
    identify = vi.fn();
    (window as any).rudderanalytics = {
      track,
      identify,
      page: vi.fn(),
      reset: vi.fn(),
      ready: (cb: () => void) => cb(),
    };
    adapter = new RudderStackAdapter();
  });

  it('maps GA4 item fields to the spec Product object on Product Added', () => {
    const event: DataLayerEvent = {
      event: 'dl_add_to_cart',
      ecommerce: { currency: 'USD', value: 27, items: [ga4Item] },
      _metadata: { session_id: 'sess-1' },
    } as DataLayerEvent;

    adapter.sendEvent(event);

    const props = propsFor('Product Added');
    expect(props).toBeDefined();
    expect(props.cart_id).toBe('sess-1'); // session-scoped cart_id
    expect(props.product_id).toBe('123'); // item_product_id, not the SKU
    expect(props.sku).toBe('SKU-9');
    expect(props.name).toBe('Widget');
    expect(props.brand).toBe('Acme');
    expect(props.variant).toBe('Blue');
    expect(props.coupon).toBe('SAVE10');
    expect(props.position).toBe(3); // from GA4 `index`, not always 0
    expect(props.image_url).toBe('https://cdn.test/widget.jpg');
    expect(props.price).toBe(13.5);
    expect(props.quantity).toBe(2);
    expect(props.currency).toBe('USD');
  });

  it('maps Product List Viewed with products[] and list id', () => {
    const event: DataLayerEvent = {
      event: 'dl_view_item_list',
      ecommerce: {
        currency: 'USD',
        items: [ga4Item],
        item_list_id: 'best-sellers',
        item_list_name: 'Best Sellers',
      },
    };

    adapter.sendEvent(event);

    const props = propsFor('Product List Viewed');
    expect(props.list_id).toBe('best-sellers');
    expect(props.category).toBe('Best Sellers');
    expect(props.products).toHaveLength(1);
    expect(props.products[0].product_id).toBe('123');
    expect(props.products[0].image_url).toBe('https://cdn.test/widget.jpg');
    expect(props.products[0].position).toBe(3);
  });

  it('maps Order Completed totals per spec (revenue/subtotal = items, total = grand)', () => {
    const event: DataLayerEvent = {
      event: 'dl_purchase',
      user_properties: {
        customer_email: 'buyer@test.com',
        customer_first_name: 'Sam',
        customer_zip: '90210',
      },
      ecommerce: {
        currency: 'USD',
        transaction_id: 'ORD-1',
        value: 100, // item revenue, excl tax & shipping
        tax: 8,
        shipping: 5,
        coupon: 'SAVE10',
        affiliation: 'Online Store',
        items: [ga4Item],
      },
      _metadata: { session_id: 'sess-1' },
    } as DataLayerEvent;

    adapter.sendEvent(event);

    const props = propsFor('Order Completed');
    expect(props.checkout_id).toBe('sess-1');
    expect(props.order_id).toBe('ORD-1');
    expect(props.revenue).toBe(100);
    expect(props.subtotal).toBe(100);
    expect(props.total).toBe(113); // value + tax + shipping
    expect(props.tax).toBe(8);
    expect(props.shipping).toBe(5);
    expect(props.coupon).toBe('SAVE10');
    expect(props.products[0].sku).toBe('SKU-9');

    // Identify fires from user_properties (not the dead data.firstname path)
    expect(identify).toHaveBeenCalledWith(
      'buyer@test.com',
      expect.objectContaining({
        email: 'buyer@test.com',
        firstName: 'Sam',
        postalCode: '90210',
      })
    );
  });

  it('maps accepted upsell purchase to a second Order Completed', () => {
    const event: DataLayerEvent = {
      event: 'dl_upsell_purchase',
      ecommerce: {
        currency: 'USD',
        transaction_id: 'ORD-1-US1',
        value: 40,
        tax: 0,
        shipping: 0,
        affiliation: 'Upsell',
        items: [ga4Item],
      },
    };

    adapter.sendEvent(event);

    const props = propsFor('Order Completed');
    expect(props.order_id).toBe('ORD-1-US1');
    expect(props.total).toBe(40);
    expect(props.revenue).toBe(40);
  });

  it('maps shipping to Checkout Step Completed and payment to Payment Info Entered', () => {
    adapter.sendEvent({
      event: 'dl_add_shipping_info',
      ecommerce: { currency: 'USD', value: 27, shipping_tier: 'express', items: [ga4Item] },
      _metadata: { session_id: 'sess-1' },
    } as DataLayerEvent);
    adapter.sendEvent({
      event: 'dl_add_payment_info',
      ecommerce: { currency: 'USD', value: 27, payment_type: 'card', items: [ga4Item] },
      _metadata: { session_id: 'sess-1' },
    } as DataLayerEvent);

    const shipping = propsFor('Checkout Step Completed');
    expect(shipping.checkout_id).toBe('sess-1');
    expect(shipping.step).toBe(2);
    expect(shipping.shipping_method).toBe('express');

    const payment = propsFor('Payment Info Entered');
    expect(payment.checkout_id).toBe('sess-1');
    expect(payment.step).toBe(3);
    expect(payment.payment_method).toBe('card');
  });

  it('forwards campaign_* identifiers as snake_case onto every call', () => {
    // DataLayerManager stamps these snake_case on the event; the RudderStack
    // adapter forwards them unchanged in the payload.
    const eventContext = {
      campaign_name: 'Summer Sale',
      campaign_api_key: 'key-123',
      campaign_currency: 'USD',
      campaign_language: 'en',
      campaign_id: '42',
      campaign_session_id: 'ncsid-abc',
    };
    const expected = { ...eventContext };

    adapter.sendEvent({
      event: 'dl_add_to_cart',
      ecommerce: { currency: 'USD', value: 27, items: [ga4Item] },
      ...eventContext,
    } as DataLayerEvent);

    const track = propsFor('Product Added');
    expect(track).toMatchObject(expected);

    // Also present on the page-view page() call.
    const page = (window as any).rudderanalytics.page as ReturnType<typeof vi.fn>;
    adapter.sendEvent({
      event: 'dl_page_view',
      page: { title: 'T', url: 'https://x/', path: '/', referrer: '' },
      ...eventContext,
    } as DataLayerEvent);
    expect(page.mock.calls[0]?.[2]).toMatchObject(expected);
  });

  it('omits identifiers when the event has none', () => {
    adapter.sendEvent({
      event: 'dl_add_to_cart',
      ecommerce: { currency: 'USD', value: 27, items: [ga4Item] },
    } as DataLayerEvent);

    const track = propsFor('Product Added');
    expect(track.campaign_session_id).toBeUndefined();
    expect(track.campaign_id).toBeUndefined();
    expect(track.campaign_name).toBeUndefined();
  });

  it('populates Cart Viewed products from the ecommerce block (dl_cart_updated)', () => {
    // dl_cart_updated now carries a full ecommerce block (createCartUpdatedEvent),
    // so Cart Viewed must have line items — not the previous empty products [].
    adapter.sendEvent({
      event: 'dl_cart_updated',
      ecommerce: { currency: 'USD', value: 27, items: [ga4Item] },
      cart: { total_value: 27, total_items: 2, currency: 'USD', items: [] },
    } as DataLayerEvent);

    const props = propsFor('Cart Viewed');
    expect(props.products).toHaveLength(1);
    expect(props.products[0].product_id).toBe('123');
    expect(props.products[0].sku).toBe('SKU-9');
    expect(props.value).toBe(27);
  });

  it('resolves page type/name for page view instead of "unknown"', () => {
    useConfigStore.setState({ pageType: 'checkout' });
    document.title = 'Secure Checkout';
    const page = (window as any).rudderanalytics.page as ReturnType<typeof vi.fn>;

    // Real emitted shape: data lives on `event.page`, not `event.data`.
    adapter.sendEvent({
      event: 'dl_page_view',
      page: {
        title: 'Secure Checkout',
        url: 'https://shop.test/checkout',
        path: '/checkout',
        referrer: 'https://shop.test/',
      },
    } as DataLayerEvent);

    // page(category, name, properties)
    expect(page).toHaveBeenCalledTimes(1);
    const [category, name, properties] = page.mock.calls[0];
    expect(category).toBe('checkout'); // from config store, not 'unknown'
    expect(name).toBe('Secure Checkout'); // document title, not 'unknown'
    expect(properties.path).toBe('/checkout');
    expect(properties.url).toBe('https://shop.test/checkout');

    // Custom "<Type> Page View" track carries a real page name too.
    const custom = propsFor('Checkout Page View');
    expect(custom.page_name).toBe('Secure Checkout');
  });

  it('reads upsell viewed payload from event.upsell', () => {
    adapter.sendEvent({
      event: 'dl_viewed_upsell',
      order_id: 'ORD-1',
      upsell: {
        package_id: '77',
        package_name: 'Warranty',
        price: 9.99,
        currency: 'USD',
      },
    } as DataLayerEvent);

    const props = propsFor('Upsell Viewed');
    expect(props.order_id).toBe('ORD-1');
    expect(props.product_id).toBe('77');
    expect(props.name).toBe('Warranty');
    expect(props.price).toBe(9.99);
  });
});
