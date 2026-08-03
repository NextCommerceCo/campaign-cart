/**
 * `NextCommerce`'s Shipping category — extracted verbatim from
 * `next-commerce.ts`. None of these read instance state (`this`).
 */

import { useCheckoutStore } from '@/state/checkout';
import { useCampaignStore } from '@/state/campaign';
import { cartOperations } from '@/state/cart';

/** One shipping method offered by the loaded campaign. */
export interface ShippingMethodInfo {
  ref_id: number;
  code: string;
  price: string;
}

/** The shipping method chosen for the current checkout. */
export interface SelectedShippingMethod {
  id: number;
  name: string;
  price: number;
  code: string;
}

/**
 * All shipping methods available in the loaded campaign.
 * @category Shipping
 */
export function getShippingMethods(): ShippingMethodInfo[] {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.data?.shipping_methods || [];
}

/**
 * The currently selected shipping method, or `null` if none chosen yet.
 * @category Shipping
 */
export function getSelectedShippingMethod(): SelectedShippingMethod | null {
  const checkoutStore = useCheckoutStore.getState();
  return checkoutStore.shippingMethod || null;
}

/**
 * Selects a shipping method by id and recalculates cart totals. Throws if the
 * id isn't in the campaign's shipping methods.
 * @category Shipping
 */
export async function setShippingMethod(methodId: number): Promise<void> {
  // Delegate to the cart operation which handles validation and syncing
  await cartOperations.setShippingMethod(methodId);
}
