# Object Attributes

## `SelectorItem`

Represents a registered card within the selector. Returned by `element._getSelectedItem()` and included in `selector:selection-changed` event payloads.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `element` | `HTMLElement` | no | The DOM element for the card (`[data-next-selector-card]`) |
| `packageId` | `number` | no | The `ref_id` of the package this card represents |
| `quantity` | `number` | no | Current quantity set on the card. Default is 1. Updated by inline quantity controls |
| `price` | `number` | yes | Per-unit price as fetched from the bundle price API. null until price fetch completes or if the fetch fails |
| `name` | `string` | yes | Package display name from the campaign store. null if the package is not found in campaign data |
| `isPreSelected` | `boolean` | no | true if the card had `data-next-selected="true"` at registration time |
| `shippingId` | `string` | yes | Value of `data-next-shipping-id` on the card. null if the attribute is absent |

---

## `PackageDef`

An entry in the `data-next-packages` JSON array used for auto-rendering. The enhancer uses this object to render a card via the configured template.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `packageId` | `number` | no | The `ref_id` of the package to render. Must exist in campaign data for name and price to populate |
| `selected` | `boolean` | yes | When true, the rendered card is pre-selected on init. null means not pre-selected |
| `[key: string]` | `unknown` | yes | Any extra key is exposed as `{package.key}` in the template. Use for custom badges, labels, or flags |

---

## Built-in template variables

When using auto-render, these variables are always available in the template regardless of what the package definition object contains. They are sourced from campaign store data for the given `packageId`.

| Variable | Source | Description |
|----------|--------|-------------|
| `{package.packageId}` | `PackageDef.packageId` | The package ref_id |
| `{package.name}` | Campaign store | Display name of the package |
| `{package.image}` | Campaign store | URL of the package image |
| `{package.price}` | Campaign store | Per-unit price from the campaign (not the live bundle price API) |
| `{package.priceRetail}` | Campaign store | Compare-at / retail price from the campaign |
| `{package.priceTotal}` | Campaign store | Campaign price × quantity from the package definition |

Custom keys from `PackageDef` are appended to this map and override built-in variables if names collide.

---

## `SelectorHandlerContext`

Internal context object passed from the main enhancer class to handler functions. Not part of the public API. Documented here for contributors modifying handler files.

| Field | Type | Description |
|-------|------|-------------|
| `selectorId` | `string` | The selector ID from `data-next-selector-id` |
| `mode` | `'swap' \| 'select'` | Current operating mode |
| `includeShipping` | `boolean` | Whether to include shipping in price fetches |
| `logger` | `Logger` | Scoped logger instance |
| `element` | `HTMLElement` | The selector container element |
| `emit` | `function` | Bound emit function from the enhancer |
| `selectedItemRef` | `{ value: SelectorItem \| null }` | Mutable ref tracking the currently selected item |
| `items` | `SelectorItem[]` | Array of all registered cards |
