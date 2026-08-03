/**
 * AutoEventListener — upsell domain handlers
 *
 * Upsell viewed, accepted, and skipped.
 */

import { createLogger } from '@/core/logger';
import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';
import { dataLayer } from '../data-layer-manager';
import { EcommerceEvents } from '../events/ecommerce-events';
import type { AutoEventListenerContext } from './auto-event-listener.types';

const logger = createLogger('AutoEventListener');

/**
 * Set up upsell event listeners
 */
export function setupUpsellEventListeners(
  ctx: AutoEventListenerContext
): void {
  // Upsell viewed
  const handleUpsellViewed = async (data: any) => {
    const orderId = data.orderId;
    const pagePath = data.pagePath;

    // For page-level upsell views, we don't have a specific package ID
    // We'll track this as a general upsell page view
    if (!data.packageId) {
      dataLayer.push({
        event: 'dl_viewed_upsell',
        order_id: orderId,
        page_path: pagePath,
        // Generic upsell data when no specific package
        upsell: {
          package_id: 'page_view',
          package_name: 'Upsell Page View',
          currency: useCampaignStore.getState().currency ?? 'USD',
        },
      });

      logger.info('Tracked upsell page view:', pagePath);
      return;
    }

    // Specific package view
    const packageId = data.packageId;
    const campaignStore = useCampaignStore.getState();
    const packageData = campaignStore.getPackage(packageId);

    if (!packageData) {
      logger.warn('Package not found for upsell view:', packageId);
      return;
    }

    dataLayer.push({
      event: 'dl_viewed_upsell',
      order_id: orderId,
      upsell: {
        package_id: packageId.toString(),
        package_name: packageData.name || `Package ${packageId}`,
        price: parseFloat(packageData.price || '0'),
        currency: campaignStore.currency ?? 'USD',
      },
    });

    logger.info('Tracked upsell view:', packageId);
  };

  ctx.eventBus.on('upsell:viewed', handleUpsellViewed);
  ctx.eventHandlers.set('upsell:viewed', handleUpsellViewed);

  // Upsell accepted
  const handleUpsellAccepted = async (data: any) => {
    const packageId = data.packageId;
    const quantity = data.quantity || 1;
    const orderId = data.orderId || data.order?.ref_id;

    // Get campaign and package data
    const campaignStore = useCampaignStore.getState();
    const packageData = campaignStore.getPackage(packageId);

    // Calculate value
    let value = data.value;
    if (value === undefined && packageData?.price) {
      value = parseFloat(packageData.price) * quantity;
    }

    // Coupon: the order response carries no voucher code, so fall back to the
    // applied cart voucher (mirrors how the purchase event resolves coupon).
    const coupon = data.coupon ?? useCartStore.getState().vouchers?.[0];

    // Get or increment upsell number (track how many upsells have been accepted)
    const upsellNumber =
      data.upsellNumber ||
      (sessionStorage.getItem(`upsells_${orderId}`)
        ? parseInt(sessionStorage.getItem(`upsells_${orderId}`) || '0') + 1
        : 1);

    // Store the upsell count
    if (orderId) {
      sessionStorage.setItem(`upsells_${orderId}`, String(upsellNumber));
    }

    // Create cart item object with campaign package data for proper formatting
    const cartItem = {
      packageId,
      productId: packageData?.product_id,
      productName: packageData?.product_name,
      variantId: packageData?.product_variant_id,
      variantName: packageData?.product_variant_name,
      variantSku: packageData?.product_sku,
      quantity,
      price: value,
      image: packageData?.image,
    };

    // Use EcommerceEvents helper to create properly formatted event with user properties
    const acceptedUpsellEvent = EcommerceEvents.createAcceptedUpsellEvent({
      orderId,
      packageId,
      packageName: data.packageName || packageData?.name || `Package ${packageId}`,
      quantity,
      value: value || 0,
      discount: data.discount,
      coupon,
      currency: data.currency || (campaignStore.currency ?? 'USD'),
      upsellNumber,
      item: cartItem,
    });

    // The _willRedirect flag is now set inside createAcceptedUpsellEvent
    // Additional redirect marking if needed
    if (data.willRedirect) {
      logger.debug('Upsell event already marked for queueing due to redirect');
    }

    dataLayer.push(acceptedUpsellEvent);
    logger.info('Tracked upsell accepted:', {
      packageId,
      orderId,
      upsellOrderId: `${orderId}-US${upsellNumber}`,
      value,
    });
  };

  ctx.eventBus.on('upsell:accepted', handleUpsellAccepted);
  ctx.eventBus.on('upsell:added', handleUpsellAccepted);
  ctx.eventHandlers.set('upsell:accepted', handleUpsellAccepted);
  ctx.eventHandlers.set('upsell:added', handleUpsellAccepted);

  // Upsell skipped
  const handleUpsellSkipped = async (data: any) => {
    dataLayer.push({
      event: 'dl_skipped_upsell',
      order_id: data.orderId,
      upsell: {
        package_id: data.packageId?.toString() || 'unknown',
        package_name: data.packageName || 'Unknown Package',
      },
    });

    logger.info('Tracked upsell skipped:', data.packageId);
  };

  ctx.eventBus.on('upsell:skipped', handleUpsellSkipped);
  ctx.eventHandlers.set('upsell:skipped', handleUpsellSkipped);
}
