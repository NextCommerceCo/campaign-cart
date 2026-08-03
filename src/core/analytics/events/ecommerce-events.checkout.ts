/**
 * `EcommerceEvents`' checkout category — extracted verbatim from
 * `ecommerce-events.ts`. `createBeginCheckoutEvent` reuses
 * `buildCartEcommerce` from `ecommerce-events.cart.ts` so the checkout-start
 * event carries the same items/value/coupon as view_cart. `createPurchaseEvent`
 * builds its own `ecommerce` block from the order payload instead, since a
 * completed order carries its own totals and tax basis rather than the live
 * cart's.
 */

import type { DataLayerEvent, EcommerceData, EcommerceItem } from '../types';
import { EventBuilder } from './event-builder';
import { useCartStore } from '@/state/cart';
import { useCampaignStore } from '@/state/campaign';
import { resolveOrderTaxBasis } from '../tax-basis';
import { buildCartEcommerce } from './ecommerce-events.cart';

/**
 * Create begin_checkout event (GA4 format)
 */
export function createBeginCheckoutEvent(): DataLayerEvent {
  const cartState = useCartStore.getState();
  const ecommerce = buildCartEcommerce();

  return EventBuilder.createEvent('dl_begin_checkout', {
    user_properties: EventBuilder.getUserProperties(),
    cart_total: String(cartState.total.toNumber() || '0.00'),
    ecommerce,
  });
}

/**
 * Create purchase event (GA4 format)
 */
