import type { CartItem } from '@/types/global';
import { EventBus } from '@/core/events';
import { useCartStore } from '@/state/cart';
import { optimisticTotals } from './shared';
import { calculateTotals } from './calculate-totals';

export async function swapPackage(
  removePackageId: number,
  addItem: Partial<CartItem> & { isUpsell: boolean | undefined }
): Promise<void> {
  const { useCampaignStore } = await import('@/state/campaign');
  const campaignStore = useCampaignStore.getState();

  const finalPackageId = addItem.packageId ?? 0;
  const newPackageData = campaignStore.getPackage(finalPackageId);
  if (!newPackageData) {
    throw new Error(`Package ${finalPackageId} not found in campaign data`);
  }

  const previousItem = useCartStore
    .getState()
    .items.find(item => item.packageId === removePackageId);

  const newItem: CartItem = {
    id: Date.now(),
    packageId: finalPackageId,
    originalPackageId: undefined,
    quantity: addItem.quantity ?? 1,
    price: parseFloat(newPackageData.price_total),
    title: addItem.title ?? newPackageData.name,
    is_upsell: addItem.isUpsell ?? false,
    image: addItem.image ?? newPackageData.image ?? undefined,
    sku: addItem.sku ?? newPackageData.product_sku ?? undefined,
    price_per_unit: newPackageData.price,
    qty: newPackageData.qty,
    price_total: newPackageData.price_total,
    price_retail: newPackageData.price_retail,
    price_retail_total: newPackageData.price_retail_total,
    price_recurring: newPackageData.price_recurring,
    is_recurring: newPackageData.is_recurring,
    interval: newPackageData.interval,
    interval_count: newPackageData.interval_count,
    productId: newPackageData.product_id,
    productName: newPackageData.product_name,
    variantId: newPackageData.product_variant_id,
    variantName: newPackageData.product_variant_name,
    variantAttributes: newPackageData.product_variant_attribute_values,
    variantSku: newPackageData.product_sku ?? undefined,
    ...(previousItem?.properties !== undefined && {
      properties: previousItem.properties,
    }),
  };

  const priceDifference = newItem.price - (previousItem?.price ?? 0);

  useCartStore.setState(state => {
    const newItems = state.items.filter(
      item => item.packageId !== removePackageId
    );

    const existingIndex = newItems.findIndex(
      existing => existing.packageId === newItem.packageId
    );

    if (existingIndex >= 0) {
      newItems[existingIndex]!.quantity += newItem.quantity;
    } else {
      newItems.push(newItem);
    }

    return {
      ...state,
      items: newItems,
      swapInProgress: false,
      ...optimisticTotals(newItems),
    };
  });

  const eventBus = EventBus.getInstance();
  const swapEvent: Parameters<typeof eventBus.emit<'cart:package-swapped'>>[1] =
    {
      previousPackageId: removePackageId,
      newPackageId: finalPackageId,
      newItem,
      priceDifference,
      source: 'package-selector',
    };

  if (previousItem) {
    swapEvent.previousItem = previousItem;
  }

  eventBus.emit('cart:package-swapped', swapEvent);
  calculateTotals();
}
