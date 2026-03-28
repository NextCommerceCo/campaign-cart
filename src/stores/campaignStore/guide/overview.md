# CampaignStore

> Last reviewed: 2026-03-28
> Owner: platform

The campaign store is the single source of truth for campaign and package data fetched from the 29Next Campaigns API. It owns the 10-minute sessionStorage cache, currency selection and fallback logic, and the package/variant query methods used throughout the SDK.

## Concept

When the SDK initializes, it calls `loadCampaign` once. The store fetches the campaign payload (packages, pricing, currency) from the API, caches the result in sessionStorage, and makes it available to every enhancer via `useCampaignStore`. On subsequent page loads within the 10-minute window the cache is used directly, keeping the page fast and the API load low.

Currency is negotiated at fetch time: the store requests the configured currency, accepts the API's actual response currency, and emits a `currency:fallback` event if they differ.

```
loadCampaign(apiKey) called
        │
        ▼
  sessionStorage cache hit?
  ┌─────┴──────┐
 YES           NO
  │             │
  ▼             ▼
serve cache   fetch API
  │             │
  └─────┬───────┘
        │
        ▼
process packages (variant mapping)
        │
        ▼
set state → enhancers subscribe & render
```

## Business logic

- Cache key is `{CAMPAIGN_STORAGE_KEY}_{currency}` (e.g. `next_campaign_USD`). One entry per currency.
- Cache expires after 10 minutes. Expired cache triggers a fresh API fetch.
- If the requested currency has no cache but USD does, the USD cache is used as a fallback — unless the currency was forced via URL param (`?currency=`) or `forceFresh: true`.
- If the API returns a different currency than requested, `configStore` is updated to reflect the actual currency, `next_selected_currency` in sessionStorage is corrected, and `currency:fallback` is emitted.
- After a successful fetch, if the cart is non-empty and its `lastCurrency` differs from the actual currency, cart prices are refreshed automatically.
- `processPackagesWithVariants` runs on every load (cache or API): it promotes flat product/variant fields on each package into a nested `product` object so enhancers can use a consistent shape.

## Decisions

- We store the full campaign payload per currency rather than a single entry because pricing differs between currencies and re-fetching on every currency switch would add latency.
- We use sessionStorage (not localStorage) so the cache is scoped to the browser tab and cleared when the user closes it — preventing stale pricing data from surfacing on new sessions.
- We chose dynamic `import()` for `configStore`, `cartStore`, and `ApiClient` inside `loadCampaign` to avoid circular dependencies at module load time.
- We fixed `getCacheInfo` to read the currency from the loaded campaign (`get().data?.currency`) rather than importing `configStore` synchronously via `require()`, eliminating the only CommonJS `require` in the codebase.
- Variant methods live in a separate slice (`campaignSlice.variants.ts`) because they add ~150 lines of read-only query logic that is distinct from core state mutations.

## Limitations

- Does not support multiple simultaneous campaigns — one API key, one campaign.
- Does not watch for cache expiry while the page is open; staleness is only detected at the next `loadCampaign` call.
- Package filtering by variant attribute assumes that `product_variant_attribute_values` is present on the package; packages without this field are treated as non-variant packages.
