/**
 * Event Builder — GA4 item-formatting layer
 *
 * Turns a cart/package line into a GA4 `EcommerceItem`: resolves currency,
 * product identity, quantity (packages × units-per-package), the final
 * per-unit price, and the pre-discount price used for GA4 `discount`.
 */

import type { EcommerceItem } from '../types';
import type { MinimalCartItem } from './event-builder.types';
import { useCampaignStore } from '@/state/campaign';
import { createLogger } from '@/core/logger';

const logger = createLogger('EventBuilder');

/**
 * Sum a formatted item list to the cart's item revenue (Σ price × quantity).
 *
 * This is the correct GA4 `value` for cart-contents events (dl_user_data,
 * dl_view_cart, dl_begin_checkout, …): item revenue only, excluding shipping
 * and tax. Deriving it from the items — rather than the cart store `total`,
 * which includes shipping — keeps `value` reconciled with the items array and
 * matches GA4 semantics (shipping is reported separately on add_shipping_info
 * and purchase).
 */
export function sumItemsValue(items: EcommerceItem[]): number {
  const total = items.reduce((sum, item) => {
    const price =
      typeof item.price === 'number'
        ? item.price
        : parseFloat(String(item.price)) || 0;
    const quantity =
      typeof item.quantity === 'number'
        ? item.quantity
        : parseFloat(String(item.quantity)) || 0;
    return sum + price * quantity;
  }, 0);
  // Round to cents to avoid floating-point drift (e.g. 0.1 + 0.2).
  return Math.round(total * 100) / 100;
}

/**
 * Get currency from campaign store
 */
export function getCurrency(): string {
  try {
    if (typeof window !== 'undefined') {
      const campaignState = useCampaignStore.getState();
      return campaignState.currency ?? 'USD';
    }
  } catch (error) {
    logger.warn('Could not access campaign store for currency:', error);
  }
  return 'USD';
}

/**
 * Format cart item to ecommerce item
 */
