---
title: "State/Config/State Reference"
group: "State"
category: "Config Store"
---

# useConfigStore

<!-- Generated from the store manifest. Do not edit by hand:
     edit <store>.state-manifest.ts, then run `npm run docs:reference`. -->

Holds how this page is set up: the API key every request authenticates with, which funnel stage the page is, how payments and the address form behave, and the country and currency the SDK detected for this visitor.

**This store is not persisted.** `useConfigStore` is rebuilt on every page load, from meta tags and configuration rather than from storage. Individual values can still be restored by code elsewhere — the Survives column is per field, and it is the one to trust.

## Schema

The **Survives** column is the part that is invisible in the type: two fields can look identical and only one comes back after a refresh.

| Field | Type | Survives | Meaning |
|---|---|---|---|
| `apiKey` | `string` | transient — runtime only | The campaign API key every call to the campaign, cart-totals, and order endpoints authenticates with. Read from `<meta name="next-api-key">` or `window.nextConfig.apiKey`. An empty string means the SDK never found one, so no prices load and no order can be placed.<br>⚠️ It is also part of what makes the cached campaign valid: change the key and the cached campaign data is treated as belonging to a different store and refetched. Do not swap it at runtime expecting the current page to keep working. |
| `campaignId` | `string` | transient — runtime only | The campaign identifier from `<meta name="next-campaign-id">` or `window.nextConfig.campaignId`. Empty string means it was not supplied.<br>⚠️ Nothing in the SDK sends it — requests identify the campaign from `apiKey` alone, and this value only appears in the debug panel. Setting it does not point the page at a different campaign; change the API key for that. |
| `debug` | `boolean` | transient — runtime only | Whether verbose SDK logging is on. Turned on by `<meta name="next-debug" content="true">`, `window.nextConfig.debug`, or `?debugger=true` in the URL. False on a normal shopper visit. |
| `debugger` | `boolean \| undefined` | transient — runtime only | Whether the page was asked to show the on-page debug overlay. Starts as `false`, and is set from `window.nextConfig.debugger` at boot.<br>⚠️ The overlay decides for itself by reading `?debugger=true` and `window.nextConfig.debugger` directly, so writing this field at runtime does not open or close the overlay. |
| `pageType` | `PageType` | transient — runtime only | Which stage of the funnel this page is — `product`, `cart`, `checkout`, `upsell`, or `receipt`. Set from `<meta name="next-page-type">`. Analytics reports it as `page_type`, so a mislabelled page shows up in the wrong funnel step. |
| `storeName` | `string` | transient — runtime only | The shop's display name, supplied only through `window.nextConfig.storeName` and passed to the Facebook analytics adapter. `undefined` means events go out without a store name attached. |
| `spreedlyEnvironmentKey` | `string \| undefined` | transient — runtime only | The key that authorises the hosted credit-card fields. `undefined` means the card fields cannot start, so card payment is unavailable and only express or pay-later methods work.<br>⚠️ The meta tags `next-spreedly-key` / `next-payment-env-key` are a fallback only: once the campaign loads, its `payment_env_key` overwrites whatever was in the meta tag. If the card fields authenticate against an unexpected key, look at the campaign response before the page markup. |
| `paymentConfig` | `PaymentConfig` | transient — runtime only | How payment is offered on this page: which express-checkout methods appear and in what order, what they must validate first, and how the hosted card fields are laid out (`cardInputConfig`). An empty object means SDK defaults — card fields with standard formatting and no express-checkout restrictions.<br>⚠️ The card-field block is accepted under three names for backwards compatibility — `cardInputConfig`, `spreedly`, `spreedlyConfig` — and the first one present wins in that order. Supplying two of them means the later ones are ignored, which reads as "my styling did nothing". Inside `expressCheckout.methods`, name a method the way the rest of the SDK does — `apple_pay`, `google_pay`, matching the `methodOrder` beside it; `applePay`/`googlePay` are the older spellings and are still read, so a config written either way turns the same button on. **`expressCheckout` is only consulted when the campaign lists no express methods of its own** — `available_express_payment_methods` wins, so a method switched on here that the campaign does not offer shows nothing. |
| `googleMapsConfig` | `GoogleMapsConfig` | transient — runtime only | Address autocomplete through Google Maps: the Maps API key and whether autocomplete is enabled. An empty object, or one with no `apiKey`, means shoppers type their address by hand. |
| `addressConfig` | `AddressConfig` | transient — runtime only | Which countries the address form offers, the default country, and which state or territory options to hide. An empty object means the country list comes from the campaign's shipping countries. |
| `detectedCountry` | `string` | transient — runtime only | The visitor's country as geo-detection resolved it, as an ISO code. Empty string means detection did not run or failed — country pickers then fall back to `US`. |
| `detectedCurrency` | `string` | transient — runtime only | The currency of the detected country, before any override from the URL or a previous choice. Empty string means detection did not run. Compare it with `selectedCurrency` to see whether the shopper is being shown their local currency. |
| `detectedIp` | `string` | transient — runtime only | The visitor's IP address as the location service reported it. It is copied into attribution metadata as `user_ip` and travels with the order. Empty string means detection did not run, and the order carries no IP. |
| `selectedCurrency` | `string` | transient — runtime only | The currency prices are displayed and charged in. Empty string means nothing has been chosen, and `getCurrency()` falls back to `detectedCurrency` and then to `USD`.<br>⚠️ This is the one config value that follows the visitor between pages: it is mirrored into sessionStorage under `next_selected_currency` and read back at boot, so a currency chosen on the product page still applies on checkout and the receipt. Writing the field alone does not update that mirror — change currency through the SDK rather than by setting the field. |
| `locationData` | `any` | transient — runtime only | The whole geo-detection response kept as-is — detected country code, that country's config, its states, and the full country list — so the country and state pickers do not have to fetch again. `null` means detection has not run on this page. |
| `currencyBehavior` | `'auto' \| 'manual'` | transient — runtime only | Whether the SDK may switch currency to match the detected country (`auto`) or must leave the currency alone (`manual`).<br>⚠️ **Defaults to `auto`**, so location and currency detection runs unless something turns it off — setting it to `manual` leaves `detectedCountry`, `detectedCurrency`, `detectedIp`, and `locationData` empty. The gate tests for exactly `auto`, so any other value, including an explicit `undefined` written at runtime, behaves like `manual`. |
| `currencyFallbackOccurred` | `boolean` | transient — runtime only | True when the API could not serve the currency that was asked for and returned a different one — the signal that displayed prices are not in the currency the shopper picked. Reset to false on the next campaign load that honours the request. |
| `locale` | `string` | transient — runtime only | BCP 47 tag pinning how prices are written — `de-DE` renders `69,99 €` where `en-US` renders `€69.99`. Empty means follow the visitor's browser, which is the default.<br>⚠️ The **locale** decides the decimal separator and which side the currency symbol sits on; the currency code does not. So a EUR campaign still shows `€69.99` to an `en-US` browser, and that is a locale setting, not a currency bug. Set this only when a store must render identically for every visitor — a German shopper's browser already asks for `69,99 €`. An unparseable tag (`de_DE` with an underscore) is rejected at load with a warning and the browser locale is used, so a typo costs formatting, not the page. The debug overlay's locale picker still wins over this, so a pinned campaign can be previewed in other locales. |
| `storageScope` | `string` | transient — runtime only | Overrides the per-campaign suffix that keeps two campaigns on one origin from sharing a cart. Empty means the scope is derived from the API key and the page path, which is the default and is right for every campaign we host.<br>⚠️ It is read by `core/storage-scope.ts › storageScopeSuffix`, not by `loadFromWindow()`, because the storage modules are created before the config store loads — which is why it has to be set before the SDK script runs rather than merely before boot finishes. It is also the one key where `window.nextConfig` wins over the matching `<meta name="next-storage-scope">` tag; every other key resolves the other way round. The layout that needs it is a funnel whose pages sit at different depths, such as `/hu/` and `/hu/checkout`, which derive two different scopes and lose the cart between them. |
| `autoInit` | `boolean \| undefined` | transient — runtime only | Intended to say whether the SDK boots by itself. Defaults to true.<br>⚠️ Nothing outside the debug panel reads it — the SDK initialises regardless, so setting it to false does not stop boot. To control boot, control when the loader script runs. |
| `rateLimit` | `number \| undefined` | transient — runtime only | Intended ceiling on API requests per second. Defaults to 4.<br>⚠️ Display-only: no request path throttles on it, so changing it has no effect. |
| `cacheTtl` | `number \| undefined` | transient — runtime only | Intended cache lifetime in seconds for campaign data. Defaults to 300.<br>⚠️ The campaign cache uses its own hard-coded 10-minute window, so this value neither shortens nor extends caching. Change the constant in `state/campaign/` to change caching. |
| `retryAttempts` | `number \| undefined` | transient — runtime only | Intended number of retries for a failed request. Defaults to 3.<br>⚠️ The initializer counts its retries against its own internal limit, not this field, so raising it does not buy more retries. |
| `timeout` | `number \| undefined` | transient — runtime only | Intended request timeout in milliseconds. Defaults to 10000.<br>⚠️ Display-only: no request applies it. |
| `testMode` | `boolean \| undefined` | transient — runtime only | Whether the page is being used to place test orders. False for a real shopper.<br>⚠️ The debug panel toggles it, but the checkout submit path decides test mode from `core/test-mode.ts` and the checkout store instead — flipping this field alone does not make an order a test order. |
| `maxRetries` | `number \| undefined` | transient — runtime only | Intended retry ceiling for API calls. Defaults to 3.<br>⚠️ Unused outside the debug view; the initializer and the analytics adapters each carry their own limit. |
| `requestTimeout` | `number \| undefined` | transient — runtime only | Intended per-request timeout in milliseconds. Defaults to 30000.<br>⚠️ Nothing reads it. Treat it as reserved rather than as a working setting. |
| `enableAnalytics` | `boolean \| undefined` | transient — runtime only | Legacy master switch for analytics. Defaults to true.<br>⚠️ The analytics pipeline decides from `analytics.enabled` and `analytics.mode`, not from this field, so setting it to false does not stop tracking. Use `analytics.enabled: false`. |
| `enableDebugMode` | `boolean \| undefined` | transient — runtime only | Legacy debug switch. Defaults to false.<br>⚠️ Superseded by `debug` and the `?debugger=true` parameter; nothing reads this field. |
| `environment` | `'development' \| 'staging' \| 'production' \| undefined` | transient — runtime only | Which environment the page is labelled as — `development`, `staging`, or `production`. Defaults to `production` and appears in the debug panel.<br>⚠️ Purely a label: no behaviour, endpoint, or logging level changes with it. |
| `version` | `string \| undefined` | transient — runtime only | An optional version label for the page's configuration. `undefined` means none was supplied, which is the normal case.<br>⚠️ Not the SDK version — that is read from `window.__NEXT_SDK_VERSION__` and reported in attribution metadata. Nothing reads this field. |
| `buildTimestamp` | `string \| undefined` | transient — runtime only | An optional build stamp for the page's configuration. `undefined` means none was supplied.<br>⚠️ Nothing reads it. Reserved rather than working. |
| `discounts` | `Record<string, DiscountDefinition>` | transient — runtime only | Named discount definitions supplied through `window.nextConfig.discounts`, keyed by code. An empty object means none were declared.<br>⚠️ Discounts shown in the cart come from the totals API on each cart line, not from this registry, and no code path reads it. Declaring a discount here does not create one — apply a coupon with `sdk.applyCoupon(code)` instead. |
| `utmTransfer` | `{ enabled: boolean; applyToExternalLinks?: boolean; excludedDomains?: string[]; paramsToCopy?: string[]; }` | transient — runtime only | Whether UTM parameters are copied onto links as the visitor moves through the funnel, plus which parameters to copy and which domains to leave alone. `undefined` means links are left untouched and attribution is lost on the next click. |
| `tracking` | `'auto' \| 'manual' \| 'disabled'` | transient — runtime only | Legacy tracking mode — `auto`, `manual`, or `disabled`. Defaults to `auto`.<br>⚠️ Replaced by `analytics.mode`, which is what the pipeline actually reads. Setting `tracking: 'disabled'` does not disable tracking; set `analytics.enabled: false` or `analytics.mode: 'disabled'`. |
| `analytics` | `{ enabled: boolean; mode: 'auto' \| 'manual' \| 'disabled'; debug: boolean; providers: { gtm: { enabled: boolean; settings: { containerId?: string; dataLayerName?: string; environment?: string; }; }; facebook: { enabled: boolean; settings: { pixelId: string; accessToken?: string; testEventCode?: string; }; blockedEvents?: string[]; }; custom: { enabled: boolean; settings: { endpoint: string; apiKey?: string; batchSize?: number; timeout?: number; }; }; }; }` | transient — runtime only | The live analytics setup: whether tracking runs at all, whether events fire automatically (`mode: auto`) or only when the page asks (`manual`), whether to log every event, and the per-provider settings for GTM, Facebook, and a custom endpoint. `undefined` means analytics never starts — no events are sent.<br>⚠️ This is the block that counts. `enableAnalytics` and `tracking` are earlier attempts at the same switch and are ignored, so a page that sets only those sends nothing. |
| `clearCartOnInit` | `boolean` | transient — runtime only | Whether the cart is emptied when the SDK boots on this page. Set by `<meta name="next-clear-cart" content="true">`. Useful on a landing page that must always start from an empty cart.<br>⚠️ It runs on every load of that page, including a refresh mid-flow, so a shopper who reloads loses what they added. Do not put it on a page a shopper can come back to. |

