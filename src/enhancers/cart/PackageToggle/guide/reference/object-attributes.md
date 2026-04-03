# Object Attributes

## `PackageDef`

A single entry in the `data-next-packages` JSON array. Defines one card in auto-render mode.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `packageId` | `number` | no | The `ref_id` of the package this card represents. Must match a package in the campaign store. |
| `selected` | `boolean` | yes | `true` to pre-select (auto-add) this card on init. `null` / absent means not pre-selected. |
| `[key: string]` | `unknown` | yes | Any additional keys are available as `{toggle.<key>}` template variables. The enhancer coerces all values to strings. |

---

## `ToggleCard`

The internal state the enhancer holds for each registered card. Not directly accessible outside the enhancer, but its shape determines which attributes are read and how the card behaves.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `element` | `HTMLElement` | no | The DOM element the card is bound to. |
| `packageId` | `number` | no | The `ref_id` of the package this card represents. |
| `name` | `string` | no | Display name from the campaign package. Empty string when the package is not found in the campaign store. |
| `isPreSelected` | `boolean` | no | Whether the card is pending auto-add. Set to `false` after auto-add fires to prevent repeat adds. |
| `isSelected` | `boolean` | no | `true` when the package is currently in the cart. Updated on every cart sync. |
| `quantity` | `number` | no | The quantity to add to the cart. Dynamically recalculated in sync mode. |
| `isSyncMode` | `boolean` | no | `true` when `data-next-package-sync` is set. Quantity is derived from synced packages rather than a static value. |
| `syncPackageIds` | `number[]` | no | The list of `packageId` values whose quantities are summed to derive this card's quantity. Empty when `isSyncMode` is `false`. |
| `isUpsell` | `boolean` | no | `true` when the package should be classified as an upsell/bump line in the cart. |
| `stateContainer` | `HTMLElement` | no | The closest ancestor element that owns CSS class state (`next-in-cart`, `next-active`, etc.). Defaults to the card element itself when no container is found. |
| `addText` | `string` | yes | Label to show when the package is not in the cart. `null` if not configured. |
| `removeText` | `string` | yes | Label to show when the package is in the cart. `null` if not configured. |
| `togglePrice` | `TogglePriceSummary` | yes | Computed price state for the card. `null` until the first price fetch resolves. Used by `PackageToggleDisplayEnhancer` for `data-next-display="toggle.*"` bindings. |

---

## `TogglePriceSummary`

Computed pricing data for a toggle card. Populated after the first price fetch (or from the cart summary line when the package is in the cart).

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `price` | `number` | no | Total price for the card's quantity (unit price × quantity). |
| `unitPrice` | `number` | no | Per-unit price. |
| `originalPrice` | `number` | yes | Retail / compare-at total price. `null` when no compare price is available. |
| `originalUnitPrice` | `number` | yes | Retail / compare-at per-unit price. `null` when no compare price is available. |
| `discountAmount` | `number` | no | Savings amount (compare minus price). `0` when no discount applies. |
| `discountPercentage` | `number` | no | Savings as a percentage of the compare price (0–100). `0` when no discount applies. |
| `hasDiscount` | `boolean` | no | `true` when `discountAmount` is greater than zero. |
| `currency` | `string` | no | ISO 4217 currency code from the campaign store. |
| `isRecurring` | `boolean` | no | `true` when the package bills on a recurring schedule. |
| `recurringPrice` | `number` | yes | Recurring charge total (quantity-scaled). `null` when not recurring. |
| `interval` | `"day" \| "month"` | yes | Billing interval. `null` when not recurring. |
| `intervalCount` | `number` | yes | Number of intervals between billing cycles. `null` when not recurring. |
| `frequency` | `string` | no | Human-readable billing cadence: `"Per month"`, `"Every 3 months"`, `"One time"`. |