export function formatEcommerceItem(
  item: MinimalCartItem,
  index?: number,
  list?: { id?: string; name?: string }
): EcommerceItem {
  const currency = getCurrency();
  let campaignName = 'Campaign';
  let imageUrl: string | undefined;

  try {
    if (typeof window !== 'undefined') {
      const campaignState = useCampaignStore.getState();
      const campaign = campaignState.data;

      if (campaign) {
        campaignName = campaign.name || 'Campaign';

        // Try to get image from campaign packages
        const packageId = item.packageId || item.package_id || item.id;
        if (packageId && campaign.packages) {
          const packageData = campaign.packages.find(
            (p: any) => p.ref_id === packageId || p.external_id === packageId
          );
          if (packageData?.image) {
            imageUrl = packageData.image;
          }
        }
      }
    }
  } catch (error) {
    logger.warn(
      'Could not access campaign store for item formatting:',
      error
    );
  }

  // Handle different item formats
  // Use product data instead of package data for consistent tracking
  let itemId: string = '';
  let itemName: string = '';
  let productId: string | undefined;
  let variantId: string | undefined;

  try {
    // Try to get product data from campaign store
    if (typeof window !== 'undefined') {
      const campaignState = useCampaignStore.getState();
      const campaign = campaignState.data;
      const packageId = item.packageId || item.package_id || item.id;

      if (packageId && campaign?.packages) {
        const packageData = campaign.packages.find(
          (p: any) =>
            String(p.ref_id) === String(packageId) ||
            String(p.external_id) === String(packageId)
        );

        if (packageData) {
          // Use product SKU as item_id (matches purchase event format)
          itemId =
            (packageData as any).product_sku || String(packageData.external_id);
          itemName = (packageData as any).product_name || packageData.name;
          productId = String((packageData as any).product_id || '');
          variantId = String((packageData as any).product_variant_id || '');
        } else {
          logger.warn(
            `Could not find package data for packageId: ${packageId}`,
            {
              packageId,
              availablePackages: campaign.packages.map((p: any) => ({
                ref_id: p.ref_id,
                name: p.name,
              })),
            }
          );
        }
      }
    }
  } catch (error) {
    logger.warn('Could not access campaign store for product data:', error);
  }

  // Fallback if campaign store lookup failed or variables not set
  if (!itemId) {
    itemId = String(item.packageId || item.package_id || item.id);
  }
  if (!itemName) {
    itemName =
      item.product?.title ||
      item.title ||
      item.product_title ||
      item.name ||
      `Package ${itemId}`;
  }

  // Get image from various possible sources
  if (!imageUrl) {
    imageUrl =
      (item as any).image ||
      (item as any).product?.image ||
      (item as any).imageUrl ||
      (item as any).image_url;
  }

  // Quantity = total product units across every package in this cart line.
  // `item.quantity` is the number of packages added; `qty` is the units per
  // package (e.g. 2 packages of a "3x Drone" pack => 6 units). The previous
  // implementation reported only `packageData.qty` and dropped the package
  // count entirely, so multi-package lines were undercounted.
  let unitsPerPackage = 1;
  try {
    if (typeof window !== 'undefined') {
      const campaignState = useCampaignStore.getState();
      const campaign = campaignState.data;
      const packageId = item.packageId || item.package_id || item.id;

      if (packageId && campaign?.packages) {
        const packageData = campaign.packages.find(
          (p: any) =>
            String(p.ref_id) === String(packageId) ||
            String(p.external_id) === String(packageId)
        );

        if (packageData?.qty) {
          unitsPerPackage = packageData.qty;
        }
      }
    }
  } catch (error) {
    logger.warn('Could not access campaign store for quantity:', error);
  }

  // Fall back to the units carried on the item when no package match was found.
  if (unitsPerPackage === 1 && typeof item.qty === 'number' && item.qty > 0) {
    unitsPerPackage = item.qty;
  }

  const packageCount =
    typeof item.quantity === 'number' && item.quantity > 0
      ? item.quantity
      : 1;
  const quantity = unitsPerPackage * packageCount;

  // Price = final per-unit price for this line, AFTER offer/voucher discounts.
  // GA4 `price` is the price of a single unit, so price * quantity equals the
  // line's final total. The cart store writes the calculated, discount-aware
  // figures onto each item (`unit_price`, `package_price`, `total`); prefer
  // them over the catalog price so discounts are reflected. Per unit they are
  // interchangeable:
  //   unit_price === package_price / unitsPerPackage === total / quantity
  const toNum = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  let price = 0;
  if (
    item.unit_price !== undefined &&
    item.unit_price !== null &&
    item.unit_price !== ''
  ) {
    price = toNum(item.unit_price);
  } else if (
    item.package_price !== undefined &&
    item.package_price !== null &&
    unitsPerPackage > 0
  ) {
    price = toNum(item.package_price) / unitsPerPackage;
  } else if (item.total !== undefined && item.total !== null && quantity > 0) {
    price = toNum(item.total) / quantity;
  }

  // No calculated figures on the line (e.g. read before cart calculation, or a
  // plain product / impression) — fall back to the catalog per-unit price.
  if (price === 0) {
    try {
      if (typeof window !== 'undefined') {
        const campaign = useCampaignStore.getState().data;
        const packageId = item.packageId || item.package_id || item.id;

        if (packageId && campaign?.packages) {
          const packageData = campaign.packages.find(
            (p: any) =>
              String(p.ref_id) === String(packageId) ||
              String(p.external_id) === String(packageId)
          );
          if (packageData?.price) {
            price = toNum(packageData.price); // catalog per-unit price
          }
        }
      }
    } catch (error) {
      logger.warn('Could not access campaign store for price:', error);
    }
  }

  // Last-resort fallbacks for non-cart item shapes.
  if (price === 0) {
    if (item.price_incl_tax) {
      price = toNum(item.price_incl_tax);
    } else if (item.price !== undefined && item.price !== null) {
      if (typeof item.price === 'object' && 'incl_tax' in item.price) {
        price = item.price.incl_tax?.value ?? 0;
      } else {
        price = toNum(item.price);
      }
    }
  }

  const ecommerceItem: EcommerceItem = {
    item_id: itemId,
    item_name: itemName,
    item_category: campaignName,
    price,
    quantity,
    currency,
  };

  // Per-unit discount (GA4 `discount`): the amount knocked off a single unit.
  // Prefer the offer discount (price before offers − final price); fall back to
  // the per-unit compare-at retail on the line, then to the campaign package's
  // catalog retail (mirrors how `price` falls back to the catalog price above).
  // `price` here is the final per-unit price, so this stays consistent with
  // price × quantity = line revenue. Omitted when there is no discount, so GA4
  // doesn't record a spurious 0.
  let priceBeforeDiscount =
    toNum((item as any).original_unit_price) || toNum((item as any).price_retail);
  if (priceBeforeDiscount === 0) {
    try {
      if (typeof window !== 'undefined') {
        const campaign = useCampaignStore.getState().data;
        const packageId = item.packageId || item.package_id || item.id;
        if (packageId && campaign?.packages) {
          const packageData = campaign.packages.find(
            (p: any) =>
              String(p.ref_id) === String(packageId) ||
              String(p.external_id) === String(packageId)
          );
          if ((packageData as any)?.price_retail) {
            priceBeforeDiscount = toNum((packageData as any).price_retail);
          }
        }
      }
    } catch (error) {
      logger.warn('Could not access campaign store for retail price:', error);
    }
  }
  if (priceBeforeDiscount > price) {
    ecommerceItem.discount = Math.round((priceBeforeDiscount - price) * 100) / 100;
  }

  // Add product_id and variant_id if available
  if (productId) {
    ecommerceItem.item_product_id = productId;
  }
  if (variantId) {
    ecommerceItem.item_variant_id = variantId;
  }

  // Add variant information - prefer product_variant_name over package_profile
  const variant =
    (item as any).product_variant_name ||
    (item as any).product?.variant?.name ||
    item.package_profile ||
    item.variant;
  if (variant !== undefined) {
    ecommerceItem.item_variant = variant;
  }

  // Add brand information (using product name as brand)
  const brand = (item as any).product_name || (item as any).product?.name;
  if (brand) {
    ecommerceItem.item_brand = brand;
  }

  // Add SKU as a custom dimension (can be tracked in GTM)
  const sku =
    (item as any).product_sku ||
    (item as any).product?.variant?.sku ||
    (item as any).sku;
  if (sku) {
    ecommerceItem.item_sku = sku;
  }

  if (index !== undefined) {
    ecommerceItem.index = index;
  }

  // Add list attribution if provided
  if (list?.id) {
    ecommerceItem.item_list_id = list.id;
  }
  if (list?.name) {
    ecommerceItem.item_list_name = list.name;
  }

  // Add image URL if available
  if (imageUrl) {
    ecommerceItem.item_image = imageUrl;
  }

  return ecommerceItem;
}
