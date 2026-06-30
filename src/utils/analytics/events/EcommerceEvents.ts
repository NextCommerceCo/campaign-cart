/**
 * Ecommerce Events
 * Builder methods for standardized e-commerce analytics events
 */

import type { DataLayerEvent, EcommerceData, EcommerceItem } from '../types';
import { EventBuilder } from './EventBuilder';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import type { CartItem, EnrichedCartLine } from '@/types/global';
import { createLogger } from '@/utils/logger';
import { resolveOrderTaxBasis } from '../taxBasis';

const logger = createLogger('EcommerceEvents');

export class EcommerceEvents {
  /**
   * Build the GA4 `ecommerce` payload for the current cart: formatted items,
   * the cart total as `value`, and the applied coupon. Shared by view_cart,
   * begin_checkout, add_shipping_info and add_payment_info so they stay
   * consistent (same items, same value, same coupon handling).
   *
   * Uses `cartState.items` directly — `enrichedItems` is never populated by the
   * store, so mapping over it would emit an empty items array.
   */
  private static buildCartEcommerce(): EcommerceData {
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
   * Create view_item_list event (GA4 format)
   */
  static createViewItemListEvent(
    items: (CartItem | EnrichedCartLine | any)[],
    listId?: string,
    listName?: string
  ): DataLayerEvent {
    const currency = EventBuilder.getCurrency();

    // Format items as GA4 items
    const formattedItems = items.map((item, index) =>
      EventBuilder.formatEcommerceItem(item, index, {
        id: listId,
        name: listName,
      })
    );

    // Store list attribution for future events
    EventBuilder.setListAttribution(listId, listName);

    const ecommerce: EcommerceData = {
      currency,
      items: formattedItems,
      item_list_id: listId,
      item_list_name: listName || listId,
    };

    return EventBuilder.createEvent('dl_view_item_list', {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce,
    });
  }

  /**
   * Create view_item event (GA4 format)
   */
  static createViewItemEvent(
    item: CartItem | EnrichedCartLine | any
  ): DataLayerEvent {
    const currency = EventBuilder.getCurrency();
    const list = EventBuilder.getListAttribution();

    const formattedItem = EventBuilder.formatEcommerceItem(item, 0, list);

    const ecommerce: EcommerceData = {
      currency,
      // GA4 view_item requires `value` alongside `currency` (item revenue:
      // price × quantity). Without it GA4 cannot attribute item-view value.
      value: EventBuilder.sumItemsValue([formattedItem]),
      items: [formattedItem],
    };

    return EventBuilder.createEvent('dl_view_item', {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce,
    });
  }

  /**
   * Create add_to_cart event with list attribution (GA4 format)
   */
  static createAddToCartEvent(
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
  static createRemoveFromCartEvent(
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
  static createPackageSwappedEvent(
    previousItem: CartItem | any,
    newItem: CartItem | any,
    priceDifference: number
  ): DataLayerEvent {
    const currency = EventBuilder.getCurrency();
    const formattedPreviousItem =
      EventBuilder.formatEcommerceItem(previousItem);
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
   * Create select_item event (product click) (GA4 format)
   */
  static createSelectItemEvent(
    item: CartItem | EnrichedCartLine | any,
    listId?: string,
    listName?: string
  ): DataLayerEvent {
    const currency = EventBuilder.getCurrency();

    const formattedItem = EventBuilder.formatEcommerceItem(item, 0, {
      id: listId,
      name: listName || listId,
    });

    const ecommerce: EcommerceData = {
      currency,
      items: [formattedItem],
      item_list_id: listId,
      item_list_name: listName || listId,
    };

    return EventBuilder.createEvent('dl_select_item', {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce,
    });
  }

  /**
   * Create begin_checkout event (GA4 format)
   */
  static createBeginCheckoutEvent(): DataLayerEvent {
    const cartState = useCartStore.getState();
    const ecommerce = this.buildCartEcommerce();

    return EventBuilder.createEvent('dl_begin_checkout', {
      user_properties: EventBuilder.getUserProperties(),
      cart_total: String(cartState.total.toNumber() || '0.00'),
      ecommerce,
    });
  }

  /**
   * Create purchase event (GA4 format)
   */
  static createPurchaseEvent(orderData: any): DataLayerEvent {
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
          item_brand:
            packageData?.product_name || campaignStore.data?.name || '',
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
        (item: any, index: number) =>
          EventBuilder.formatEcommerceItem(item, index)
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

  /**
   * Create view_search_results event (GA4 format)
   */
  static createViewSearchResultsEvent(
    items: (CartItem | EnrichedCartLine | any)[],
    searchTerm?: string
  ): DataLayerEvent {
    const currency = EventBuilder.getCurrency();

    // Format items as GA4 items
    const formattedItems = items.map((item, index) =>
      EventBuilder.formatEcommerceItem(item, index, { name: 'search results' })
    );

    const ecommerce: EcommerceData = {
      currency,
      items: formattedItems,
      item_list_name: 'search results',
    };

    return EventBuilder.createEvent('dl_view_search_results', {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce,
      search_term: searchTerm,
    });
  }

  /**
   * Create view_cart event (GA4 format)
   */
  static createViewCartEvent(): DataLayerEvent {
    const cartState = useCartStore.getState();
    const ecommerce = this.buildCartEcommerce();

    return EventBuilder.createEvent('dl_view_cart', {
      user_properties: EventBuilder.getUserProperties(),
      cart_total: String(cartState.total.toNumber() || '0.00'),
      ecommerce,
    });
  }

  /**
   * Create add_shipping_info event
   * Fires when user enters or confirms shipping details
   */
  static createAddShippingInfoEvent(shippingTier?: string): DataLayerEvent {
    const cartState = useCartStore.getState();
    const ecommerce = this.buildCartEcommerce();
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
  static createAddPaymentInfoEvent(paymentType?: string): DataLayerEvent {
    const cartState = useCartStore.getState();
    const ecommerce = this.buildCartEcommerce();
    if (paymentType) ecommerce.payment_type = paymentType;

    return EventBuilder.createEvent('dl_add_payment_info', {
      ecommerce,
      event_category: 'ecommerce',
      event_value: cartState.total.toNumber(),
      payment_type: paymentType,
    });
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
    currency?: string;
    upsellNumber?: number;
    item?: any;
  }): DataLayerEvent {
    const {
      orderId,
      packageId,
      packageName,
      quantity = 1,
      value = 0,
      currency = 'USD',
      upsellNumber = 1,
      item,
    } = data;

    // Format upsell order ID with -US suffix (US1, US2, etc.)
    const upsellOrderId = `${orderId}-US${upsellNumber}`;

    // Get campaign store for additional product data.
    let packageData: any;
    let campaignName = 'Campaign';
    try {
      const campaign = useCampaignStore.getState().data;
      if (campaign) {
        campaignName = campaign.name || 'Campaign';
        packageData = campaign.packages?.find(
          (p: any) => String(p.ref_id) === String(packageId)
        );
      }
    } catch (error) {
      logger.warn('Could not access campaign store for upsell data:', error);
    }

    // Per-unit price so that price × quantity reconciles to the line total
    // (`value`). The order API returns line totals, so divide by quantity.
    const perUnitPrice = quantity > 0 ? value / quantity : value;

    // Format the upsell item as a GA4 item
    const upsellItem: EcommerceItem = item
      ? EventBuilder.formatEcommerceItem(item)
      : {
          item_id: packageData?.product_sku || `SKU-${packageId}`,
          item_name:
            packageName || packageData?.product_name || `Package ${packageId}`,
          item_brand: packageData?.product_name || campaignName,
          item_category: campaignName,
          item_variant: packageData?.product_variant_name || '',
          price: perUnitPrice,
          quantity,
          currency,
        };

    // formatEcommerceItem derives price/quantity from campaign list data, which
    // ignores the accepted bundle quantity and per-line (discounted) pricing.
    // Force the accepted quantity and per-unit price so price × quantity === value.
    if (item) {
      upsellItem.quantity = quantity;
      upsellItem.price = perUnitPrice;
    }

    // `value` is already the full revenue for the accepted line(s) across all
    // units, so it is the transaction value as-is (do not multiply by quantity).
    const additionalRevenue = value;

    // Build GA4 ecommerce structure for upsell
    const ecommerce: EcommerceData = {
      currency,
      transaction_id: upsellOrderId,
      value: additionalRevenue,
      tax: 0,
      shipping: 0,
      affiliation: 'Upsell',
      items: [upsellItem],
    };

    // Get user properties to match Elevar standard
    const userProperties = EventBuilder.getUserProperties();

    // Create the dl_upsell_purchase event with _willRedirect flag
    return EventBuilder.createEvent('dl_upsell_purchase', {
      pageType: 'upsell',
      event_id: upsellOrderId,
      user_properties: userProperties,
      ecommerce,
      // Flag for pending events handler to queue this event
      _willRedirect: true,
      // Additional metadata for tracking
      upsell_metadata: {
        original_order_id: orderId,
        upsell_number: upsellNumber,
        package_id: packageId.toString(),
        package_name: packageName || `Package ${packageId}`,
      },
    });
  }
}
