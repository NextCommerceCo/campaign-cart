/**
 * `EcommerceEvents`' cart category — extracted verbatim from
 * `ecommerce-events.ts`. Events that carry the live cart contents
 * (add/remove/swap, view_cart, cart_updated, add_shipping_info,
 * add_payment_info), plus `buildCartEcommerce` — the shared cart-to-GA4
 * mapping every one of them (and `createBeginCheckoutEvent` in
 * `ecommerce-events.checkout.ts`) is built from, so they stay consistent
 * (same items, same value, same coupon handling).
 */

import type { DataLayerEvent, EcommerceData } from '../types';
import { EventBuilder } from './event-builder';
import { useCartStore } from '@/state/cart';
import type { CartItem, EnrichedCartLine } from '@/types/global';

/**
 * Build the GA4 `ecommerce` payload for the current cart: formatted items,
 * the cart total as `value`, and the applied coupon. Shared by view_cart,
 * begin_checkout, add_shipping_info and add_payment_info so they stay
 * consistent (same items, same value, same coupon handling).
 */
export function buildCartEcommerce(): EcommerceData {
  const cartState = useCartStore.getState();
  const items = cartState.items.map((item, index) =>
    EventBuilder.formatEcommerceItem(item, index)
  );
  const ecommerce: EcommerceData = {
    currency: EventBuilder.getCurrency(),
    // Item revenue (Σ price × quantity), not the cart store `total` which
    // includes shipping — keeps `value` reconciled with `items` (GA4 semantics).
    value: EventBuilder.sumItemsValue(items),
    items,
  };
  if (cartState.vouchers?.[0]) {
    ecommerce.coupon = cartState.vouchers[0];
  }
  // Shipping cost once a method is selected (GA4 `shipping`). `value` stays
  // item revenue — shipping is reported as its own field so totals reconcile
  // (value + shipping = grand total). Reported even when free (0) so the
  // amount is always present in add_shipping_info / view_cart / begin_checkout;
  // omitted entirely before a method is chosen.
  if (cartState.shippingMethod?.price) {
    ecommerce.shipping = cartState.shippingMethod.price.toNumber();
  }
  return ecommerce;
}

/**
 * Create add_to_cart event with list attribution (GA4 format)
 */
export function createAddToCartEvent(
  item: CartItem | EnrichedCartLine | any,
  listId?: string,
  listName?: string
): DataLayerEvent {
  const currency = EventBuilder.getCurrency();

  // Use provided list info or get from session
  const list = EventBuilder.getListAttribution();
  const finalListId = listId || list?.id;
  const finalListName = listName || list?.name || finalListId;

  const formattedItem = EventBuilder.formatEcommerceItem(item, 0, {
    id: finalListId,
    name: finalListName,
  });

  // Calculate value (price * quantity)
  const value =
    formattedItem.price && formattedItem.quantity
      ? formattedItem.price * formattedItem.quantity
      : 0;

  const ecommerce: EcommerceData = {
    currency,
    value,
    items: [formattedItem],
  };

  return EventBuilder.createEvent('dl_add_to_cart', {
    user_properties: EventBuilder.getUserProperties(),
    ecommerce,
  });
}

/**
 * Create remove_from_cart event (GA4 format)
 */
export function createRemoveFromCartEvent(
  item: CartItem | EnrichedCartLine | any
): DataLayerEvent {
  const currency = EventBuilder.getCurrency();
  const list = EventBuilder.getListAttribution();

  const formattedItem = EventBuilder.formatEcommerceItem(item, 0, list);

  // Calculate value (price * quantity)
  const value =
    formattedItem.price && formattedItem.quantity
      ? formattedItem.price * formattedItem.quantity
      : 0;

  const ecommerce: EcommerceData = {
    currency,
    value,
    items: [formattedItem],
  };

  return EventBuilder.createEvent('dl_remove_from_cart', {
    user_properties: EventBuilder.getUserProperties(),
    ecommerce,
  });
}

/**
 * Create package_swapped event for atomic package swaps
 */
export function createPackageSwappedEvent(
  previousItem: CartItem | any,
  newItem: CartItem | any,
  priceDifference: number
): DataLayerEvent {
  const currency = EventBuilder.getCurrency();
  const formattedPreviousItem = EventBuilder.formatEcommerceItem(previousItem);
  const formattedNewItem = EventBuilder.formatEcommerceItem(newItem);

  const ecommerce: EcommerceData = {
    currency,
    value_change: priceDifference,
    items_removed: [formattedPreviousItem],
    items_added: [formattedNewItem],
  };

  return EventBuilder.createEvent('dl_package_swapped', {
    ecommerce,
    event_category: 'ecommerce',
    event_action: 'swap',
    event_label: `${formattedPreviousItem.item_name} → ${formattedNewItem.item_name}`,
    swap_details: {
      previous_package_id: previousItem.packageId,
      new_package_id: newItem.packageId,
      price_difference: priceDifference,
    },
  });
}

/**
 * Create view_cart event (GA4 format)
 */
export function createViewCartEvent(): DataLayerEvent {
  const cartState = useCartStore.getState();
  const ecommerce = buildCartEcommerce();

  return EventBuilder.createEvent('dl_view_cart', {
    user_properties: EventBuilder.getUserProperties(),
    cart_total: String(cartState.total.toNumber() || '0.00'),
    ecommerce,
  });
}

/**
 * Create cart_updated event (GA4 format). Fires on any cart change and carries
 * the same GA4 `ecommerce` block as view_cart, so every provider receives the
 * full line items — not just the thin `cart` summary the AutoEventListener
 * attaches for backward compatibility.
 */
export function createCartUpdatedEvent(): DataLayerEvent {
  const cartState = useCartStore.getState();
  const ecommerce = buildCartEcommerce();

  return EventBuilder.createEvent('dl_cart_updated', {
    user_properties: EventBuilder.getUserProperties(),
    cart_total: String(cartState.total.toNumber() || '0.00'),
    ecommerce,
  });
}

/**
 * Create add_shipping_info event
 * Fires when user enters or confirms shipping details
 */
export function createAddShippingInfoEvent(
  shippingTier?: string
): DataLayerEvent {
  const cartState = useCartStore.getState();
  const ecommerce = buildCartEcommerce();
  ecommerce.currencyCode = ecommerce.currency; // Elevar compatibility
  if (shippingTier) ecommerce.shipping_tier = shippingTier;

  return EventBuilder.createEvent('dl_add_shipping_info', {
    ecommerce,
    event_category: 'ecommerce',
    event_value: cartState.total.toNumber(),
    shipping_tier: shippingTier,
  });
}

/**
 * Create add_payment_info event
 * Fires when user enters or confirms payment method
 */
export function createAddPaymentInfoEvent(
  paymentType?: string
): DataLayerEvent {
  const cartState = useCartStore.getState();
  const ecommerce = buildCartEcommerce();
  if (paymentType) ecommerce.payment_type = paymentType;

  return EventBuilder.createEvent('dl_add_payment_info', {
    ecommerce,
    event_category: 'ecommerce',
    event_value: cartState.total.toNumber(),
    payment_type: paymentType,
  });
}
