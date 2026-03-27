# Attributes

## `data-next-quantity`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Declares the mode of this control. Determines which DOM event is listened to and which cart store action is called.

**Valid values:** `increase` / `decrease` / `set`

- `increase` — button that adds `step` to the current quantity. Listens to `click`.
- `decrease` — button that subtracts `step` from the current quantity. Listens to `click`.
- `set` — input or select element that accepts a quantity value directly. Listens to `change` and `blur`. Number inputs also listen to `input` for real-time clamping.

---

## `data-package-id`

| | |
|---|---|
| Type | `number` |
| Required | yes |
| Default | — |

The numeric `ref_id` of the campaign package this control targets. Used to identify the matching cart item in the store.

When the element is rendered by `CartItemListEnhancer`, this attribute is set automatically from the item template. When used standalone, supply the `ref_id` directly.

---

## `data-step`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

How much to increase or decrease the quantity per click (for `increase`/`decrease` modes). Has no effect on `set` mode except for the `{step}` template token in button content.

**Valid values:** positive integer greater than 0.

---

## `data-min`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `0` |

Minimum allowed quantity. The `decrease` button is disabled when the current quantity equals this value. For `set` mode, values below this are clamped to `min` on `change`/`blur`.

Setting `data-min="0"` (default) means quantity 0 is reachable, which removes the item from cart.
Setting `data-min="1"` prevents removal via this control.

---

## `data-max`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `99` |

Maximum allowed quantity. The `increase` button is disabled when the current quantity equals this value. For `set` mode, values above this are clamped to `max` on `change`/`blur`.

---
