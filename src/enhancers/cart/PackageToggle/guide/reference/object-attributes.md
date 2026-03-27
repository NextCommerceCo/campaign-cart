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
| `isPreSelected` | `boolean` | no | Whether the card is pending auto-add. Set to `false` after auto-add fires to prevent repeat adds. |
| `quantity` | `number` | no | The quantity to add to the cart. Dynamically recalculated in sync mode. |
| `isSyncMode` | `boolean` | no | `true` when `data-next-package-sync` is set. Quantity is derived from synced packages rather than a static value. |
| `syncPackageIds` | `number[]` | no | The list of `packageId` values whose quantities are summed to derive this card's quantity. Empty when `isSyncMode` is `false`. |
| `isUpsell` | `boolean` | no | `true` when the package should be classified as an upsell/bump line in the cart. |
| `stateContainer` | `HTMLElement` | no | The closest ancestor element that owns CSS class state (`next-in-cart`, `next-active`, etc.). Defaults to the card element itself when no container is found. |
| `addText` | `string` | yes | Label to show when the package is not in the cart. `null` if not configured. |
| `removeText` | `string` | yes | Label to show when the package is in the cart. `null` if not configured. |
