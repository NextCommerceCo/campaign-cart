---
title: "State/Config/Overview"
group: "State"
category: "Config Store"
---

# useConfigStore

> Last reviewed: 2026-07-30
> Owner: platform

The config store holds how this particular page is set up: the API key every
request authenticates with, which stage of the funnel the page represents, how
payment and the address form behave, which analytics providers to feed, and the
country and currency the SDK detected for this visitor. It is the answer to "what
is this page allowed to do, and in what currency" — assembled at boot from the
page's own markup and loader script, then topped up by geo detection and the
campaign response. Field-by-field detail lives in
[reference/state-reference.md](./reference/state-reference.md).

## Concept

Two ideas carry the whole store.

**One: it is built at boot and never stored.** This is a plain Zustand
`create()` — no `persist`, no sessionStorage of its own. Every page load starts
from an empty config and layers sources on top of it, later layers winning:

```
initial defaults           (in config.state.ts)
      │
      ▼
loadFromWindow()           window.nextConfig — credentials, page type, payment,
      │                    maps, address, currency behaviour, price locale,
      │                    analytics, UTM
      ▼
loadFromMeta()             <meta name="next-*"> — API key, campaign id, debug,
      │                    clear-cart, page type, card-field key   ← meta WINS
      ▼
URL parameters             ?debugger=true forces debug: true
      │
      ▼
geo detection              detectedCountry / detectedCurrency / detectedIp /
      │                    locationData — only when currencyBehavior is 'auto'
      ▼
campaign response          payment_env_key overwrites spreedlyEnvironmentKey
```

The consequence is that every page of a funnel must declare its own
configuration. A value missing on step two means the meta tag or `window.nextConfig`
block is missing on that page — not that the config was lost. The single exception
is `selectedCurrency`, which the initializer and the campaign load mirror into
sessionStorage under `next_selected_currency` and read back at boot, so the
shopper's currency follows them through the funnel.

**Two: a large part of the interface is aspirational.** Fourteen fields are
declared with tidy defaults and read nowhere outside the debug panel. Setting one
looks like configuration and does nothing, which is the most expensive kind of
mistake here — so the type is not the contract. The per-field notes in the
[state reference](./reference/state-reference.md) say which fields are live.

## Business logic

- **`loadFromWindow()` runs first, `loadFromMeta()` second**, so a meta tag
  overrides the same key in the loader config. Each loader writes only the keys
  it actually finds, and `loadFromWindow` type-checks each one before accepting
  it, so a mistyped value is ignored rather than stored.
- **`loadFromMeta()` reads six tags only:** `next-api-key`, `next-campaign-id`,
  `next-debug`, `next-clear-cart`, `next-page-type`, and
  `next-spreedly-key` / `next-payment-env-key`. Nothing else in the markup is
  configuration.
- **The card-field block is accepted under three names** —
  `cardInputConfig`, then `spreedly`, then `spreedlyConfig` — and the first one
  present wins. Supplying two means the later ones are ignored. Likewise
  `paymentConfig` overrides `payment` when both are given.
- **The campaign's `payment_env_key` beats the meta tag.** Once the campaign
  loads, `setSpreedlyEnvironmentKey` overwrites whatever the markup supplied, so
  the hosted card fields authenticate against the campaign's gateway.
- **Geo and currency detection run only when `currencyBehavior` is exactly
  `'auto'`** — its default. Anything else, including an unset value, skips
  detection entirely and leaves `detectedCountry`, `detectedCurrency`,
  `detectedIp`, and `locationData` empty, at which point country pickers fall
  back to `US`.
- **Currency is read through `getCurrency()`**, which resolves
  `selectedCurrency`, then `detectedCurrency`, then `USD`. Reading the fields
  directly returns an empty string before detection settles, and an empty
  currency prices the cart in the campaign default.
