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
export const useCampaignStore = campaignStoreInstance;
