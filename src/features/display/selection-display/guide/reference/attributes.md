---
title: "Features/Display/Selection Display/Attributes"
group: "Features"
category: "Selection Display"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Shows what a selector currently has selected — its name, price, and savings — before it reaches the cart.

Turned on by `[data-next-display]`.

## `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Which selector's selection to show. Without it the feature walks up the DOM for the nearest enclosing selector, so an element inside a selector needs no configuration.

> **Watch out:** `data-selector-id` is accepted as an alias.

---

## `data-next-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Fallback identifier read from an enclosing cart selector that has no `data-next-selector-id`.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-cart-selector` | — | Marks the enclosing element as the cart selector to resolve against while walking up the DOM. |
| `data-next-package-id` | — | Read from the selected card to work out which package's values to show. |
| `data-next-selected` | — | Read from cards to find which one is currently selected when no selection event has fired yet — for example on a page that renders pre-selected. |
| `data-next-quantity` | — | Read from the selected card, so the price reflects that card's quantity. |
| `data-next-shipping-id` | — | Read from the selected card when the selection carries a shipping method. |

## Selection vs package vs cart

Three namespaces answer three different questions. Picking the wrong one is the
usual cause of a value that never updates:

| Use | When you want |
|---|---|
| `selection.*` | What the visitor has **picked but not yet added** — a live preview beside the selector |
| `package.*` | A **fixed** package's own values, regardless of any selection |
| `cart.*` | What is **actually in the cart** |

```html
<div data-next-package-selector data-next-selector-id="main">
  <!-- inside: the selector is inferred -->
  <p>You picked <span data-next-display="selection.name"></span>
     for <span data-next-display="selection.total"></span></p>
</div>

<!-- outside: name the selector -->
<span data-next-display="selection.total" data-next-selector-id="main"></span>
```

Modifiers (`data-next-format`, `data-hide-if-zero`, …) are documented once in
[display-core](../../../../display/display-core/guide/reference/attributes.md).
