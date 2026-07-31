import type { CartItem } from '@/types/global';
import { useCartStore } from '@/state/cart';
import { logger, optimisticTotals } from './shared';
import { calculateTotals } from './calculate-totals';

export async function swapCart(
  items: Array<{
    packageId: number;
    quantity: number;
    properties?: Record<string, string>;
  }>
): Promise<void> {
  const { useCampaignStore } = await import('@/state/campaign');
  const campaignStore = useCampaignStore.getState();

  logger.debug('Swapping cart with new items:', items);

  useCartStore.setState(state => ({ ...state, swapInProgress: true }));

  const newItems: CartItem[] = [];

  for (const item of items) {
    const finalPackageId = item.packageId;
    const originalPackageId = (item as any).originalPackageId;

    const packageData = campaignStore.getPackage(finalPackageId);
    if (!packageData) {
      logger.warn(
        `Package ${finalPackageId} not found in campaign data, skipping`
      );
      logger.debug(
        'Available packages:',
        campaignStore.data?.packages?.map(p => p.ref_id)
      );
      continue;
    }

    logger.debug(`Package ${finalPackageId} found:`, packageData);

    newItems.push({
      id: Date.now() + Math.random(),
      packageId: finalPackageId,
      originalPackageId,
      title: packageData.name || `Package ${finalPackageId}`,
      price: parseFloat(packageData.price_total),
      price_retail: packageData.price_retail,
      quantity: item.quantity,
      is_upsell: (item as any).isUpsell ?? false,
      selectorId: (item as any).selectorId,
      image: packageData.image,
      sku: packageData.product_sku ?? undefined,
      qty: packageData.qty,
      price_total: packageData.price_total,
      price_retail_total: packageData.price_retail_total,
      price_per_unit: packageData.price,
      price_recurring: packageData.price_recurring,
      is_recurring: packageData.is_recurring,
      interval: packageData.interval,
      interval_count: packageData.interval_count,
      productId: packageData.product_id,
      productName: packageData.product_name,
      variantId: packageData.product_variant_id,
      variantName: packageData.product_variant_name,
      variantAttributes: packageData.product_variant_attribute_values,
      variantSku: packageData.product_sku ?? undefined,
      ...(item.properties !== undefined && { properties: item.properties }),
    });
  }

  useCartStore.setState(state => ({
    ...state,
    items: newItems,
    swapInProgress: false,
    ...optimisticTotals(newItems),
  }));
  calculateTotals();

  logger.info(`Cart swapped successfully with ${newItems.length} items`);
}
