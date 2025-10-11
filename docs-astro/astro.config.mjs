// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'introduction' },
						{ label: 'Quick Start', slug: 'quick-start' },
						{ label: 'Installation', slug: 'installation' },
						{ label: 'Your First Product Page', slug: 'first-product-page' },
					],
				},
				{
					label: 'Interactive Examples',
					badge: { text: 'Live', variant: 'success' },
					items: [
						{ label: 'Playground', slug: 'playground' },
						{ label: 'Product Pages', slug: 'examples/product-pages' },
						{ label: 'Cart Systems', slug: 'examples/cart-systems' },
						{ label: 'Checkout Flows', slug: 'examples/checkout-flows' },
						{ label: 'Upsell Funnels', slug: 'examples/upsell-funnels' },
					],
				},
				{
					label: 'Core Features',
					items: [
						{ label: 'Cart System', slug: 'features/cart-system' },
						{ label: 'Product Selection', slug: 'features/product-selection' },
						{ label: 'Dynamic Pricing', slug: 'features/dynamic-pricing' },
						{ label: 'Upsells & Cross-sells', slug: 'features/upsells' },
						{ label: 'Checkout Integration', slug: 'features/checkout' },
					],
				},
				{
					label: 'Components',
					items: [
						{ label: 'Buttons & Actions', slug: 'components/buttons' },
						{ label: 'Display Elements', slug: 'components/display' },
						{ label: 'Form Components', slug: 'components/forms' },
						{ label: 'Quantity Controls', slug: 'components/quantity' },
						{ label: 'Conditional Display', slug: 'components/conditionals' },
					],
				},
				{
					label: 'Configuration',
					items: [
						{ label: 'API Setup', slug: 'config/api-setup' },
						{ label: 'Meta Tags', slug: 'config/meta-tags' },
						{ label: 'URL Parameters', slug: 'config/url-parameters' },
						{ label: 'Advanced Options', slug: 'config/advanced' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'Methods', slug: 'api/methods' },
						{ label: 'Events', slug: 'api/events' },
						{ label: 'Data Attributes', slug: 'api/attributes' },
						{ label: 'CSS Classes', slug: 'api/css-classes' },
						{ label: 'Callbacks', slug: 'api/callbacks' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Best Practices', slug: 'guides/best-practices' },
						{ label: 'Performance', slug: 'guides/performance' },
						{ label: 'Accessibility', slug: 'guides/accessibility' },
						{ label: 'Migration Guide', slug: 'guides/migration' },
						{ label: 'Troubleshooting', slug: 'guides/troubleshooting' },
					],
				},
			],
		}),
	],
});