New fields: a new field is never written to storage. It has to be populated on every page load — read it from a `<meta name="next-*">` tag in `loadFromMeta()` or from `window.nextConfig` in `loadFromWindow()`, otherwise it stays at its initial value forever. If the value must follow the visitor across pages, write it to sessionStorage yourself, the way `selectedCurrency` is mirrored under `next_selected_currency`.

## What you can do

### Direct writes

Set state without an API call. Nothing recalculates unless the effect says so.

| Call | Effect |
|---|---|
| `loadFromMeta()` | Reads the `<meta name="next-*">` tags — API key, campaign id, debug, clear-cart, page type, card-field key — and writes the ones that are present. Called by the SDK at boot; a page rarely calls it directly. |
| `loadFromWindow()` | Reads `window.nextConfig` and writes the keys it recognises: credentials, page type, payment, Google Maps, address, currency behaviour, discounts, analytics, and UTM transfer. Called by the SDK at boot, before `loadFromMeta()`. |
| `updateConfig(config)` | Merges the given keys into the config, leaving the rest alone. This is how location detection and currency selection write their results. |
| `setSpreedlyEnvironmentKey(key)` | Sets the hosted card-field key. Called when the campaign response carries a `payment_env_key`. |
| `reset()` | Returns every field to its initial value, including the API key. The page cannot talk to the API again until it is reloaded or the config is loaded afresh. |

