import Decimal from 'decimal.js';
import { EventBus } from '@/core/events';
import { useCartStore } from '@/state/cart';
import { logger } from './shared';
import { calculateTotals } from './calculate-totals';

export async function setShippingMethod(methodId: number): Promise<void> {
  try {
    const { useCampaignStore } = await import('@/state/campaign');
    const { useCheckoutStore } = await import('@/state/checkout');

    const campaignStore = useCampaignStore.getState();
    const checkoutStore = useCheckoutStore.getState();
    const campaignData = campaignStore.data;

    if (!campaignData?.shipping_methods) {
      throw new Error('No shipping methods available');
    }

    const shippingMethod = campaignData.shipping_methods.find(
      method => method.ref_id === methodId
    );

    if (!shippingMethod) {
      throw new Error(`Shipping method ${methodId} not found`);
    }

    const price = new Decimal(shippingMethod.price ?? '0');

    useCartStore.setState(state => ({
      ...state,
      shippingMethod: {
        id: shippingMethod.ref_id,
        name: shippingMethod.code,
        code: shippingMethod.code,
        originalPrice: price,
        price,
        discountAmount: new Decimal(0),
        discountPercentage: new Decimal(0),
        hasDiscounts: false,
      },
    }));

    checkoutStore.setShippingMethod({
      id: shippingMethod.ref_id,
      name: shippingMethod.code,
      price: price.toNumber(),
      code: shippingMethod.code,
    });

    calculateTotals();

    EventBus.getInstance().emit('shipping:method-changed', {
      methodId,
      method: shippingMethod,
    });
  } catch (error) {
    logger.error('Failed to set shipping method:', error);
    throw error;
  }
}
