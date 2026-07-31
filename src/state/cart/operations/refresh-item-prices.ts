import Decimal from 'decimal.js';
import { useCartStore } from '@/state/cart';
import { logger } from './shared';
import { calculateTotals } from './calculate-totals';

export async function refreshItemPrices(): Promise<void> {
  try {
    logger.info('Refreshing cart item prices with new currency data...');

    const { useCampaignStore } = await import('@/state/campaign');
    const campaignStore = useCampaignStore.getState();

    if (!campaignStore.data) {
      logger.warn('No campaign data available to refresh prices');
      return;
    }

    const state = useCartStore.getState();

    const updatedItems = state.items.map(item => {
      const packageData = campaignStore.getPackage(item.packageId);
      if (!packageData) {
        logger.warn(`Package ${item.packageId} not found in campaign data`);
        return item;
      }
      return {
        ...item,
        price: parseFloat(packageData.price_total),
        price_per_unit: packageData.price,
        price_total: packageData.price_total,
        price_retail: packageData.price_retail,
        price_retail_total: packageData.price_retail_total,
        price_recurring: packageData.price_recurring,
        productId: item.productId ?? packageData.product_id,
        productName: item.productName ?? packageData.product_name,
        variantId: item.variantId ?? packageData.product_variant_id,
        variantName: item.variantName ?? packageData.product_variant_name,
        variantAttributes:
          item.variantAttributes ??
          packageData.product_variant_attribute_values,
        variantSku: item.variantSku ?? packageData.product_sku ?? undefined,
      };
    });

    let updatedShippingMethod = state.shippingMethod;
    if (updatedShippingMethod && campaignStore.data.shipping_methods) {
      const shippingMethodData = campaignStore.data.shipping_methods.find(
        method => method.ref_id === updatedShippingMethod!.id
      );
      if (shippingMethodData) {
        const newPrice = new Decimal(shippingMethodData.price ?? '0');
        updatedShippingMethod = {
          ...updatedShippingMethod,
          price: newPrice,
          originalPrice: newPrice,
        };
        logger.info(
          `Updated shipping method price: ${updatedShippingMethod.code} = ${newPrice.toNumber()} ${campaignStore.currency ?? ''}`
        );
      }
    }

    useCartStore.setState(state => ({
      ...state,
      items: updatedItems,
      shippingMethod: updatedShippingMethod,
    }));

    logger.info('Cart item prices and shipping refreshed with new currency');

    calculateTotals();
  } catch (error) {
    logger.error('Failed to refresh item prices:', error);
  }
}
