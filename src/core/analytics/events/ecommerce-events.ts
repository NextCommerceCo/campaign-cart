/**
 * Ecommerce Events
 * Builder methods for standardized e-commerce analytics events
 *
 * Thin class shell: every static method delegates to a same-named function
 * extracted verbatim into a sibling module grouped by category —
 * `ecommerce-events.browse.ts` (list/item/search views), `ecommerce-events.cart.ts`
 * (cart-carrying events plus the shared `buildCartEcommerce` helper),
 * `ecommerce-events.checkout.ts` (begin_checkout, purchase), and
 * `ecommerce-events.upsell.ts` (accepted_upsell). Splitting this way keeps the
 * class — and every `EcommerceEvents.createXxxEvent()` call site across the
 * SDK — exactly where it was; only the implementation moved.
 */

import type { DataLayerEvent } from '../types';
import type { CartItem, EnrichedCartLine } from '@/types/global';
import * as browseEvents from './ecommerce-events.browse';
import * as cartEvents from './ecommerce-events.cart';
import * as checkoutEvents from './ecommerce-events.checkout';
import * as upsellEvents from './ecommerce-events.upsell';

export class EcommerceEvents {
  /**
   * Create view_item_list event (GA4 format)
   */
  static createViewItemListEvent(
    items: (CartItem | EnrichedCartLine | any)[],
    listId?: string,
    listName?: string
  ): DataLayerEvent {
    return browseEvents.createViewItemListEvent(items, listId, listName);
  }

  /**
   * Create view_item event (GA4 format)
   */
  static createViewItemEvent(
    item: CartItem | EnrichedCartLine | any
  ): DataLayerEvent {
    return browseEvents.createViewItemEvent(item);
  }

  /**
   * Create add_to_cart event with list attribution (GA4 format)
   */
  static createAddToCartEvent(
    item: CartItem | EnrichedCartLine | any,
    listId?: string,
    listName?: string
  ): DataLayerEvent {
    return cartEvents.createAddToCartEvent(item, listId, listName);
  }

  /**
   * Create remove_from_cart event (GA4 format)
   */
  static createRemoveFromCartEvent(
    item: CartItem | EnrichedCartLine | any
  ): DataLayerEvent {
    return cartEvents.createRemoveFromCartEvent(item);
  }

  /**
   * Create package_swapped event for atomic package swaps
   */
  static createPackageSwappedEvent(
    previousItem: CartItem | any,
    newItem: CartItem | any,
    priceDifference: number
  ): DataLayerEvent {
    return cartEvents.createPackageSwappedEvent(
      previousItem,
      newItem,
      priceDifference
    );
  }

  /**
   * Create select_item event (product click) (GA4 format)
   */
  static createSelectItemEvent(
    item: CartItem | EnrichedCartLine | any,
    listId?: string,
    listName?: string
  ): DataLayerEvent {
    return browseEvents.createSelectItemEvent(item, listId, listName);
  }

  /**
   * Create begin_checkout event (GA4 format)
   */
  static createBeginCheckoutEvent(): DataLayerEvent {
    return checkoutEvents.createBeginCheckoutEvent();
  }

  /**
   * Create purchase event (GA4 format)
   */
  static createPurchaseEvent(orderData: any): DataLayerEvent {
    return checkoutEvents.createPurchaseEvent(orderData);
  }

  /**
   * Create view_search_results event (GA4 format)
   */
  static createViewSearchResultsEvent(
    items: (CartItem | EnrichedCartLine | any)[],
    searchTerm?: string
  ): DataLayerEvent {
    return browseEvents.createViewSearchResultsEvent(items, searchTerm);
  }

  /**
   * Create view_cart event (GA4 format)
   */
  static createViewCartEvent(): DataLayerEvent {
    return cartEvents.createViewCartEvent();
  }

  /**
   * Create cart_updated event (GA4 format). Fires on any cart change and carries
   * the same GA4 `ecommerce` block as view_cart, so every provider receives the
   * full line items — not just the thin `cart` summary the AutoEventListener
   * attaches for backward compatibility.
   */
  static createCartUpdatedEvent(): DataLayerEvent {
    return cartEvents.createCartUpdatedEvent();
  }

  /**
   * Create add_shipping_info event
   * Fires when user enters or confirms shipping details
   */
  static createAddShippingInfoEvent(shippingTier?: string): DataLayerEvent {
    return cartEvents.createAddShippingInfoEvent(shippingTier);
  }

  /**
   * Create add_payment_info event
   * Fires when user enters or confirms payment method
   */
  static createAddPaymentInfoEvent(paymentType?: string): DataLayerEvent {
    return cartEvents.createAddPaymentInfoEvent(paymentType);
  }

  /**
   * Create accepted_upsell event (dl_upsell_purchase format)
   * Fires when user accepts an upsell offer
   * Uses GA4 format with proper transaction_id and value
   */
  static createAcceptedUpsellEvent(data: {
    orderId: string;
    packageId: number | string;
    packageName?: string;
    quantity?: number;
    value?: number;
    /** Total discount applied to the accepted line(s) (pre-discount − value). */
    discount?: number;
    /** Voucher/coupon code applied to the order, when present. */
    coupon?: string;
    currency?: string;
    upsellNumber?: number;
    item?: any;
  }): DataLayerEvent {
    return upsellEvents.createAcceptedUpsellEvent(data);
  }
}
