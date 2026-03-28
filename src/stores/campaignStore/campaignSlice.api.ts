import type { StateCreator } from 'zustand';
import { sessionStorageManager, CAMPAIGN_STORAGE_KEY } from '@/utils/storage';
import { createLogger } from '@/utils/logger';
import type {
  CampaignApiSlice,
  CampaignStore,
  CachedCampaignData,
} from './campaignStore.types';

const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const logger = createLogger('CampaignStore');

export const createCampaignApiSlice: StateCreator<
  CampaignStore,
  [],
  [],
  CampaignApiSlice
> = (set, get) => ({
  loadCampaign: async (
    apiKey: string,
    options?: { forceFresh?: boolean }
  ) => {
    set({ isLoading: true, error: null });

    try {
      const { useConfigStore } = await import('@/stores/configStore');
      const configStore = useConfigStore.getState();
      const requestedCurrency =
        configStore.selectedCurrency ?? configStore.detectedCurrency ?? 'USD';

      const now = Date.now();
      const requestedCacheKey = `${CAMPAIGN_STORAGE_KEY}_${requestedCurrency}`;
      const fallbackCacheKey = `${CAMPAIGN_STORAGE_KEY}_USD`;

      const urlParams = new URLSearchParams(window.location.search);
      const urlCurrency = urlParams.get('currency');
      const isUrlCurrencyOverride =
        urlCurrency != null && urlCurrency === requestedCurrency;

      const forceFresh = options?.forceFresh ?? false;

      let cachedData =
        sessionStorageManager.get<CachedCampaignData>(requestedCacheKey);

      // Check USD cache as potential fallback when no entry exists for the
      // requested currency, unless URL or user is forcing a specific currency.
      if (
        !cachedData &&
        requestedCurrency !== 'USD' &&
        !isUrlCurrencyOverride &&
        !forceFresh
      ) {
        cachedData =
          sessionStorageManager.get<CachedCampaignData>(fallbackCacheKey);

        if (cachedData) {
          logger.info(
            `No cache for ${requestedCurrency}, checking USD cache as potential fallback`
          );
        }
      }

      if (forceFresh && cachedData) {
        logger.info(
          `Force fresh fetch requested, skipping cache for ${requestedCurrency}`
        );
        cachedData = undefined;
      }

      // Use cache if valid and matches the requested currency (or no URL override)
      if (
        cachedData &&
        cachedData.apiKey === apiKey &&
        now - cachedData.timestamp < CACHE_EXPIRY_MS &&
        (!isUrlCurrencyOverride ||
          cachedData.campaign.currency === requestedCurrency)
      ) {
        const cachedCurrency = cachedData.campaign.currency;
        logger.info(
          `Using cached campaign data for ${cachedCurrency} (expires in ` +
            Math.round(
              (CACHE_EXPIRY_MS - (now - cachedData.timestamp)) / 1000
            ) +
            ' seconds)'
        );

        if (cachedCurrency !== requestedCurrency) {
          logger.warn(
            `Requested ${requestedCurrency} but using cached ${cachedCurrency} (fallback)`
          );
          configStore.updateConfig({
            selectedCurrency: cachedCurrency,
            currencyFallbackOccurred: true,
          });
          sessionStorage.setItem('next_selected_currency', cachedCurrency);

          const { EventBus } = await import('@/utils/events');
          EventBus.getInstance().emit('currency:fallback', {
            requested: requestedCurrency,
            actual: cachedCurrency,
            reason: 'cached',
          });
        }

        if (cachedData.campaign.payment_env_key) {
          configStore.setSpreedlyEnvironmentKey(
            cachedData.campaign.payment_env_key
          );
        }

        const processedPackages = get().processPackagesWithVariants(
          cachedData.campaign.packages
        );

        set({
          data: { ...cachedData.campaign, packages: processedPackages },
          currency: cachedData.campaign.currency,
          packages: processedPackages,
          isLoading: false,
          error: null,
          isFromCache: true,
          cacheAge: now - cachedData.timestamp,
        });
        return;
      }

      if (
        isUrlCurrencyOverride &&
        cachedData?.campaign.currency !== requestedCurrency
      ) {
        logger.info(
          `URL parameter forcing fresh fetch for currency: ${requestedCurrency}` +
            ` (cache had ${cachedData?.campaign.currency ?? 'none'})`
        );
      }

      logger.info(
        `Fetching campaign data from API with currency: ${requestedCurrency}...`
      );

      const { ApiClient } = await import('@/api/client');
      const client = new ApiClient(apiKey);
      const campaign = await client.getCampaigns(requestedCurrency);

      if (!campaign) {
        throw new Error('Campaign data not found');
      }

      const actualCurrency = campaign.currency ?? requestedCurrency;

      if (actualCurrency !== requestedCurrency) {
        logger.warn(
          `API Fallback: Requested ${requestedCurrency}, received ${actualCurrency}`
        );
        configStore.updateConfig({
          selectedCurrency: actualCurrency,
          currencyFallbackOccurred: true,
        });
        sessionStorage.setItem('next_selected_currency', actualCurrency);

        const { EventBus } = await import('@/utils/events');
        EventBus.getInstance().emit('currency:fallback', {
          requested: requestedCurrency,
          actual: actualCurrency,
          reason: 'api',
        });
      } else {
        configStore.updateConfig({ currencyFallbackOccurred: false });
      }

      if (campaign.payment_env_key) {
        configStore.setSpreedlyEnvironmentKey(campaign.payment_env_key);
        logger.info(
          'Spreedly environment key updated from campaign API: ' +
            campaign.payment_env_key
        );
      }

      const processedPackages = get().processPackagesWithVariants(
        campaign.packages
      );

      const actualCacheKey = `${CAMPAIGN_STORAGE_KEY}_${actualCurrency}`;
      const cacheData: CachedCampaignData = {
        campaign: { ...campaign, packages: processedPackages },
        timestamp: now,
        apiKey,
      };

      sessionStorageManager.set(actualCacheKey, cacheData);
      logger.info(`Campaign data cached for ${actualCurrency} (10 minutes)`);

      if (actualCurrency !== requestedCurrency) {
        sessionStorage.removeItem(requestedCacheKey);
        logger.debug(`Cleared invalid cache for ${requestedCurrency}`);
      }

      set({
        data: { ...campaign, packages: processedPackages },
        currency: actualCurrency,
        packages: processedPackages,
        isLoading: false,
        error: null,
        isFromCache: false,
        cacheAge: 0,
      });

      // Refresh cart prices if currency changed
      const { useCartStore } = await import('@/stores/cartStore');
      const cartStore = useCartStore.getState();
      if (
        !cartStore.isEmpty &&
        cartStore.lastCurrency &&
        cartStore.lastCurrency !== actualCurrency
      ) {
        logger.info('Currency changed, refreshing cart prices...');
        await cartStore.refreshItemPrices();
        cartStore.setLastCurrency(actualCurrency);
      } else if (!cartStore.lastCurrency) {
        cartStore.setLastCurrency(actualCurrency);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load campaign';
      set({
        data: null,
        packages: [],
        isLoading: false,
        error: errorMessage,
      });
      logger.error('Campaign load failed:', error);
      throw error;
    }
  },
});
