import type { CartItem } from '@/types/global';
import { EventBus } from '@/core/events';
import { useCartStore } from '@/state/cart';
import { logger, optimisticTotals } from './shared';
import { calculateTotals } from './calculate-totals';

export async function addItem(
  item: Partial<CartItem> & { isUpsell: boolean | undefined }
): Promise<void> {
  const { useCampaignStore } = await import('@/state/campaign');
  const campaignStore = useCampaignStore.getState();

  const finalPackageId = item.packageId ?? 0;
  const packageData = campaignStore.getPackage(finalPackageId);
  if (!packageData) {
    throw new Error(`Package ${finalPackageId} not found in campaign data`);
  }

  useCartStore.setState(state => {
    const newItem: CartItem = {
      id: Date.now(),
      packageId: finalPackageId,
      originalPackageId: item.originalPackageId,
      quantity: item.quantity ?? 1,
      price: parseFloat(packageData.price_total),
      title: item.title ?? packageData.name,
      is_upsell: item.isUpsell ?? false,
      image: item.image ?? packageData.image ?? undefined,
      sku: item.sku ?? packageData.product_sku ?? undefined,
      price_per_unit: packageData.price,
      qty: packageData.qty,
      price_total: packageData.price_total,
      price_retail: packageData.price_retail,
      price_retail_total: packageData.price_retail_total,
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
    };

    if (item.isUpsell) {
      logger.debug('Adding upsell item:', {
        packageId: newItem.packageId,
        isUpsell: item.isUpsell,
        finalItemIsUpsell: newItem.is_upsell,
        itemData: newItem,
      });
    }

    const existingIndex = state.items.findIndex(
      existing => existing.packageId === newItem.packageId
    );

    let newItems;
    if (existingIndex >= 0) {
      newItems = [...state.items];
      newItems[existingIndex]!.quantity += newItem.quantity;
    } else {
      newItems = [...state.items, newItem];
    }

    return { ...state, items: newItems, ...optimisticTotals(newItems) };
  });

  EventBus.getInstance().emit('cart:item-added', {
    packageId: item.packageId ?? 0,
    quantity: item.quantity ?? 1,
  });
  calculateTotals();
}
