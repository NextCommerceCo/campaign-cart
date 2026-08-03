/**
 * Event Builder — legacy Elevar formatting layer
 *
 * @deprecated Use `formatEcommerceItem` (`./ecommerce-item-formatter`) instead
 * for GA4 format. Kept for backward compatibility only.
 */

import type { ElevarProduct, ElevarImpression } from '../types';
import type { MinimalCartItem } from './event-builder.types';
import { createLogger } from '@/core/logger';
import { getCurrency } from './ecommerce-item-formatter';
import { getListAttribution } from './list-attribution-storage';

const logger = createLogger('EventBuilder');

/**
 * @deprecated Use formatEcommerceItem() instead for GA4 format
 * Format product for Elevar (matches their exact structure)
 * Kept for backward compatibility only
 */
export function formatElevarProduct(
  item: MinimalCartItem,
  index?: number
): ElevarProduct {
  const currency = getCurrency();
  let campaignName = 'Campaign';

  // Get campaign and package data
  let packageData: any = null;
  try {
    if (typeof window !== 'undefined') {
      const campaignStore = (window as any).campaignStore;
      if (campaignStore) {
        const campaign = campaignStore.getState().data;
        campaignName = campaign?.name || 'Campaign';

        // Find package data
        const packageId = item.packageId || item.package_id || item.id;
        if (packageId && campaign?.packages) {
          packageData = campaign.packages.find(
            (p: any) => String(p.ref_id) === String(packageId)
          );
        }
      }
    }
  } catch (error) {
    logger.warn('Could not access campaign store:', error);
  }

  // Get price value - handle various price formats
  let priceValue: number = 0;
  if (packageData?.price) {
    priceValue =
      typeof packageData.price === 'string'
        ? parseFloat(packageData.price)
        : packageData.price;
  } else if (item.price_incl_tax) {
    priceValue =
      typeof item.price_incl_tax === 'string'
        ? parseFloat(item.price_incl_tax)
        : item.price_incl_tax;
  } else if (item.price) {
    if (typeof item.price === 'object') {
      // Handle nested price structure
      if ('incl_tax' in item.price && item.price.incl_tax?.value) {
        priceValue = item.price.incl_tax.value;
      } else if ('excl_tax' in item.price && item.price.excl_tax?.value) {
        priceValue = item.price.excl_tax.value;
      } else if (
        'value' in item.price &&
        typeof item.price.value === 'number'
      ) {
        priceValue = item.price.value;
      }
    } else {
      priceValue =
        typeof item.price === 'string' ? parseFloat(item.price) : item.price;
    }
  }

  // Build Elevar product object with exact field names
  // Prioritize cart store fields (productName, variantSku, etc.) which are directly on the item
  const product: ElevarProduct = {
    // Use SKU as id (Elevar expects SKU here)
    id:
      item.variantSku ||
      item.sku ||
      item.product?.sku ||
      packageData?.product_sku ||
      `SKU-${item.packageId || item.id}`,

    name:
      item.productName ||
      item.product?.title ||
      packageData?.product_name ||
      item.title ||
      '',

    product_id: String(
      item.productId || packageData?.product_id || item.packageId || ''
    ),

    variant_id: String(item.variantId || packageData?.product_variant_id || ''),

    brand: item.productName || packageData?.product_name || campaignName,

    category: campaignName,

    variant:
      item.variantName ||
      packageData?.product_variant_name ||
      item.package_profile ||
      '',

    price: priceValue.toFixed(2), // Format as string with 2 decimals
    quantity: String(item.quantity || item.qty || 1),
  };

  // Add optional fields
  // Always add compare_at_price (use "0.0" if not available as per Elevar docs)
  let comparePrice = '0.0';
  if (item.price_retail) {
    comparePrice = String(item.price_retail);
  } else if (packageData?.price_retail) {
    comparePrice = String(packageData.price_retail);
  } else if (
    typeof item.price === 'object' &&
    item.price &&
    'original' in item.price &&
    item.price.original?.value
  ) {
    comparePrice = String(item.price.original.value);
  }
  product.compare_at_price = comparePrice;

  // Handle image from various sources
  if (item.image || packageData?.image || item.product?.image) {
    product.image = item.image || packageData?.image || item.product?.image || '';
  }

  // Add position (1-based for Elevar)
  if (index !== undefined) {
    product.position = index + 1;
  }

  // Add URL if this is add to cart
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  product.url = currentUrl;

  // Add list if available
  const list = getListAttribution();
  if (list?.name || list?.id) {
    product.list = list.name || list.id;
  }

  return product;
}

/**
 * @deprecated Use formatEcommerceItem() instead for GA4 format
 * Format impression for Elevar (similar to product but for list views)
 * Kept for backward compatibility only
 */
export function formatElevarImpression(
  item: MinimalCartItem,
  index?: number,
  list?: string
): ElevarImpression {
  const product = formatElevarProduct(item, index);

  // Create impression from product, excluding quantity and url
  const impression: ElevarImpression = {
    id: product.id,
    name: product.name,
    price: product.price,
    brand: product.brand,
    category: product.category,
    variant: product.variant,
  };

  // Add optional fields
  if (product.product_id) {
    impression.product_id = product.product_id;
  }
  if (product.variant_id) {
    impression.variant_id = product.variant_id;
  }
  if (product.image) {
    impression.image = product.image;
  }

  // Add list if provided
  if (list) {
    impression.list = list;
  } else if (product.list) {
    impression.list = product.list;
  }

  // Add position
  if (product.position) {
    impression.position = product.position;
  } else if (index !== undefined) {
    impression.position = index + 1;
  }

  return impression;
}
