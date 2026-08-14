/**
 * # Campaign Cart SDK
 *
 * The SDK that turns a plain HTML campaign page into a working cart and checkout.
 * You mark up your page with `data-next-*` attributes; the SDK finds them on load,
 * fetches the campaign, keeps the cart and its totals in sync, and runs the
 * checkout. There is no framework to adopt and no build step on your page: the
 * markup *is* the configuration.
 *
 * ```html
 * <head>
 *   <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
 *   <!-- plus the SDK loader script for your campaign -->
 * </head>
 * <body>
 *   <div data-next-package-selector data-next-selector-id="main">
 *     <div data-next-selector-card data-next-package-id="2">
 *       <span data-next-display="package.price">$0.00</span>
 *     </div>
 *   </div>
 *   <button data-next-action="add-to-cart" data-next-selector-id="main">Buy</button>
 * </body>
 * ```
 *
 * ## Where to go from here
 *
 * | You want to… | Start at |
 * |---|---|
 * | Boot the SDK on your first page | [Getting Started](../docs/guides/start-here/getting-started.md), then [How It Works](../docs/guides/start-here/how-it-works.md) |
 * | Build a funnel page end to end | [Checkout](../docs/guides/pages/checkout-page.md), [Upsell](../docs/guides/pages/upsell-page.md), [Receipt](../docs/guides/pages/receipt-page.md), or [Landing & Presell](../docs/guides/pages/landing-presell.md) |
 * | Look up a `data-next-*` attribute | [Data Attributes](../docs/guides/reference/data-attributes.md) |
 * | Call the SDK from your own JavaScript | [JavaScript API](../docs/guides/reference/javascript-api.md) |
 * | Understand or fix tracking | [Analytics Events](../docs/guides/reference/analytics-events.md) |
 * | Subscribe to an event | {@link EventMap} for every event name and its payload |
 *
 * ## The data types on this page
 *
 * Everything below is the SDK's **public type surface**: the objects you receive
 * in events, read from a store, or pass into a method. It is generated from the
 * source, so it matches the shipped code rather than describing it.
 *
 * - **Cart**: {@link CartItem}, {@link CartState}, {@link EnrichedCartLine},
 *   {@link ShippingMethod}, {@link Coupon}
 * - **Campaign**: {@link Campaign}, {@link Package}, {@link SelectorItem}
 * - **Checkout & order**: {@link CheckoutData}, {@link Order} (the placed order,
 *   with {@link OrderLine}, {@link OrderUser}, {@link OrderAddress}),
 *   {@link OrderData} (the guaranteed subset in the `order:completed` payload)
 * - **Events**: {@link EventMap}: every event name mapped to its payload type
 * - **Stores**: read live values through {@link useCartStore},
 *   {@link useCampaignStore}, {@link useCheckoutStore}, {@link useOrderStore},
 *   {@link useConfigStore}. The campaign store keeps its data on **`.data`**, not
 *   `.campaign`.
 * - **Version**: {@link VERSION}, the SDK build the page is running
 *
 * @packageDocumentation
 */

// Import styles
import './styles';

export { NextCommerce } from './core/next-commerce';
export { SDKInitializer } from '@/core/sdk-initializer';

// Store exports
export { useCartStore } from '@/state/cart';
export { useCampaignStore } from '@/state/campaign';
export { useConfigStore } from '@/state/config';
export { useCheckoutStore } from '@/state/checkout';
export { useOrderStore } from '@/state/order';
// Type exports
export type * from './types/global';
// The order types the API returns and the order store holds. `OrderData` (above)
// is only the guaranteed subset used to type the `order:completed` payload.
export type {
  Order,
  OrderLine,
  OrderLineProperty,
  OrderUser,
  OrderAddress,
  MarketingAttribution,
  // The ways an order can be paid for. Public because `Order.payment_method` and
  // `CheckoutPaymentMethod` are both written in terms of it.
  PaymentMethod,
} from './types/api';

// Utility exports
export { Logger } from './core/logger';
export { EventBus } from './core/events';

// API client export
export { ApiClient } from './api/client';

// Version - use runtime detected version from loader, fallback to build-time version
declare global {
  interface Window {
    __NEXT_SDK_VERSION__?: string;
  }
}

/**
 * The SDK version string. Resolves to the loader-injected runtime version
 * (`window.__NEXT_SDK_VERSION__`) when the loader sets it, otherwise the
 * build-time version baked in at compile.
 *
 * @example
 * ```ts
 * import { VERSION } from '@next-commerce/campaign-cart';
 * console.log(VERSION); // "0.4.30"
 * ```
 */
export const VERSION = typeof window !== 'undefined' && window.__NEXT_SDK_VERSION__
  ? window.__NEXT_SDK_VERSION__
  : __VERSION__;

// Auto-initialization
import { SDKInitializer } from '@/core/sdk-initializer';

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
        import('@/features/cart/cart-summary');
        import('@/features/cart/package-toggle');
        import('@/features/cart/package-selector');
        
        // Display enhancers
        import('@/features/display/product-display');
        import('@/features/display/selection-display');
        import('@/features/display/timer');
      }, { timeout: 5000 });
      
      // Phase 2: Secondary modules (preload after critical)
      requestIdleCallback(() => {
        // Checkout flow
        import('./features/checkout/checkout-form');
        import('./features/checkout/express-checkout-container');

        // Order/Upsell
        import('@/features/display/order-display');
        import('@/features/order/upsell');

        // Attribution
        import('@/core/attribution/attribution-collector');

        // Cart UI components
        import('@/features/cart/cart-item-list');
        import('@/features/cart/quantity-control');
      }, { timeout: 5000 });
      
      // Phase 3: Tertiary modules (preload when truly idle)
      requestIdleCallback(() => {
        // Less common enhancers
        import('@/features/ui/accordion');
        import('@/features/cart/coupon');
        
        // Behavior enhancers
        import('@/features/behavior/simple-exit-intent');
        
      }, { timeout: 5000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        // Just preload critical modules
        import('@/features/cart/cart-summary');
        import('@/features/display/product-display');
        import('./core/analytics');
      }, 1000);
    }
  });
}