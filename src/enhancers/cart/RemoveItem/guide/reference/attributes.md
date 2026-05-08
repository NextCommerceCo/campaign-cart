# Attributes

## `data-next-remove-item`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes |
| Default | — |

Activates `RemoveItemEnhancer` on the element. No value required — presence is sufficient.

---

## `data-package-id`

| | |
|---|---|
| Type | `number` (integer string) |
| Required | yes |
| Default | — |

The campaign package `ref_id` to remove from the cart when clicked. Must match a valid package in the current campaign. Inside `CartItemListEnhancer` templates this is stamped automatically via `{item.packageId}`.

---

## `data-next-confirm`

| | |
|---|---|
| Type | `"true"` \| absent |
| Required | no |
| Default | absent (no confirmation) |

When set to `"true"`, a native browser `confirm()` dialog is shown before the removal API call is made. Any other value or absence skips the dialog.

---

## `data-next-confirm-message`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `"Are you sure you want to remove this item?"` |

Custom message shown in the confirmation dialog. Only used when `data-next-confirm="true"` is also present.

---

## `data-original-content` _(managed)_

| | |
|---|---|
| Type | `string` (HTML) |
| Required | no — set automatically |
| Default | — |

Stores the button's original `innerHTML` on first render. Used as the source template for `{quantity}` token replacement. Do not set this manually.

---

## `data-quantity` _(managed)_

| | |
|---|---|
| Type | `number` (integer string) |
| Required | no — set automatically |
| Default | — |

Reflects the current cart quantity for this package. Updated on every cart store change. Use for CSS attribute selectors (e.g., `[data-quantity="0"]`).

---

## `data-in-cart` _(managed)_

| | |
|---|---|
| Type | `"true"` \| `"false"` |
| Required | no — set automatically |
| Default | — |

`"true"` when the package is present in the cart; `"false"` otherwise. Updated on every cart store change. Use for CSS attribute selectors.
