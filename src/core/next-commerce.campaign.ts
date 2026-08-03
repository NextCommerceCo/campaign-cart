/**
 * `NextCommerce`'s Campaign category — extracted verbatim from
 * `next-commerce.ts`. None of these read instance state (`this`), so every
 * function takes only its original arguments.
 */

import type { Campaign } from '@/types/global';
import { useCampaignStore } from '@/state/campaign';

export function getCampaignData(): Campaign | null {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.data;
}

export function getPackage(id: number): any | null {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.getPackage(id);
}

export function getVariantsByProductId(productId: number): any | null {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.getVariantsByProductId(productId);
}

export function getAvailableVariantAttributes(
  productId: number,
  attributeCode: string
): string[] {
  const campaignStore = useCampaignStore.getState();
  return campaignStore.getAvailableVariantAttributes(productId, attributeCode);
}

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

export function createVariantKey(attributes: Record<string, string>): string {
  // color:red|size:L — sorted so key order never matters
  return Object.entries(attributes)
    .map(([code, value]) => `${code}:${value}`)
    .sort()
    .join('|');
}
