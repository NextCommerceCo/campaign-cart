# Use Cases

## Displaying package pricing in an enhancer

> Effort: lightweight

**When:** An enhancer needs to read the price or name of a specific package to populate a UI element.

**Why this store:** `getPackage(refId)` gives direct access to any package by its `ref_id`. No API call needed — data is already in the store.

**Watch out for:** `data` is `null` before `loadCampaign` completes. Subscribe reactively with `this.subscribe(useCampaignStore, ...)` so the enhancer renders once data is available rather than on the constructor call.

---

## Rendering a variant picker (color/size selector)

> Effort: moderate

**When:** A product has multiple SKUs (e.g. a shirt in 3 colors and 2 sizes) and the user must select attributes before adding to cart.

**Why this store:** `getVariantsByProductId(productId)` returns all variants for a product grouped with their attribute lists. `getPackageByVariantSelection(productId, { color: 'Red', size: 'M' })` maps the selection back to a `packageRefId` for cart operations.

**Watch out for:** `getPackageByVariantSelection` returns `null` if no package matches the full set of selected attributes — ensure all attribute codes are selected before calling it.

---

## Currency switching

> Effort: moderate

**When:** The page supports multiple currencies and the user selects a new one from a dropdown.

**Why this store:** `loadCampaign(apiKey, { forceFresh: true })` bypasses the cache and fetches fresh pricing for the new currency. The store then updates `configStore` and emits `currency:fallback` if the API cannot serve the requested currency.

**Watch out for:** After `loadCampaign` resolves, call `cartStore.refreshItemPrices()` only if prices actually changed. The store does this automatically when `cartStore.lastCurrency` differs from the fetched currency — do not call it again manually.

---

## Debugging a cache miss on every page load

> Effort: lightweight

**When:** `loadCampaign` always hits the API even though the page was recently loaded, causing unnecessary network traffic.

**Why this store:** Use `getCacheInfo()` to inspect cache state:

```ts
console.log(useCampaignStore.getState().getCacheInfo());
// { cached: true, expiresIn: 542, apiKey: 'abc', currency: 'USD' }
```

**Watch out for:** The cache key includes the currency (`CAMPAIGN_STORAGE_KEY_USD`). If the configured currency differs from the cached currency, the cache lookup misses. Check `configStore.selectedCurrency` and `configStore.detectedCurrency`.

---

## When NOT to use this

### Storing cart-derived data (totals, quantities)

**Why not:** Cart state belongs in `cartStore`. The campaign store is read-only campaign/product data. Mixing them creates coupling that makes cart operations unreliable.

**Use instead:** `useCartStore` — owns all cart state and mutations.

### Fetching order or upsell data post-purchase

**Why not:** Post-purchase order data is served by a different API endpoint and has a different TTL. The campaign store does not know about order state.

**Use instead:** `useOrderStore` — owns post-purchase order and upsell data.
