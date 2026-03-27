# Attributes

## `data-next-action`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Must be set to `"add-to-cart"`. This is the activation attribute — without it the enhancer is not instantiated.

---

## `data-next-package-id`

| | |
|---|---|
| Type | `number` (as string) |
| Required | no |
| Default | — |

The package `ref_id` to add to the cart on click. Use this for a button that always adds the same package regardless of any selector on the page.

Either `data-next-package-id` or `data-next-selector-id` must be set. If neither is set the button will never trigger a cart write.

---

## `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

The selector ID of a `PackageSelectorEnhancer` or `BundleSelectorEnhancer` on the page. When set, the button reads the current selection from that enhancer at click time and adds the selected package.

The button is disabled until the linked selector has an active selection.

Either `data-next-selector-id` or `data-next-package-id` must be set.

---

## `data-next-quantity`

| | |
|---|---|
| Type | `number` (as string) |
| Required | no |
| Default | `1` |

The quantity to add. When using `data-next-selector-id`, the quantity from the selector item takes precedence over this value if one is set on the selected card.

---

## `data-next-url`

| | |
|---|---|
| Type | `string` (URL) |
| Required | no |
| Default | — |

A URL to redirect to after a successful add-to-cart. Query parameters from the current page URL are preserved and appended to the redirect URL.

---

## `data-next-clear-cart`

| | |
|---|---|
| Type | `"true"` \| `"false"` |
| Required | no |
| Default | `"false"` |

When `"true"`, the entire cart is cleared before the new item is added. Use for single-item flows or "replace and buy" CTAs.

---

## `data-next-profile`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

A profile key to apply before the cart write. When set, `ProfileManager.applyProfile(key)` is called on click. This switches the active profile for the entire session.
