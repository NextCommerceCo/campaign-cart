import type { StateCreator } from 'zustand';
import type { Package, Product } from '@/types/campaign';
import { sessionStorageManager, CAMPAIGN_STORAGE_KEY } from '@/utils/storage';
import { createLogger } from '@/utils/logger';
import type {
  CampaignItemsSlice,
  CampaignStore,
  CachedCampaignData,
  CampaignState,
} from './campaignStore.types';

const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const logger = createLogger('CampaignStore');

export const initialCampaignState: CampaignState = {
  data: null,
  currency: null,
  packages: [],
  isLoading: false,
  error: null,
};

export const createCampaignItemsSlice: StateCreator<
  CampaignStore,
  [],
  [],
  CampaignItemsSlice
> = (set, get) => ({
  processPackagesWithVariants: (packages: Package[]): Package[] => {
    return packages.map(pkg => {
      if (pkg.product_id && pkg.product_variant_id) {
        const product: Product = {
          id: pkg.product_id,
          name: pkg.product_name ?? '',
          variant: {
            id: pkg.product_variant_id,
            name: pkg.product_variant_name ?? '',
            attributes: pkg.product_variant_attribute_values ?? [],
            sku: pkg.product_sku,
          },
          purchase_availability:
            pkg.product_purchase_availability ?? 'available',
          inventory_availability:
            pkg.product_inventory_availability ?? 'untracked',
        };
        return { ...pkg, product };
      }
      return pkg;
    });
  },

  getPackage: (id: number) =>
    get().packages.find(pkg => pkg.ref_id === id) ?? null,

  getProduct: (id: number) => get().getPackage(id),

  setError: (error: string | null) => set({ error }),

  reset: () => set(initialCampaignState),

  clearCache: () => {
    try {
      const storage = window.sessionStorage;
      const keysToRemove: string[] = [];

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (
          key &&
          (key.startsWith(CAMPAIGN_STORAGE_KEY) || key === CAMPAIGN_STORAGE_KEY)
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        sessionStorageManager.remove(key);
        logger.debug(`Removed cache: ${key}`);
      });

      logger.info(
        `Campaign cache cleared (${keysToRemove.length} entries removed)`
      );
    } catch (error) {
      logger.error('Failed to clear campaign cache:', error);
      // Fallback: clear known currencies
      const currencies = [
        'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'BRL', 'MXN', 'INR',
      ];
      currencies.forEach(c => {
        sessionStorageManager.remove(`${CAMPAIGN_STORAGE_KEY}_${c}`);
      });
      sessionStorageManager.remove(CAMPAIGN_STORAGE_KEY);
    }
  },

  getCacheInfo: () => {
    // Use the currently loaded campaign's currency to find its cache entry.
    // Falls back to USD if no campaign is loaded yet.
    const currency = get().currency ?? 'USD';
    const cacheKey = `${CAMPAIGN_STORAGE_KEY}_${currency}`;
    const cachedData =
      sessionStorageManager.get<CachedCampaignData>(cacheKey);

    if (!cachedData) {
      return { cached: false };
    }

    const now = Date.now();
    const timeLeft = CACHE_EXPIRY_MS - (now - cachedData.timestamp);

    return {
      cached: true,
      expiresIn: Math.max(0, Math.round(timeLeft / 1000)),
      apiKey: cachedData.apiKey,
      currency,
    };
  },
});
