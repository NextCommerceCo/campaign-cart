# Logs

> This store logs under the prefix: `[CampaignStore]`

## Healthy output

When loading for the first time:

```
[CampaignStore] Fetching campaign data from API with currency: USD...
[CampaignStore] Campaign data cached for USD (10 minutes)
```

On a warm cache hit:

```
[CampaignStore] Using cached campaign data for USD (expires in 542 seconds)
```

---

## Info

### `Fetching campaign data from API with currency: {currency}...`

**When:** Cache miss or expired, or `forceFresh: true` was passed.

**Meaning:** Expected — a network request to the API is about to be made.

---

### `Using cached campaign data for {currency} (expires in {N} seconds)`

**When:** A valid cache entry exists for the requested currency.

**Meaning:** Expected — no network request will be made.

---

### `Campaign data cached for {currency} (10 minutes)`

**When:** A fresh API response was successfully written to sessionStorage.

**Meaning:** Expected — the cache is now warm for the next 10 minutes.

---

### `Spreedly environment key updated from campaign API: {key}`

**When:** The API response includes a `payment_env_key`.

**Meaning:** Expected — the payment SDK key has been updated in `configStore`.

---

### `No cache for {currency}, checking USD cache as potential fallback`

**When:** No cache entry for the requested currency; checking USD as fallback.

**Meaning:** Expected during currency detection on first load. If you see this on every load it may indicate the cache is not being written correctly.

---

### `Force fresh fetch requested, skipping cache for {currency}`

**When:** `loadCampaign` was called with `{ forceFresh: true }`.

**Meaning:** Expected — triggered by a user-initiated currency switch.

---

### `URL parameter forcing fresh fetch for currency: {currency} (cache had {currency|none})`

**When:** A `?currency=` URL parameter was present and the cache was for a different currency.

**Meaning:** Expected — the URL takes precedence over the cache.

---

### `Currency changed, refreshing cart prices...`

**When:** Post-fetch, the cart is non-empty and `cartStore.lastCurrency` differs from the actual fetched currency.

**Meaning:** Expected after a currency switch with items in the cart.

---

## Warn

### `Requested {currency} but using cached {actual} (fallback)`

**When:** A cached entry exists but for a different currency than requested.

**Meaning:** Expected — the store is using an available cache entry rather than fetching. The UI should reflect the actual currency via the `currency:fallback` event.

**Action:** If you see this unexpectedly, check that `configStore.selectedCurrency` is being set correctly before `loadCampaign` is called.

---

### `API Fallback: Requested {currency}, received {actual}`

**When:** The API returned a campaign in a currency different from what was requested.

**Meaning:** The campaign does not support the requested currency. The `currency:fallback` event is emitted and `configStore` is updated.

**Action:** No action needed unless the wrong currency is appearing in the UI — in that case check that your UI subscribes to `currency:fallback`.

---

## Debug

### `Removed cache: {key}`

**When:** `clearCache()` removed a specific sessionStorage entry.

**Meaning:** Expected during cache invalidation.

---

### `Cleared invalid cache for {currency}`

**When:** After an API fallback, the cache entry for the originally-requested currency is removed to prevent it from being served as a stale hit.

**Meaning:** Expected — housekeeping after a currency fallback.

---

## Error

### `Campaign load failed: {error}`

**When:** `loadCampaign` caught an unhandled exception (network error, API error, parsing failure).

**Meaning:** Fatal for the current load attempt. `state.error` is set and the error is re-thrown. The SDK will not function until `loadCampaign` succeeds.

**Action:** Check network connectivity, API key validity, and that the API returned a valid campaign payload.

---

### `Failed to clear campaign cache: {error}`

**When:** `clearCache()` encountered an error iterating sessionStorage.

**Meaning:** Recoverable — the fallback path clears known currency keys individually.

**Action:** Usually a browser security restriction. No action required unless cache is not being cleared.
