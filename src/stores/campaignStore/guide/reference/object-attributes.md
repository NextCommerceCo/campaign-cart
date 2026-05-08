# Object Attributes

## `CampaignState`

The reactive state shape exposed by the store. Access via `useCampaignStore.getState()`.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `data` | `Campaign` | yes | Full campaign object from the API. `null` before `loadCampaign` resolves or on error. |
| `packages` | `Package[]` | no | Flattened list of all packages on the campaign, post-processed with variant data. Empty array before load. |
| `isLoading` | `boolean` | no | `true` while `loadCampaign` is in flight. |
| `error` | `string` | yes | Error message if the last `loadCampaign` call failed. `null` on success. |
| `isFromCache` | `boolean` | yes | `true` if the current data was served from sessionStorage cache. |
| `cacheAge` | `number` | yes | Milliseconds since the cache entry was written. `0` for fresh fetches. |

---

## `Package`

A purchasable item on the campaign. Returned by `getPackage(refId)` and in the `packages` array.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `ref_id` | `number` | no | Primary SDK identifier. Used in `data-next-package-id`. |
| `name` | `string` | no | Display name of the package. |
| `price` | `string` | no | Current price as a decimal string (e.g. `"29.99"`). Currency matches `data.currency`. |
| `price_retail` | `string` | yes | Original/retail price for showing savings. `null` if no retail price is set. |
| `qty` | `number` | no | Quantity of product units in this package. |
| `product_id` | `number` | yes | Product ID if this package is linked to a product variant. `null` for non-variant packages. |
| `product_variant_id` | `number` | yes | Variant ID. `null` for non-variant packages. |
| `product_variant_attribute_values` | `VariantAttribute[]` | yes | Attribute list for this variant (e.g. color, size). Empty or null for non-variant packages. |
| `product` | `Product` | yes | Nested product/variant object populated by `processPackagesWithVariants`. `undefined` for non-variant packages. |

---

## `VariantGroup`

Returned by `getVariantsByProductId(productId)`. Groups all packages for a single product.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `productId` | `number` | no | Product ID. |
| `productName` | `string` | no | Display name of the product. |
| `attributeTypes` | `string[]` | no | List of attribute codes present across variants (e.g. `['color', 'size']`). |
| `variants` | array | no | One entry per package. Each entry includes `variantId`, `variantName`, `packageRefId`, `attributes`, `price`, and `availability`. |

---

## `CacheInfo`

Returned by `getCacheInfo()`. Describes the current cache state for the active campaign currency.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `cached` | `boolean` | no | `false` means no valid cache entry exists for the current currency. |
| `expiresIn` | `number` | yes | Seconds until cache expiry. Only present when `cached: true`. |
| `apiKey` | `string` | yes | The API key tied to the cache entry. Only present when `cached: true`. |
| `currency` | `string` | yes | The currency of the cache entry. Only present when `cached: true`. |
