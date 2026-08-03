/**
 * `NextCommerce`'s Shipping category — extracted verbatim from
 * `next-commerce.ts`. None of these read instance state (`this`).
 */

import { useCheckoutStore } from '@/state/checkout';
import { useCampaignStore } from '@/state/campaign';
import { cartOperations } from '@/state/cart';

export function getShippingMethods(): Array<{
  ref_id: number;
  code: string;
  price: string;
}> {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.data?.shipping_methods || [];
}

export function getSelectedShippingMethod(): {
  id: number;
  name: string;
  price: number;
  code: string;
} | null {
  const checkoutStore = useCheckoutStore.getState();
  return checkoutStore.shippingMethod || null;
}

export async function setShippingMethod(methodId: number): Promise<void> {
  // Delegate to the cart operation which handles validation and syncing
  await cartOperations.setShippingMethod(methodId);
}
