---
title: "Features/Order/Order Item List/Attributes"
group: "Features"
category: "Order Item List"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Renders one row per line of a completed order, from a template you supply — the receipt equivalent of the cart item list.

Turned on by `[data-next-order-items]`.

## `data-next-order-items`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | yes |
| Default | — |

Marks the element as the order line list. The order is loaded from the reference in the page URL, so a receipt page needs no further wiring.

---

## `data-item-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Id of an element whose `innerHTML` is the per-row template. Highest precedence of the four template sources.

---

## `data-item-template-selector`

| | |
|---|---|
| Type | `string (CSS selector)` |
| Required | no |
| Default | — |

Selector for the element whose `innerHTML` is the per-row template. Used when `data-item-template-id` is absent.

---

## `data-item-template`

| | |
|---|---|
| Type | `string (HTML)` |
| Required | no |
| Default | — |

The per-row template as an inline HTML string. Used when neither id nor selector is set.

---

## `data-empty-template`

| | |
|---|---|
| Type | `string (HTML)` |
| Required | no |
| Default | — |

What to render when the order has no lines — which in practice means the order failed to load rather than a genuinely empty purchase.

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `order-loading` | — | The order is still being fetched. Show a skeleton from this rather than assuming rows exist on first paint. |
| `order-has-items` | — | The order loaded and has at least one line. |
| `order-empty` | — | The order loaded with no lines. |
| `order-error` | — | The order could not be loaded. Pair it with a message, or the visitor sees an empty receipt with no explanation. |

## Example

```html
<div data-next-order-items data-item-template-id="order-row"></div>

<template id="order-row">
  <div class="order-row">
    <span>{item.name}</span>
    <span>{item.quantity}</span>
    <span>{item.price}</span>
  </div>
</template>
```

Row tokens come from the order line rather than a cart line, so a cart template is
not interchangeable with this one — the shapes differ. Look the fields up under
[order display paths](../../../../display/order-display/guide/reference/display-paths.md).

Like the cart item list, this replaces its `innerHTML` when the order arrives, so
do not attach listeners to a rendered row — bind on the container instead.
