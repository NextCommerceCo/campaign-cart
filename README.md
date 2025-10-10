# Next Commerce Cart SDK

A modern, TypeScript-based e-commerce cart SDK that seamlessly integrates with NextCommerce to provide enhanced cart functionality, comprehensive analytics, and powerful debugging tools.

## What is Campaign Cart?

Campaign Cart is a JavaScript SDK that complements [NextCommerce](https://nextcommerce.com) by providing advanced cart management, checkout flows, and upsell capabilities directly in your campaign pages. It enables you to create high-converting sales funnels with built-in analytics tracking and a developer-friendly API.

## Key Features

- **Type-Safe & Reliable**: Built with TypeScript for enhanced stability and better error handling
- **Developer Experience**: Comprehensive debugging tools and clear API documentation
- **Performance Optimized**: Fast loading times and efficient DOM updates
- **Analytics Integration**: Native support for GA4, GTM, and custom analytics platforms
- **Flexible Page Types**: Support for product pages, checkout, upsells, and receipt pages

## Quick Start

### Installation

Add the following code to your HTML page:

```html
<!-- Load Campaign Cart SDK -->
<script src="https://cdn.jsdelivr.net/gh/sellmore-co/campaign-cart@v0.2.28/dist/loader.js"></script>

<!-- Required: Your Campaign API Key -->
<meta name="next-api-key" content="your-api-key-here">

<!-- Optional: Enable debug mode during development -->
<meta name="next-debug" content="true">

<!-- Required: Define your page type -->
<meta name="next-page-type" content="product"> 
<!-- Options: product, checkout, upsell, receipt -->

<!-- Optional: Redirect URL after order completion -->
<meta name="next-next-url" content="/upsell">

<!-- Optional: Prevent back navigation (recommended for upsell pages) -->
<meta name="next-prevent-back-navigation" content="true">
```

### Configuration Meta Tags

| Tag | Required | Description |
|-----|----------|-------------|
| `next-api-key` | Yes | Your NextCommerce campaign API key |
| `next-page-type` | Yes | Page type: `product`, `checkout`, `upsell`, or `receipt` |
| `next-debug` | No | Enable debug mode with `"true"` |
| `next-next-url` | No | Redirect destination after order completion |
| `next-prevent-back-navigation` | No | Prevent back button navigation (useful for upsells) |

## Try It Out

Explore the SDK in action with our interactive playground:

**[Campaign Cart Playground](https://campaigns.nextcommerce.com/playground)**
