/**
 * `NextCommerce`'s Campaign category — extracted verbatim from
 * `next-commerce.ts`. None of these read instance state (`this`), so every
 * function takes only its original arguments.
 */

import type { Campaign } from '@/types/global';
import { useCampaignStore } from '@/state/campaign';

/**
 * The loaded campaign (packages, currency, shipping methods), or `null` if it
 * hasn't loaded yet.
 * @category Campaign
 */
export function getCampaignData(): Campaign | null {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.data;
}

/**
 * Looks up a package by its `ref_id` in the loaded campaign.
 * @category Campaign
 */
export function getPackage(id: number): any | null {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.getPackage(id);
}

/**
 * All variant packages for a product id (variant selection support).
 * @category Campaign
 */
export function getVariantsByProductId(productId: number): any | null {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.getVariantsByProductId(productId);
}

/**
 * The distinct values available for one variant attribute (e.g. all sizes) of
 * a product — used to build variant pickers.
 * @category Campaign
 */
export function getAvailableVariantAttributes(
  productId: number,
  attributeCode: string
): string[] {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.getAvailableVariantAttributes(productId, attributeCode);
}

/**
 * Resolves the concrete package for a product given a full set of selected
 * variant attributes (e.g. `{ color: 'red', size: 'L' }`).
 * @category Campaign
 */
export function getPackageByVariantSelection(
  productId: number,
  selectedAttributes: Record<string, string>
): any | null {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.getPackageByVariantSelection(
    productId,
    selectedAttributes
  );
}

/**
 * Builds a stable, order-independent key from a set of variant attributes
 * (e.g. `color:red|size:L`) for use as a lookup/map key.
 * @category Campaign
 */
export function createVariantKey(attributes: Record<string, string>): string {
  // color:red|size:L — sorted so key order never matters
  return Object.entries(attributes)
    .map(([code, value]) => `${code}:${value}`)
    .sort()
    .join('|');
}
