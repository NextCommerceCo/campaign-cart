# Attributes

## `data-next-action`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Must be set to `"accept-upsell"` to activate this enhancer. This is the trigger attribute that `AttributeScanner` uses to instantiate `AcceptUpsellEnhancer`.

---

## `data-next-package-id`

| | |
|---|---|
| Type | `number` |
| Required | yes (unless `data-next-selector-id` is set) |
| Default | — |

The numeric `ref_id` of the package to submit as an upsell. Used when the package is fixed and does not depend on a user selection.

If both `data-next-package-id` and `data-next-selector-id` are set, the selector value takes precedence when a selection has been made.

---

## `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | yes (unless `data-next-package-id` is set) |
| Default | — |

The ID of a `PackageSelectorEnhancer` container on the same page. The enhancer reads the current selection from that selector and submits it when the button is clicked.

The value must match the `data-next-selector-id` attribute on the selector container. The selector must have `data-next-upsell-context` set to prevent it from writing to the cart.

---

## `data-next-quantity`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

Number of units to submit. When a selector is linked, the selector's quantity overrides this value if a selection has been made.

**Valid values:** positive integer

---

## `data-next-url`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

The URL to navigate to after a successful upsell submission. Query parameters from the current page are appended automatically via `preserveQueryParams`.

If not set, the enhancer falls back to `<meta name="next-upsell-accept-url">` content. If neither is present, the loading overlay is dismissed and the page stays put.