export function createPurchaseEvent(orderData: any): DataLayerEvent {
  const cartState = useCartStore.getState();
  const currency = EventBuilder.getCurrency();
  const campaignStore = useCampaignStore.getState();

  // Handle order object structure from API
  const order = orderData.order || orderData;
  const orderId =
    order.number ||
    order.ref_id ||
    orderData.orderId ||
    orderData.transactionId ||
    `order_${Date.now()}`;

  // Parse order totals
  const orderTotal = parseFloat(
    order.total_incl_tax ||
      order.total ||
      orderData.total ||
      cartState.total.toNumber() ||
      0
  );
  // Does this store display tax-inclusive prices? Drives whether item price,
  // value and shipping use the incl- or excl-tax basis so they match what the
  // customer saw in the funnel (see resolveOrderTaxBasis).
  const taxBasis = resolveOrderTaxBasis(
    order,
    campaignStore.data?.packages ?? []
  );
  const taxInclusive = taxBasis === 'incl';

  const orderTax = parseFloat(order.total_tax || orderData.tax || 0);
  const orderShipping = parseFloat(
    (taxInclusive ? order.shipping_incl_tax : order.shipping_excl_tax) ||
      order.shipping_incl_tax ||
      orderData.shipping ||
      cartState.shippingMethod?.price.toNumber() ||
      0
  );

  // Format order items as GA4 items
  let items: EcommerceItem[] = [];
  if (order.lines && order.lines.length > 0) {
    items = order.lines.map((line: any, index: number) => {
      // Try to get package data from campaign
      const packageData: any = campaignStore.data?.packages?.find(
        (p: any) => String(p.ref_id) === String(line.package)
      );

      // Per-unit price on the displayed basis — excl-tax for tax-exclusive
      // (US) stores, incl-tax for VAT stores — so it matches the price shown
      // in add_to_cart / view_cart and the funnel stays consistent.
      // (`line.price_*` are line totals → divide by qty.)
      const lineTotalPrice = taxInclusive
        ? line.price_incl_tax || line.price_excl_tax
        : line.price_excl_tax || line.price_incl_tax;
      const linePrice = parseFloat(lineTotalPrice || line.price || 0);
      const lineQuantity = parseInt(line.quantity || 1);
      const perUnitPrice =
        lineQuantity > 0 ? linePrice / lineQuantity : linePrice;

      const item: EcommerceItem = {
        item_id:
          line.product_sku ||
          packageData?.product_sku ||
          line.sku ||
          `SKU-${line.product_id || line.id}`,
        item_name:
          line.product_title ||
          packageData?.product_name ||
          line.name ||
          'Unknown Product',
        item_brand: packageData?.product_name || campaignStore.data?.name || '',
        item_category:
          line.campaign_name || campaignStore.data?.name || 'Campaign',
        item_variant:
          line.package_profile ||
          packageData?.product_variant_name ||
          line.variant ||
          '',
        price: perUnitPrice,
        quantity: lineQuantity,
        currency: order.currency || currency,
        index,
      };

      // Carry product/variant ids when known, matching formatEcommerceItem's shape.
      const productId = line.product_id ?? packageData?.product_id;
      const variantId = line.variant_id ?? packageData?.product_variant_id;
      if (productId != null) item.item_product_id = String(productId);
      if (variantId != null) item.item_variant_id = String(variantId);

      return item;
    });
  } else if (orderData.items || cartState.items.length > 0) {
    // Fallback to provided items or cart items (enrichedItems is never populated)
    items = (orderData.items || cartState.items).map(
      (item: any, index: number) => EventBuilder.formatEcommerceItem(item, index)
    );
  }

  // GA4 rule: `value` = Σ(item price × quantity), the item revenue ONLY —
  // tax and shipping ride in their own fields, never folded into `value`.
  // (Previously this used the grand total `total_incl_tax`, which over-reported
  // purchase revenue by the tax + shipping amount.) Items already carry the
  // displayed-basis unit price, so summing them is correct for both
  // tax-exclusive and tax-inclusive stores. Falls back to the order subtotal
  // only if items can't be summed.
  const itemsValue = EventBuilder.sumItemsValue(items);
  const value =
    itemsValue > 0
      ? itemsValue
      : Math.max(0, orderTotal - orderTax - orderShipping);

  // Build GA4 ecommerce object
  const ecommerce: EcommerceData = {
    currency: order.currency || currency,
    transaction_id: orderId,
    value,
    tax: orderTax,
    shipping: orderShipping,
    affiliation: 'Online Store',
    items,
  };

  // Add coupon if present
  const coupon =
    order.vouchers?.[0]?.code || orderData.coupon || cartState.vouchers?.[0];
  if (coupon) {
    ecommerce.coupon = coupon;
  }

  // Add discount amount if present
  const discountAmount = order.discount || orderData.discountAmount || 0;
  if (discountAmount) {
    ecommerce.discount = discountAmount;
  }

  // Clear list attribution after purchase
  EventBuilder.clearListAttribution();

  // Extract user properties from order data if available
  let userProperties = EventBuilder.getUserProperties();
  if (order.user || order.billing_address) {
    // Override with order data which is more reliable at purchase time
    userProperties = {
      ...userProperties,
      visitor_type: order.user ? 'logged_in' : 'guest',
      ...(order.user?.email && { customer_email: order.user.email }),
      ...(order.user?.first_name && {
        customer_first_name: order.user.first_name,
      }),
      ...(order.user?.last_name && {
        customer_last_name: order.user.last_name,
      }),
      ...(order.user?.phone_number && {
        customer_phone: order.user.phone_number,
      }),
      // Use billing address from order
      ...(order.billing_address && {
        customer_first_name:
          order.billing_address.first_name || order.user?.first_name,
        customer_last_name:
          order.billing_address.last_name || order.user?.last_name,
        customer_address_1: order.billing_address.line1 || '',
        customer_address_2: order.billing_address.line2 || '',
        customer_city: order.billing_address.line4 || '', // line4 is city in this format
        customer_province: order.billing_address.state || '',
        customer_province_code: order.billing_address.state || '',
        customer_zip: order.billing_address.postcode || '',
        customer_country: order.billing_address.country || '',
        customer_phone:
          order.billing_address.phone_number || order.user?.phone_number,
      }),
    };
  }

  return EventBuilder.createEvent('dl_purchase', {
    pageType: 'purchase',
    event_id: orderId,
    user_properties: userProperties,
    ecommerce,
  });
}
