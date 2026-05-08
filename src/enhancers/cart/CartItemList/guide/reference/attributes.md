# Attributes

## `data-next-cart-items`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes |
| Default | — |

Activation attribute. The SDK instantiates `CartItemListEnhancer` on any element that carries this attribute.

---

## `data-item-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

ID of a DOM element whose `innerHTML` is used as the per-item template. Takes precedence over `data-item-template-selector`, `data-item-template`, and the element's own `innerHTML`.

**Valid values:** any valid HTML element ID present in the document at initialization time.

---

## `data-item-template-selector`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

CSS selector for an element whose `innerHTML` is used as the per-item template. Used when `data-item-template-id` is not set.

**Valid values:** any CSS selector that resolves to exactly one element at initialization time.

---

## `data-item-template`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Inline HTML string used as the per-item template. Used when neither `data-item-template-id` nor `data-item-template-selector` is set.

---

## `data-empty-template`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `<div class="cart-empty">Your cart is empty</div>` |

HTML string rendered inside the element when the cart is empty.

---

## `data-title-map`

| | |
|---|---|
| Type | `string` (JSON) |
| Required | no |
| Default | — |

JSON object mapping package IDs (as strings or numbers) to custom display titles. Overrides the campaign-defined package name for `{item.name}` and `{item.title}` tokens.

**Valid values:** a JSON object where keys are package IDs and values are strings.

```html
<div data-next-cart-items data-title-map='{"42": "Main Product", "43": "Accessory"}'>
```

If the JSON is malformed, a warning is logged and the attribute is ignored.

---

## `data-group-items`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | absent (grouping disabled) |

When present, collapses multiple cart lines with the same `packageId` into a single rendered row with summed quantities. Grouping is display-only — the cart store is not modified.
