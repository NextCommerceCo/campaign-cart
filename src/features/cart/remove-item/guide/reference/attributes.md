---
title: "Features/Cart/Remove Item/Attributes"
group: "Features"
category: "Remove Item"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Removes a line from the cart, optionally asking the visitor to confirm first.

Turned on by `[data-next-remove-item]`.

## `data-next-remove-item`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | yes |
| Default | — |

Turns the element into a remove button. Presence is enough — it takes no value.

---

## `data-package-id`

| | |
|---|---|
| Type | `number` |
| Required | yes |
| Default | — |

The package `ref_id` to remove when clicked. Inside a cart item list template this is stamped for you from `{item.packageId}`.

> **Watch out:** Note the name: `data-package-id`, without the `next` segment most attributes use.

---

## `data-next-confirm`

| | |
|---|---|
| Type | `'true'` |
| Required | no |
| Default | — |

Shows a native browser confirmation dialog before removing. Any other value, or leaving it off, removes immediately.

**Valid values:**

- `true` — Ask before removing.

---

## `data-next-confirm-message`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `Are you sure you want to remove this item?` |

The wording of the confirmation dialog. Only used when `data-next-confirm="true"` is also present.

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-quantity` | integer | The line's current quantity, refreshed on every cart change. Use it in CSS attribute selectors, e.g. `[data-quantity="0"]`. |
| `data-in-cart` | `true` / `false` | Whether this package currently has a line in the cart. |
| `data-original-content` | — | Snapshot of the button's initial `innerHTML`, taken on first render and used as the source for the `{quantity}` token below. **Watch out:** Do not set or edit this yourself — overwriting it makes the token substitution render stale content. |

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `has-item` | — | The package has a line in the cart. |
| `empty` | — | The package has no line in the cart. |
| `processing` | — | A cart write triggered by this button is in flight. |
| `removing` | — | The removal is underway. Use it to fade the row out before it disappears. |
| `item-removed` | — | The removal finished, for a brief post-removal state. |
| `disabled` | — | The button cannot act — there is nothing in the cart to remove. |

## Template tokens

Substituted inside the element's own content on every update.

| Name | Values | Meaning |
|---|---|---|
| `{quantity}` | — | Replaced with the line's current quantity anywhere it appears in the button's content. |
