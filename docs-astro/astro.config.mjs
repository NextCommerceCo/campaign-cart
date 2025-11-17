// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [
      starlight({
          title: 'Campaign Cart JS SDK',
          description: 'Build powerful e-commerce funnels with HTML attributes',
          logo: {
              src: './src/assets/campaign-cart-logo.svg',
              replacesTitle: true,
          },
          social: [
              { icon: 'github', label: 'GitHub', href: 'https://github.com/NextCommerceCo/campaign-cart' },
          ],
          editLink: {
              baseUrl: 'https://github.com/NextCommerceCo/campaign-cart/edit/main/docs-astro/',
          },
          customCss: [
              // Path to Tailwind base styles:
              './src/styles/global.css',
              // Path to custom styles:
              './src/styles/custom.css'
          ],
          sidebar: [
              {
                  label: 'Start Here',
                  items: [
                      { label: 'Quick Start', slug: 'getting-started' },
                      { label: 'Installation', slug: 'getting-started/installation' },
                      { label: 'Your First Cart', slug: 'getting-started/first-cart' },
                      { label: 'Core Concepts', slug: 'getting-started/core-concepts' },
                  ],
              },
              {
                  label: 'Playground',
                  badge: 'Interactive',
                  slug: 'playground',
              },
              {
                  label: 'Data Attributes',
                  badge: 'Core',
                  items: [
                      { label: 'Complete Reference', slug: 'data-attributes' },
                      { label: 'Actions', slug: 'data-attributes/actions' },
                      { label: 'Display', slug: 'data-attributes/display' },
                      { label: 'State & Conditionals', slug: 'data-attributes/state' },
                      { label: 'Configuration', slug: 'data-attributes/configuration' },
                      { label: 'Order Data', slug: 'data-attributes/order-data' },
                      { label: 'URL Parameters', slug: 'data-attributes/url-parameters' },
                      { label: 'Checkout Review', slug: 'data-attributes/checkout-review' },
                      { label: 'Selection Attributes', slug: 'data-attributes/selection' },
                  ],
              },
              {
                  label: 'Building Blocks',
                  items: [
                      { label: 'Overview', slug: 'building-blocks' },
                      { label: 'Add to Cart', slug: 'building-blocks/add-to-cart' },
                      { label: 'Cart Display', slug: 'building-blocks/cart-display' },
                      { label: 'Quantity Controls', slug: 'building-blocks/quantity-controls' },
                      { label: 'Price Display', slug: 'building-blocks/price-display' },
                      { label: 'Product Selection', slug: 'building-blocks/product-selection' },
                      { label: 'Checkout Forms', slug: 'building-blocks/checkout-forms' },
                      { label: 'Upsells', slug: 'building-blocks/upsells' },
                      { label: 'Exit Intent', slug: 'building-blocks/exit-intent' },
                      { label: 'FOMO Notifications', slug: 'building-blocks/fomo-notifications' },
                  ],
              },
              {
                  label: 'Complete Flows',
                  items: [
                      { label: 'Overview', slug: 'complete-flows' },
                      { label: 'Product Page', slug: 'complete-flows/product-page' },
                      { label: 'Cart Drawer', slug: 'complete-flows/cart-drawer' },
                      { label: 'Checkout Flow', slug: 'complete-flows/checkout-flow' },
                      { label: 'Upsell Funnel', slug: 'complete-flows/upsell-funnel' },
                  ],
              },
              {
                  label: 'JavaScript API',
                  badge: 'Advanced',
                  items: [
                      { label: 'Overview', slug: 'javascript-api' },
                      { label: 'Cart Methods', slug: 'javascript-api/cart-methods' },
                      { label: 'Events', slug: 'javascript-api/events' },
                      { label: 'Callbacks', slug: 'javascript-api/callbacks' },
                  ],
              },
              {
                  label: 'Analytics',
                  items: [
                      { label: 'Overview', slug: 'analytics' },
                      { label: 'Configuration & Modes', slug: 'analytics/configuration' },
                      { label: 'Tracking API', slug: 'analytics/tracking-api' },
                      {
                          label: 'Providers',
                          items: [
                              { label: 'Overview', slug: 'analytics/providers' },
                              { label: 'Google Tag Manager', slug: 'analytics/providers/google-tag-manager' },
                              { label: 'Direct GA4', slug: 'analytics/providers/direct-ga4' },
                              { label: 'Facebook Pixel', slug: 'analytics/providers/facebook-pixel' },
                              { label: 'RudderStack', slug: 'analytics/providers/rudderstack' },
                              { label: 'Custom Webhook', slug: 'analytics/providers/custom-webhook' },
                          ],
                      },
                      { label: 'Event Reference', slug: 'analytics/events' },
                      { label: 'Custom Events', slug: 'analytics/custom-events' },
                      {
                          label: 'Advanced',
                          items: [
                              { label: 'Event Transformers', slug: 'analytics/advanced/event-transformers' },
                          ],
                      },
                      { label: 'Debugging', slug: 'analytics/debugging' },
                      { label: 'Best Practices', slug: 'analytics/best-practices' },
                  ],
              },
              {
                  label: 'Configuration',
                  items: [
                      { label: 'Overview', slug: 'configuration' },
                      { label: 'Configuration Reference', slug: 'configuration/configuration-reference' },
                      { label: 'Meta Tags', slug: 'configuration/meta-tags' },
                      { label: 'URL Parameters', slug: 'configuration/url-parameters' },
                      { label: 'Profiles & A/B Testing', slug: 'configuration/profiles' },
                      { label: 'Multi-Currency', slug: 'configuration/multi-currency' },
                      { label: 'Debugging', slug: 'configuration/debugging' },
                  ],
              },
              {
                  label: 'Reference',
                  collapsed: true,
                  items: [
                      { label: 'CSS Classes', slug: 'reference/css-classes' },
                      { label: 'Error Codes', slug: 'reference/error-codes' },
                      { label: 'Changelog', slug: 'reference/changelog' },
                  ],
              },
          ],
      }),
	],

  vite: {
    plugins: [tailwindcss()],
  },
});