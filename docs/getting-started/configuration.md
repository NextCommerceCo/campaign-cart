# Configuration

Configure the Next Commerce JS SDK using meta tags in your HTML head.

## Configuration Options

| Meta Tag | Description | Values |
|-----------|-------------|---------|
| `next-api-key` | Your campaign API key | String |
| `next-next-url` | URL to redirect after order completion | URL path |
| `next-debug` | Enable debug mode | `true`/`false` |
| `next-page-type` | Current page type | `product`, `checkout`, `upsell`, `receipt` |
| `next-prevent-back-navigation` | Prevent browser back button | `true`/`false` |

## Basic Configuration

```html
<!-- Required: Campaign API Key -->
<meta name="next-api-key" content="your-api-key-here">
```

## Page Type Configuration

Set the page type to enable page-specific features:

```html
<!-- Product page -->
<meta name="next-page-type" content="product">

<!-- Checkout page -->
<meta name="next-page-type" content="checkout">

<!-- Upsell page -->
<meta name="next-page-type" content="upsell">

<!-- Receipt/confirmation page -->
<meta name="next-page-type" content="receipt">
```

## Upsell Configuration

Configure upsell flow URLs:

```html
<!-- Upsell URLs -->
<meta name="next-upsell-accept-url" content="/demo/receipt">
<meta name="next-upsell-decline-url" content="/demo/receipt">
```

## Debug Mode

Enable debug mode for development:

```html
<meta name="next-debug" content="true">
```

## Environment-Specific Configuration

TODO: Add information about environment-specific settings

---

## Advanced Configuration via `window.nextConfig`

For advanced setups, define `window.nextConfig` in a `<script>` tag **before** loading the SDK. This allows full control over payment, analytics, address, and more.

```html
<head>
  <script src="config.js"></script>
  <script src="https://campaign-cart-v2.pages.dev/loader.js"></script>
</head>
```

### Example

```js
window.nextConfig = {
  apiKey: "your-api-key-here",

  // ─── General ────────────────────────────────────────────────
  debug: false,
  pageType: "checkout",       // product | checkout | upsell | receipt
  storeName: "My Store",

  // ─── Payment ────────────────────────────────────────────────
  paymentConfig: {
    expressCheckout: {
      requireValidation: true,
      requiredFields: ["email", "fname", "lname"],
      methodOrder: ["paypal", "apple_pay", "google_pay"]
    }
  },

  // ─── Address / Shipping ─────────────────────────────────────
  addressConfig: {
    // Hide US territories from state dropdowns
    dontShowStates: ["AS", "GU", "PR", "VI"],
    // enableAutocomplete: true,  // Use NextCommerce autocomplete
  },

  // ─── Google Maps ────────────────────────────────────────────
  googleMaps: {
    apiKey: "your-google-maps-api-key",
    region: "US",
    enableAutocomplete: true
  },
};
```

### Configuration Reference

#### Top-Level Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `apiKey` | `string` | `""` | **Required.** Your campaign API key |
| `campaignId` | `string` | `""` | Campaign ID (optional override) |
| `debug` | `boolean` | `false` | Enable debug mode and overlay panel |
| `pageType` | `string` | `"product"` | Page type: `product`, `checkout`, `upsell`, `receipt` |
| `storeName` | `string` | — | Store display name |
| `tracking` | `string` | `"auto"` | Event tracking: `auto`, `manual`, `disabled` |
| `currencyBehavior` | `string` | `"auto"` | Currency switch on country change: `auto`, `manual` |
| `defaultProfile` | `string` | — | Profile ID to activate by default |
| `activeProfile` | `string` | — | Override the currently active profile |

#### `paymentConfig`

| Key | Type | Description |
|-----|------|-------------|
| `expressCheckout.requireValidation` | `boolean` | Validate fields before express checkout |
| `expressCheckout.requiredFields` | `string[]` | Fields required before express checkout |
| `expressCheckout.methodOrder` | `string[]` | Display order of express methods |

#### `addressConfig`

| Key | Type | Description |
|-----|------|-------------|
| `defaultCountry` | `string` | Fallback country code (low priority, rarely needed) |
| `dontShowStates` | `string[]` | State/territory codes to hide from dropdowns |
| `enableAutocomplete` | `boolean` | Enable NextCommerce address autocomplete |

> Countries are automatically loaded from the campaign API. The `showCountries` option is deprecated.

#### `googleMaps`

| Key | Type | Description |
|-----|------|-------------|
| `apiKey` | `string` | Google Maps API key |
| `region` | `string` | Default region code (e.g. `"US"`) |
| `enableAutocomplete` | `boolean` | Enable Google Maps Places autocomplete |

> **Autocomplete Provider Selection:**
> - To use **NextCommerce** Autocomplete: set `addressConfig.enableAutocomplete: true` (leave `googleMaps.apiKey` empty)
> - To use **Google Maps** Autocomplete: provide a valid `googleMaps.apiKey`
> - To **disable** Google Maps and use NextCommerce only: set `googleMaps.apiKey: ""`

### Loading Priority

Config is loaded in this order (highest to lowest):

1. `window.nextConfig`
2. Meta tags in `<head>`
3. Built-in defaults
