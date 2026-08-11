/**
 * `SDKInitializer`'s `window.nextDebug` console surface — extracted verbatim from
 * `sdk-initializer.ts`. Not a boot step itself; runs from inside
 * `initializeDebugMode`, which stays on the class unchanged.
 */

import type { Logger } from '@/core/logger';
import { scopedKey } from '@/core/storage';
import type { AttributeScanner } from '@/core/attribute-scanner';
import { testModeManager } from '@/core/test-mode';
import { useCartStore, cartOperations } from '@/state/cart';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config';
import { useCheckoutStore } from '@/state/checkout';
import { useOrderStore } from '@/state/order';
import { useAttributionStore } from '@/state/attribution';
import { NextCommerce } from '@/core/next-commerce';

export function setupGlobalDebugUtils(ctx: {
  logger: Logger;
  reinitialize: () => Promise<void>;
  getInitializationStats: () => {
    initialized: boolean;
    retryAttempts: number;
    scannerStats?: ReturnType<AttributeScanner['getStats']>;
  };
}): void {
  if (typeof window !== 'undefined') {
    // Add global debug utilities to window for console access
    (window as any).nextDebug = {
      overlay: () =>
        import('@/core/debug/debug-overlay').then(m => m.debugOverlay),
      testMode: testModeManager,
      stores: {
        cart: useCartStore,
        campaign: useCampaignStore,
        config: useConfigStore,
        checkout: useCheckoutStore,
        order: useOrderStore,
        attribution: useAttributionStore,
      },
      sdk: NextCommerce.getInstance(),
      reinitialize: () => ctx.reinitialize(),
      getStats: () => ctx.getInitializationStats(),

      // Enhanced cart methods
      addToCart: (packageId: number, quantity: number = 1) => {
        const campaignStore = useCampaignStore.getState();
        const packageData = campaignStore.getPackage(packageId);

        if (packageData) {
          void cartOperations.addItem({
            packageId,
            quantity,
            price: parseFloat(packageData.price),
            title: packageData.name,
            isUpsell: false,
          });
        }
      },

      removeFromCart: (packageId: number) => {
        void cartOperations.removeItem(packageId);
      },

      updateQuantity: (packageId: number, quantity: number) => {
        void cartOperations.updateQuantity(packageId, quantity);
      },

      // Analytics methods (removed - will be combined with analytics below)

      // Campaign methods
      loadCampaign: () => {
        const configStore = useConfigStore.getState();
        return useCampaignStore.getState().loadCampaign(configStore.apiKey);
      },

      clearCampaignCache: () => {
        useCampaignStore.getState().clearCache();
      },

      getCacheInfo: () => {
        const info = useCampaignStore.getState().getCacheInfo();
        console.table(info);
        return info;
      },

      inspectPackage: (packageId: number) => {
        const campaignStore = useCampaignStore.getState();
        const packageData = campaignStore.getPackage(packageId);
        console.group(`📦 Package ${packageId} Details`);
        console.table(packageData);
        console.groupEnd();
      },

      testShippingMethod: async (methodId: number) => {
        console.log(`🚚 Testing shipping method ${methodId}`);
        try {
          const cartStore = useCartStore.getState();
          await cartOperations.setShippingMethod(methodId);
          console.log(`✅ Shipping method ${methodId} set successfully`);

          // Get the updated cart state to show the shipping cost
          const state = cartStore;
          const shippingMethod = state.shippingMethod;
          if (shippingMethod) {
            console.log(
              `📦 Shipping: ${shippingMethod.code} - $${shippingMethod.price}`
            );
          }

          // Trigger UI update
          document.dispatchEvent(new CustomEvent('debug:update-content'));
        } catch (error) {
          console.error(`❌ Failed to set shipping method ${methodId}:`, error);
        }
      },

      sortPackages: (sortBy: string) => {
        console.log(`🔄 Sorting packages by ${sortBy}`);
        // Trigger panel update with sorted packages
        document.dispatchEvent(new CustomEvent('debug:update-content'));
      },

      // Analytics utilities - lazy loaded to avoid blocking
      analytics: {
        getStatus: async () => {
          const { nextAnalytics } = await import('@/core/analytics/index');
          return nextAnalytics.getStatus();
        },
        getProviders: async () => {
          const { nextAnalytics } = await import('@/core/analytics/index');
          return nextAnalytics.getStatus().providers;
        },
        track: async (name: string, data: any) => {
          const { nextAnalytics } = await import('@/core/analytics/index');
          return nextAnalytics.track({ event: name, ...data });
        },
        setDebugMode: async (enabled: boolean) => {
          const { nextAnalytics } = await import('@/core/analytics/index');
          return nextAnalytics.setDebugMode(enabled);
        },
        invalidateContext: async () => {
          const { nextAnalytics } = await import('@/core/analytics/index');
          return nextAnalytics.invalidateContext();
        },
      },

      // Attribution utilities
      attribution: {
        debug: () => useAttributionStore.getState().debug(),
        get: () => useAttributionStore.getState().getAttributionForApi(),
        setFunnel: (funnel: string) =>
          useAttributionStore.getState().setFunnelName(funnel),
        setEvclid: (evclid: string) =>
          useAttributionStore.getState().setEverflowClickId(evclid),
        clearFunnel: () =>
          useAttributionStore.getState().clearPersistedFunnel(),
        getFunnel: () => {
          const state = useAttributionStore.getState();
          const persisted =
            localStorage.getItem(scopedKey('next_funnel_name')) ||
            sessionStorage.getItem(scopedKey('next_funnel_name'));
          console.log('Current funnel:', state.funnel);
          console.log('Persisted funnel:', persisted);
          return state.funnel || persisted || '(not set)';
        },
      },

      // Element highlighting
      highlightElement: (selector: string) => {
        ctx.logger.debug(`🎯 Highlighting element: ${selector}`);
        // TODO: Implement element highlighting in DebugOverlay
      },

      addTestItems: () => {
        [2, 7, 9].forEach(packageId => {
          void cartOperations.addItem({
            packageId,
            quantity: 1,
            price: 19.99,
            title: `Test Package ${packageId}`,
            isUpsell: false,
          });
        });
      },

      // Accordion utilities
      accordion: {
        open: (id: string) => {
          document.dispatchEvent(
            new CustomEvent('next:accordion-open', { detail: { id } })
          );
        },
        close: (id: string) => {
          document.dispatchEvent(
            new CustomEvent('next:accordion-close', { detail: { id } })
          );
        },
        toggle: (id: string) => {
          document.dispatchEvent(
            new CustomEvent('next:accordion-toggle', { detail: { id } })
          );
        },
      },

      // Order and upsell utilities
      order: {
        getJourney: () => {
          const orderStore = useOrderStore.getState();
          const journey = orderStore.getUpsellJourney();
          console.table(journey);
          return journey;
        },
        isExpired: () => useOrderStore.getState().isOrderExpired(),
        clearCache: () => {
          useOrderStore.getState().clearOrder();
          console.log('Order cache cleared');
        },
        getStats: () => {
          const orderStore = useOrderStore.getState();
          return {
            hasOrder: !!orderStore.order,
            refId: orderStore.refId,
            orderAge: orderStore.orderLoadedAt
              ? `${Math.floor((Date.now() - orderStore.orderLoadedAt) / 1000 / 60)} minutes`
              : 'N/A',
            viewedUpsells: orderStore.viewedUpsells,
            viewedUpsellPages: orderStore.viewedUpsellPages,
            completedUpsells: orderStore.completedUpsells,
            journeyLength: orderStore.upsellJourney.length,
          };
        },
      },
    };
  }
}
