import { create } from 'zustand';
import type { CampaignStore } from './campaignStore.types';
import {
  createCampaignItemsSlice,
  initialCampaignState,
} from './campaignSlice.items';
import { createCampaignVariantsSlice } from './campaignSlice.variants';
import { createCampaignApiSlice } from './campaignSlice.api';

const campaignStoreInstance = create<CampaignStore>()((set, get, store) => ({
  ...initialCampaignState,
  ...createCampaignItemsSlice(set, get, store),
  ...createCampaignVariantsSlice(set, get, store),
  ...createCampaignApiSlice(set, get, store),
}));

export const campaignStore = campaignStoreInstance;

/**
 * Zustand store holding the loaded campaign and its packages, products,
 * variants, offers, and shipping methods. Backed by a short-lived cache.
 *
 * The campaign payload lives on the `data` field — not `campaign`. Use the
 * lookup helpers (`getPackage`, `getVariantsByProductId`, …) rather than
 * indexing `data` directly.
 *
 * @example
 * ```ts
 * const campaign = useCampaignStore.getState().data;
 * const pkg = useCampaignStore.getState().getPackage(2);
 * ```
 *
 * @see {@link CampaignStore} for the full state and action shape.
 */
export const useCampaignStore = campaignStoreInstance;
