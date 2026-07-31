import { PropertyResolver } from '@/core/base/base-display-enhancer';

/**
 * Reads an `order.*` property off the order store's current state.
 *
 * Split in two halves: the state properties above the `if (!order)` guard
 * answer without an order present; everything below needs one.
 */
export function getOrderPropertyValue(orderState: any, property: string): any {
  const order = orderState.order;

  // Handle state properties that don't require an order to exist
  switch (property) {
    case 'exists':
    case 'hasOrder':
      return !!order;

    case 'isLoaded':
      return !orderState.isLoading && !!order;

    case 'isLoading':
      return orderState.isLoading;

    case 'hasError':
      return !!orderState.error;

    case 'cacheFresh':
    case 'isCacheFresh':
      // Check if order cache was loaded less than 15 minutes ago
      if (!order || !orderState.orderLoadedAt) return false;
      const now = Date.now();
      const loadedAt = orderState.orderLoadedAt;
      const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
      return now - loadedAt < fifteenMinutes;

    case 'cacheExpired':
    case 'isCacheExpired':
      // Check if order cache is expired (15+ minutes old)
      if (!order || !orderState.orderLoadedAt) return false;
      const currentTime = Date.now();
      const orderLoadTime = orderState.orderLoadedAt;
      const expiration = 15 * 60 * 1000; // 15 minutes in milliseconds
      return currentTime - orderLoadTime >= expiration;

    // Keep old names for backwards compatibility but map to new behavior
    case 'isRecent':
    case 'isRecentOrder':
      // NOW checks if order was PLACED recently, not cache
      if (!order) return false;
      const orderTsRecent = order.attribution?.metadata?.timestamp;
      if (!orderTsRecent) return false;
      const nowRecent = Date.now();
      const ageRecent = nowRecent - orderTsRecent;
      const fifteenMinsRecent = 15 * 60 * 1000;
      return ageRecent < fifteenMinsRecent;

    case 'isExpired':
      // NOW checks if order is old, not cache
      if (!order) return false;
      const orderTsExpired = order.attribution?.metadata?.timestamp;
      if (!orderTsExpired) return false;
      const nowExpired = Date.now();
      const ageExpired = nowExpired - orderTsExpired;
      const fifteenMinsExpired = 15 * 60 * 1000;
      return ageExpired >= fifteenMinsExpired;

    case 'isNewOrder':
    case 'wasPlacedRecently':
      // Check if order was PLACED less than 15 minutes ago (not loaded)
      if (!order) return false;
      const orderTimestamp = order.attribution?.metadata?.timestamp;
      if (!orderTimestamp) return false;
      const nowTime = Date.now();
      const orderAge = nowTime - orderTimestamp;
      const fifteenMins = 15 * 60 * 1000;
      return orderAge < fifteenMins;

    case 'isOldOrder':
    case 'wasPlacedLongAgo':
      // Check if order was PLACED more than 15 minutes ago
      if (!order) return false;
      const orderTs = order.attribution?.metadata?.timestamp;
      if (!orderTs) return false;
      const currentTs = Date.now();
      const age = currentTs - orderTs;
      const fifteenMinutesMs = 15 * 60 * 1000;
      return age >= fifteenMinutesMs;
  }

  if (!order) {
    // No order exists, return false for all other properties
    return false;
  }

  // Handle order content properties (requires order to exist)
  switch (property) {
    case 'isTest':
      return order.is_test || false;

    case 'hasItems':
      return order.lines && order.lines.length > 0;

    case 'isEmpty':
      return !order.lines || order.lines.length === 0;

    case 'hasShipping':
      return parseFloat(order.shipping_incl_tax || '0') > 0;

    case 'hasTax':
      return parseFloat(order.total_tax || '0') > 0;

    case 'hasDiscounts':
      return parseFloat(order.total_discounts || '0') > 0;

    case 'hasUpsells':
      return order.lines?.some((line: any) => line.is_upsell) || false;

    case 'supportsUpsells':
    case 'acceptsUpsells':
    case 'supportsPostPurchaseUpsells':
      return order.supports_post_purchase_upsells || false;

    // Numeric properties for comparisons
    case 'total':
      return parseFloat(order.total_incl_tax || '0');

    case 'subtotal':
      // Calculate subtotal from line items only (excludes shipping)
      if (order.lines && order.lines.length > 0) {
        return order.lines.reduce((sum: number, line: any) => {
          return sum + parseFloat(line.price_excl_tax || '0');
        }, 0);
      }
      // Fallback: subtract shipping from total_excl_tax
      return (
        parseFloat(order.total_excl_tax || '0') -
        parseFloat(order.shipping_excl_tax || '0')
      );

    case 'tax':
      return parseFloat(order.total_tax || '0');

    case 'shipping':
      return parseFloat(order.shipping_incl_tax || '0');

    case 'shippingExclTax':
      return parseFloat(order.shipping_excl_tax || '0');

    case 'shippingTax':
      return parseFloat(order.shipping_tax || '0');

    case 'discounts':
      return parseFloat(order.total_discounts || '0');

    case 'itemCount':
      return order.lines?.length || 0;

    case 'totalQuantity':
      return (
        order.lines?.reduce(
          (sum: number, line: any) => sum + (line.quantity || 0),
          0
        ) || 0
      );

    default:
      // Try direct property access using PropertyResolver
      return PropertyResolver.getNestedProperty(order, property);
  }
}
