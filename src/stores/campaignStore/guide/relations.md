# Relations

## Dependencies

- `ApiClient` (`@/api/client`) — used to call `/api/v1/campaigns/`. Imported dynamically inside `loadCampaign` to avoid circular deps.
- `configStore` — read for `selectedCurrency` / `detectedCurrency`; written to when a currency fallback occurs. Imported dynamically.
- `cartStore` — read after a successful fetch to detect currency changes and refresh cart prices. Imported dynamically.
- `sessionStorageManager` (`@/utils/storage`) — handles serialization and retrieval of the campaign cache.
- `EventBus` (`@/utils/events`) — emits `currency:fallback` when the API or cache returns a different currency than requested.

## Conflicts

- None. The campaign store is read-only from the perspective of all other stores and enhancers. No other store writes to it.

## Common combinations

- `useCampaignStore` + `useCartStore` — the most common pairing. Enhancers read campaign packages to build selection UI, then write to cartStore to add items.
- `useCampaignStore` + `configStore` — used together when currency selection affects which packages/prices are shown. `loadCampaign` syncs the two on every fetch.
- `useCampaignStore` + `PackageSelectorEnhancer` — the selector reads `getVariantsByProductId` and `getPackageByVariantSelection` to drive variant picker UI.
- `useCampaignStore` + `BundleSelectorEnhancer` — the bundle selector reads package groups by `ref_id` to build bundle option lists.
