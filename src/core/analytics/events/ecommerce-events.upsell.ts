/**
 * `EcommerceEvents`' upsell category — extracted verbatim from
 * `ecommerce-events.ts`. `createAcceptedUpsellEvent` is the only builder in
 * this file family that logs (a warn when the campaign store can't be read),
 * which is why it alone takes a module-level `logger`.
 */

import type { DataLayerEvent, EcommerceData, EcommerceItem } from '../types';
import { EventBuilder } from './event-builder';
import { useCampaignStore } from '@/state/campaign';
import { createLogger } from '@/core/logger';

const logger = createLogger('EcommerceEvents');

/**
 * Create accepted_upsell event (dl_upsell_purchase format)
 * Fires when user accepts an upsell offer
 * Uses GA4 format with proper transaction_id and value
 */
export function createAcceptedUpsellEvent(data: {
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
  const {
    orderId,
    packageId,
    packageName,
    quantity = 1,
    value = 0,
    discount,
    coupon,
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
  // Per-unit discount from the actual order line (pre-discount − value). GA4
  // `discount` is the per-unit amount knocked off, so price + discount equals
  // the original per-unit price.
  const perUnitDiscount =
    discount !== undefined && quantity > 0 ? discount / quantity : discount;

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
        ...(perUnitDiscount && perUnitDiscount > 0
          ? { discount: Math.round(perUnitDiscount * 100) / 100 }
          : {}),
      };

  // formatEcommerceItem derives price/quantity from campaign list data, which
  // ignores the accepted bundle quantity and per-line (discounted) pricing.
  // Force the accepted quantity, per-unit price and the real per-unit discount
  // so price × quantity === value and the discount matches what was charged
  // (overriding any catalog-derived discount from formatEcommerceItem).
  if (item) {
    upsellItem.quantity = quantity;
    upsellItem.price = perUnitPrice;
    // The order-line discount is authoritative when present; otherwise keep
    // the compare-at discount formatEcommerceItem derived from the catalog
    // retail price (don't wipe it just because there's no order-level voucher).
    if (perUnitDiscount && perUnitDiscount > 0) {
      upsellItem.discount = Math.round(perUnitDiscount * 100) / 100;
    }
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

  // Coupon applied to the order, when present (GA4-recommended on purchase
  // events). Offer-priced upsells carry no code, so this stays absent.
  if (coupon) {
    ecommerce.coupon = coupon;
  }

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
