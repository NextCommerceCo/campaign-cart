/**
 * AutoEventListener — checkout domain handlers
 *
 * Order completed (purchase). Checkout-started and express-checkout-started
 * are wired here too, disabled — see the comments on each.
 */

import { createLogger } from '@/core/logger';
import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';
import { dataLayer } from '../data-layer-manager';
import { EcommerceEvents } from '../events/ecommerce-events';
import type { AutoEventListenerContext } from './auto-event-listener.types';

const logger = createLogger('AutoEventListener');

/**
 * Set up checkout event listeners
 */
export function setupCheckoutEventListeners(
  ctx: AutoEventListenerContext
): void {
  // Checkout started
  // DISABLED: checkout:started handler to prevent duplicate begin_checkout events
  // The begin_checkout event is now properly tracked in CheckoutFormEnhancer
  // through nextAnalytics.track(EcommerceEvents.createBeginCheckoutEvent())
  /*
  const handleCheckoutStarted = async (data: any) => {
    const cartStore = useCartStore.getState();
    const campaignStore = useCampaignStore.getState();

    const items = cartStore.items.map((item, index) => {
      const packageData = campaignStore.getPackage(item.packageId);
      return {
        item_id: packageData?.external_id?.toString() || item.packageId.toString(), // Use external_id for analytics
        item_name: packageData?.name || `Package ${item.packageId}`,
        currency: campaignStore.currency ?? 'USD',
        price: parseFloat(packageData?.price_total || '0'), // Use total package price
        quantity: item.quantity, // This is the number of packages in cart
        item_category: campaignStore.data?.name || 'uncategorized',
        item_variant: packageData?.product_variant_name || packageData?.product?.variant?.name,
        item_brand: packageData?.product_name || packageData?.product?.name,
        item_sku: packageData?.product_sku || packageData?.product?.variant?.sku,
        ...(packageData?.image && { item_image: packageData.image }),
        index: index
      };
    });

    const event = dataLayer.formatEcommerceEvent('dl_begin_checkout', {
      currency: campaignStore.currency ?? 'USD',
      value: cartStore.total || cartStore.subtotal || 0,
      items: items,
      coupon: data.coupon
    });

    dataLayer.push(event);
    logger.info('Tracked checkout started');
  };

  this.eventBus.on('checkout:started', handleCheckoutStarted);
  this.eventHandlers.set('checkout:started', handleCheckoutStarted);
  */

  // DISABLED: Express checkout handler to prevent duplicate begin_checkout events
  // Express checkout events are properly tracked through the main analytics system
  /*
  // Express checkout started
  const handleExpressCheckoutStarted = async (data: any) => {
    const cartStore = useCartStore.getState();
    const campaignStore = useCampaignStore.getState();

    const items = cartStore.items.map((item, index) => {
      const packageData = campaignStore.getPackage(item.packageId);
      return {
        item_id: packageData?.external_id?.toString() || item.packageId.toString(),
        item_name: packageData?.name || `Package ${item.packageId}`,
        currency: campaignStore.currency ?? 'USD',
        price: parseFloat(packageData?.price_total || '0'),
        quantity: item.quantity,
        item_category: campaignStore.data?.name || 'uncategorized',
        ...(packageData?.image && { item_image: packageData.image }),
        item_variant: undefined,
        index: index
      };
    });

    const event = dataLayer.formatEcommerceEvent('dl_begin_checkout', {
      currency: campaignStore.currency ?? 'USD',
      value: cartStore.total || cartStore.subtotal || 0,
      items: items,
      coupon: cartStore.appliedCoupons?.[0]?.code,
      payment_type: data.method || 'express'
    });

    dataLayer.push(event);
    logger.info('Tracked express checkout started', { method: data.method });
  };

  this.eventBus.on('express-checkout:started', handleExpressCheckoutStarted);
  this.eventHandlers.set('express-checkout:started', handleExpressCheckoutStarted);
  */

  // Order completed
  const handleOrderCompleted = async (order: any) => {
    // The data passed is the order object itself
    const orderId = order.ref_id || order.number || order.order_id || order.transaction_id;
    const total = parseFloat(order.total_incl_tax || order.total || '0');

    // Always get cart store at the beginning
    const cartStore = useCartStore.getState();
    const campaignStore = useCampaignStore.getState();

    // Get items from order lines
    let items = [];
    if (order.lines && Array.isArray(order.lines)) {
      items = order.lines.map((line: any, index: number) => ({
        item_id: line.product_sku || line.id?.toString() || `line_${index}`,
        item_name: line.product_title || line.product_description || `Item ${line.id}`,
        currency: order.currency || 'USD',
        price: parseFloat(line.price_incl_tax || line.price || '0'),
        quantity: parseInt(line.quantity?.toString() || '1'),
        item_category: campaignStore.data?.name || 'uncategorized',
        item_variant: line.variant_title,
        discount:
          parseFloat(line.price_incl_tax_excl_discounts || '0') -
          parseFloat(line.price_incl_tax || '0'),
        index: index,
      }));
    } else {
      // Fallback to cart store
      items = cartStore.items.map((item, index) => {
        const packageData = campaignStore.getPackage(item.packageId);
        return {
          item_id: packageData?.external_id?.toString() || item.packageId.toString(), // Use external_id for analytics
          item_name: packageData?.name || `Package ${item.packageId}`,
          currency: campaignStore.currency ?? 'USD',
          price: parseFloat(packageData?.price_total || '0'), // Use total package price
          quantity: item.quantity, // This is the number of packages in cart
          item_category: campaignStore.data?.name || 'uncategorized',
          ...(packageData?.image && { item_image: packageData.image }),
          index: index,
        };
      });
    }

    const purchaseData = {
      transaction_id: orderId,
      order_number: order.number, // Add the actual order number
      currency: order.currency || 'USD',
      value: total || 0,
      items: items,
      coupon: order.discounts?.[0]?.code || order.coupon_code || order.coupon,
      shipping: parseFloat(order.shipping_incl_tax || order.shipping || '0'),
      tax: parseFloat(order.total_tax || order.tax || '0'),
    };

    // Use EcommerceEvents.createPurchaseEvent for proper Elevar format
    const event = EcommerceEvents.createPurchaseEvent({
      order: order,
      orderId: orderId,
      transactionId: orderId,
      total: total,
      tax: parseFloat(order.total_tax || order.tax || '0'),
      shipping: parseFloat(order.shipping_incl_tax || order.shipping || '0'),
      coupon: order.discounts?.[0]?.code || order.coupon_code || order.coupon,
      items: cartStore.items, // Pass raw cart items with all product data
      currency: order.currency || 'USD',
    });

    // Purchase events ALWAYS redirect to confirmation/upsell pages
    (event as any)._willRedirect = true;
    logger.debug('Marked purchase event for queueing with _willRedirect = true');

    dataLayer.push(event);
    logger.info('Tracked purchase:', orderId);
  };

  ctx.eventBus.on('order:completed', handleOrderCompleted);
  ctx.eventHandlers.set('order:completed', handleOrderCompleted);
  ctx.eventBus.on('express-checkout:completed', handleOrderCompleted);
  ctx.eventHandlers.set('express-checkout:completed', handleOrderCompleted);
}