### Reads

Lookups and derived values. None of these change state.

| Call | Effect |
|---|---|
| `getCurrency()` | The currency to price in: `selectedCurrency`, else `detectedCurrency`, else `USD`. Use it instead of reading the fields, so the fallback is applied consistently. |

## What the data looks like

```json
{
  "apiKey": "{YOUR_CAMPAIGN_API_KEY}",
  "campaignId": "",
  "debug": false,
  "pageType": "checkout",
  "spreedlyEnvironmentKey": "{PAYMENT_ENV_KEY}",
  "paymentConfig": {
    "expressCheckout": {
      "enabled": true,
      "methods": { "paypal": true, "apple_pay": true, "google_pay": true },
      "requireValidation": true,
      "requiredFields": ["email", "fname", "lname"],
      "methodOrder": ["paypal", "apple_pay", "google_pay"]
    }
  },
  "googleMapsConfig": { "apiKey": "{GOOGLE_MAPS_API_KEY}", "enableAutocomplete": true },
  "addressConfig": { "dontShowStates": ["AS", "GU", "PR", "VI"] },
  "currencyBehavior": "auto",
  "locale": "de-DE",
  "detectedCountry": "CA",
  "detectedCurrency": "CAD",
  "detectedIp": "203.0.113.42",
  "selectedCurrency": "CAD",
  "currencyFallbackOccurred": false,
  "analytics": {
    "enabled": true,
    "mode": "auto",
    "debug": false,
    "providers": {
      "gtm": { "enabled": true, "settings": { "containerId": "GTM-XXXXXXX" } },
      "facebook": { "enabled": false, "settings": { "pixelId": "" } },
      "custom": { "enabled": false, "settings": { "endpoint": "" } }
    }
  },
  "clearCartOnInit": false
}
```

