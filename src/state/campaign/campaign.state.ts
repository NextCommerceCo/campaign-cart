import { create } from 'zustand';
import type { CampaignStore } from './campaign.types';
import {
  createCampaignItemsSlice,
  initialCampaignState,
} from './items.slice';
import { createCampaignVariantsSlice } from './variants.slice';
import { createCampaignApiSlice } from './api.slice';

const campaignStoreInstance = create<CampaignStore>()((set, get, store) => ({
  ...initialCampaignState,
  ...createCampaignItemsSlice(set, get, store),
  ...createCampaignVariantsSlice(set, get, store),
  ...createCampaignApiSlice(set, get, store),
}));

export const campaignStore = campaignStoreInstance;
/**
 * The campaign store. The loaded {@link index.Campaign | Campaign} lives on its
 * **`.data`** field
 * (not `.campaign`) — `useCampaignStore.getState().data`. Read it for packages,
 * pricing currency, and shipping options.
 *
 * @example
 * ```ts
 * const campaign = useCampaignStore.getState().data;
 * const pkg = campaign?.packages.find(p => p.ref_id === 2);
 * ```
 */
export const useCampaignStore = campaignStoreInstance;
