/**
 * NextCommerce Campaign Cart SDK
 *
 * Modern TypeScript SDK for NextCommerce campaign landing pages. It wires plain
 * HTML to a cart / checkout / order API through progressive enhancement: markup
 * is annotated with `data-next-*` attributes and the SDK enhances it on load —
 * no manual wiring required.
 *
 * The bundle auto-initializes when the DOM is ready and exposes the
 * {@link NextCommerce} singleton on `window.next` for programmatic access. Queue
 * work that depends on initialization with `window.nextReady.push()` — it runs
 * immediately if the SDK is already initialized, otherwise as soon as it is.
 *
 * @example
 * Run code once the SDK has initialized:
 * ```ts
 * window.nextReady = window.nextReady || [];
 * window.nextReady.push(async (next) => {
 *   await next.addItem({ packageId: 2, quantity: 1 });
 *   console.log('Cart total:', next.getCartTotals().total);
 * });
 * ```
 *
 * @author NextCommerce
 * @license MIT
 * @packageDocumentation
 */

// Import styles
import './styles';

export { NextCommerce } from './core/NextCommerce';
export { SDKInitializer } from './enhancers/core/SDKInitializer';

// Store exports
export { useCartStore } from './stores/cartStore';
export { useCampaignStore } from './stores/campaignStore';
export { useConfigStore } from './stores/configStore';
export { useCheckoutStore } from './stores/checkoutStore';
export { useOrderStore } from './stores/orderStore';
// Type exports
export type * from './types/global';

// Store state/action types referenced by the exported store hooks,
// including the slice interfaces that compose the store types.
export type {
  CartStore,
  CartItemsSlice,
  CartUiSlice,
  CartApiSlice,
} from './stores/cartStore';
export type {
  CampaignStore,
  CampaignState,
  VariantGroup,
  CampaignItemsSlice,
  CampaignVariantsSlice,
  CampaignApiSlice,
} from './stores/campaignStore';
export type { CheckoutState } from './stores/checkoutStore';
export type { OrderState, OrderActions } from './stores/orderStore';

// API request/response types (parameter and return types of ApiClient) and
// campaign domain types (Offer and its sub-shapes), grouped under namespaces
// to avoid name collisions with the SDK-level types re-exported from
// ./types/global (e.g. Campaign, Package, ShippingOption).
export type * as ApiTypes from './types/api';
export type * as CampaignTypes from './types/campaign';

// Utility exports
export { Logger, LogLevel } from './utils/logger';
export { EventBus } from './utils/events';

// API client export
export { ApiClient } from './api/client';

// Version - use runtime detected version from loader, fallback to build-time version
declare global {
  interface Window {
    __NEXT_SDK_VERSION__?: string;
  }
}

export const VERSION = typeof window !== 'undefined' && window.__NEXT_SDK_VERSION__ 
  ? window.__NEXT_SDK_VERSION__ 
  : '__VERSION__';

// Auto-initialization
import { SDKInitializer } from './enhancers/core/SDKInitializer';

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      SDKInitializer.initialize();
    });
  } else {
    // DOM already loaded
    SDKInitializer.initialize();
  }
  
  // Smart module preloading after SDK initialization
  window.addEventListener('next:ready', () => {
    // Use requestIdleCallback for non-blocking preloading
    if ('requestIdleCallback' in window) {
      // Phase 1: Critical modules (preload immediately)
      requestIdleCallback(() => {
        // Cart enhancers - most commonly used
        import('./enhancers/cart/CartSummary');
        import('./enhancers/cart/PackageToggle');
        import('./enhancers/cart/PackageSelector');
        
        // Display enhancers
        import('./enhancers/display/ProductDisplayEnhancer');
        import('./enhancers/display/SelectionDisplayEnhancer');
        import('./enhancers/display/TimerEnhancer');
      }, { timeout: 5000 });
      
      // Phase 2: Secondary modules (preload after critical)
      requestIdleCallback(() => {
        // Checkout flow
        import('./enhancers/checkout/CheckoutFormEnhancer');
        import('./enhancers/checkout/ExpressCheckoutContainerEnhancer');

        // Order/Upsell
        import('./enhancers/display/OrderDisplayEnhancer');
        import('./enhancers/order/Upsell');

        // Attribution
        import('./utils/attribution/AttributionCollector');

        // Cart UI components
        import('./enhancers/cart/CartItemList');
        import('./enhancers/cart/QuantityControl');
      }, { timeout: 5000 });
      
      // Phase 3: Tertiary modules (preload when truly idle)
      requestIdleCallback(() => {
        // Less common enhancers
        import('./enhancers/ui/AccordionEnhancer');
        import('./enhancers/cart/CouponEnhancer');
        
        // Behavior enhancers
        import('./enhancers/behavior/SimpleExitIntentEnhancer');
        
      }, { timeout: 5000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        // Just preload critical modules
        import('./enhancers/cart/CartSummary');
        import('./enhancers/display/ProductDisplayEnhancer');
        import('./utils/analytics');
      }, 1000);
    }
  });
}