## Cautions

- **Nothing in this store is stored, so every page load starts from the page itself.** If a value is missing on the second page of a funnel, the meta tag or `window.nextConfig` block is missing there — not "the config was lost". The one exception is `selectedCurrency`, which is mirrored into sessionStorage under `next_selected_currency` and restored at boot.
- **Meta tags win over `window.nextConfig` at boot.** The SDK calls `loadFromWindow()` first and `loadFromMeta()` second, so a stray `<meta name="next-api-key">` silently overrides the key in the loader config. Remove the meta tag rather than trying to override it from JavaScript. (The debug panel reloads them in the opposite order, so a value shown after a debug reload can differ from the one used at boot.)
- **Geo detection runs only when `currencyBehavior` is exactly `'auto'`.** Leave it unset and `detectedCountry`, `detectedCurrency`, `detectedIp`, and `locationData` stay empty while country pickers quietly fall back to `US`. Set it to `'auto'` if you want detection.
- **Several fields are declared but never read** — `autoInit`, `rateLimit`, `cacheTtl`, `retryAttempts`, `timeout`, `maxRetries`, `requestTimeout`, `enableAnalytics`, `enableDebugMode`, `environment`, `version`, `buildTimestamp`, `discounts`, and `tracking`. Setting them changes nothing while looking like it should, which is the most expensive kind of misconfiguration here. For analytics use the `analytics` block; for caching and retries change the code that owns them.
- **`getCurrency()` is the only safe way to read the currency.** Reading `selectedCurrency` directly returns an empty string before detection settles, and an empty currency sent to the totals API prices the cart in the campaign default rather than the shopper's currency.
- **A price in the right currency can still be written the wrong way.** `€69.99` versus `69,99 €` is decided by `locale`, not by the currency code, so switching a campaign to EUR does not by itself produce European formatting. Leave `locale` unset and each visitor's browser decides — usually correct. Set it only to force one format for everyone.
- **`reset()` clears the API key too.** Calling it mid-session leaves the page unable to load prices or place an order until the config is loaded again. It exists for tests, not for switching campaigns at runtime.
