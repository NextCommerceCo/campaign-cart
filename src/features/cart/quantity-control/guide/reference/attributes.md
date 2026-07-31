---
title: "Features/Cart/Quantity Control/Attributes"
group: "Features"
category: "Quantity Control"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Steps a cart line up or down, or sets it to an exact quantity from an input.

Turned on by `[data-next-quantity="increase"]`.

## `data-next-quantity`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Declares the mode of this control. Determines which DOM event is listened to and which cart store action is called.

**Valid values:**

- `increase` — Button that adds `step` to the current quantity. Listens to `click`.
- `decrease` — Button that subtracts `step` from the current quantity. Listens to `click`.
- `set` — Input or select element that accepts a quantity value directly. Listens to `change` and `blur`. Number inputs also listen to `input` for real-time clamping.

> **Watch out:** Any other value throws `Invalid value for data-next-quantity` and the control does not initialize.

---

## `data-package-id`

| | |
|---|---|
| Type | `number` |
| Required | yes |
| Default | — |

The numeric `ref_id` of the campaign package this control targets. Used to identify the matching cart item in the store.

When the element is rendered by `CartItemListEnhancer`, this attribute is set automatically from the item template. When used standalone, supply the `ref_id` directly.

> **Watch out:** Note the name: this one is `data-package-id`, without the `next` segment other attributes use.

---

## `data-step`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

How much to increase or decrease the quantity per click (for `increase`/`decrease` modes). Has no effect on `set` mode except for the `{step}` template token in button content.

**Valid values:** positive integer greater than 0

---

## `data-min`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `0` |

Minimum allowed quantity. The `decrease` button is disabled when the current quantity equals this value. For `set` mode, values below this are clamped to `min` on `change`/`blur`.

> **Watch out:** `data-min="0"` (the default) means quantity 0 is reachable, which removes the item from the cart. `data-min="1"` prevents removal through this control.

---

## `data-max`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `99` |

Maximum allowed quantity. The `increase` button is disabled when the current quantity equals this value. For `set` mode, values above this are clamped to `max` on `change`/`blur`.

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-quantity` | integer, `0` when the line is not in the cart | The line's current quantity in the cart, refreshed on every cart update. Read it in CSS or tests instead of parsing the button text. |
| `data-in-cart` | `true` / `false` | Whether this package currently has a line in the cart. |
| `disabled` | — | Present when the control cannot move further — at `data-max` for `increase`, at `data-min` for `decrease`. Not set in `set` mode. |
| `aria-disabled` | `true` / `false` | Mirrors `disabled` for assistive technology, so a disabled step button is announced rather than silently inert. |
| `data-original-content` | — | Snapshot of the element's initial `innerHTML`, captured once on first render. The template tokens below are re-substituted from this snapshot on every cart update, so the original markup is never lost. **Watch out:** Do not set or edit this yourself — overwriting it makes the token substitution render stale content. |
| `min / max / step` | — | On `set` mode inputs, the native input constraints are set from `data-min` / `data-max` / `data-step` so the browser stepper agrees with the enhancer. |

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `disabled` | — | Toggled alongside the `disabled` attribute, for styling the dead-end state. |
| `has-item` | — | The package has a line in the cart. |
| `empty` | — | The package has no line in the cart. |
| `processing` | — | A cart write triggered by this control is in flight. Use it to show a spinner or block double clicks. |

## Template tokens

Substituted inside the element's own content on every update.

| Name | Values | Meaning |
|---|---|---|
| `{quantity}` | — | Replaced with the line's current quantity everywhere it appears in the element's content. |
| `{step}` | — | Replaced with the resolved `data-step` value. |