- **`apiKey` is the campaign identity.** Requests authenticate with it alone, and
  it participates in cache validity — change the key and the cached campaign is
  treated as a different store's and refetched. See
  [the campaign store](../../campaign/guide/reference/state-reference.md).
- **`pageType` is reported to analytics as `page_type`**, so it decides which
  funnel step a page shows up as.
- **`clearCartOnInit` empties the cart during boot** on every load of a page
  carrying `<meta name="next-clear-cart" content="true">`, including a refresh.

## Decisions

- We rebuild the config on every page load rather than persisting it, because
  each page of a funnel declares its own page type, payment setup, and analytics
  — a stored config would carry the landing page's settings into checkout and
  mislabel the funnel.
- We let meta tags win over `window.nextConfig` rather than the reverse, because
  the loader script is shared across a campaign while the markup is per page, so
  a page needs a way to override the shared default. (The debug panel reloads the
  two in the opposite order, so a value it shows after a reload can differ from
  the one used at boot — an inconsistency, not an intent.)
- We gate detection on `currencyBehavior === 'auto'` rather than always detecting,
  because a store that prices in one currency must not have prices change under a
  visitor, and because detection costs a network call before the campaign loads.
- We mirror only `selectedCurrency` into sessionStorage rather than persisting the
  whole store, because currency is the one value here that is the shopper's
  choice rather than the page's declaration.
- We let the campaign response overwrite the card-field key rather than treating
  the meta tag as authoritative, because the key belongs to the campaign's
  payment gateway — a stale tag left on a page would otherwise break card entry
  after a gateway change.

## Limitations

- **Nothing here survives a page load.** Do not treat the store as a place to
  keep a value across pages. If it has to follow the visitor, write it to
  sessionStorage yourself the way `selectedCurrency` is mirrored under
  `next_selected_currency`.
- **Fourteen fields are declared but read nowhere outside the debug panel** —
  `autoInit`, `rateLimit`, `cacheTtl`, `retryAttempts`, `timeout`, `maxRetries`,
  `requestTimeout`, `enableAnalytics`, `enableDebugMode`, `environment`,
  `version`, `buildTimestamp`, `discounts`, and `tracking`. Setting them changes
  no behaviour. The live equivalents:
  - to switch analytics off, use `analytics.enabled: false` or
    `analytics.mode: 'disabled'` — not `enableAnalytics` or `tracking`;
  - to apply a discount, call `sdk.applyCoupon(code)` — not the `discounts`
    registry;
  - to control boot, control when the loader script runs — not `autoInit`.
- **It does not control campaign caching.** `cacheTtl` is ignored; the campaign
  cache uses a hard-coded 10-minute window declared in
  `state/campaign/api.slice.ts` and `state/campaign/items.slice.ts`. Changing the
  lifetime means changing that constant in both files.
- **`campaignId` does not select a campaign.** Nothing sends it — requests
  identify the campaign from `apiKey`. To point a page at a different campaign,
  change the API key.
- **It does not validate what it loads.** `pageType` is cast straight from the
  meta tag's content, so a typo is stored and reported to analytics as its own
  funnel step. Check the value in the debug panel if a page is missing from
  funnel reports.
- **Writing `debugger` does not open the debug overlay**, and writing `testMode`
  does not make an order a test order. The overlay reads `?debugger=true` and
  `window.nextConfig.debugger` itself, and test orders are decided by
  `core/test-mode.ts` and the checkout store.
- **`reset()` clears the API key with everything else**, leaving the page unable
  to load prices or place an order until the config is loaded again. It exists
  for tests, not for switching campaigns at runtime.
- **It does not own payment or address behaviour, only the settings for them.**
  How the express buttons and the address form act on `paymentConfig`,
  `addressConfig`, and `googleMapsConfig` lives with those features — see
  [express checkout](../../../features/checkout/express-checkout-container/guide/overview.md)
  and [the checkout form](../../../features/checkout/checkout-form/guide/overview.md).
