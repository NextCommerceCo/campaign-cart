---
title: "Features/Display/Product Display/Attributes"
group: "Features"
category: "Product Display"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Shows a campaign package's own name, price, and savings — before anything is in the cart.

Turned on by `[data-next-display]`.

## `data-next-multiply-quantity`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Scales the value by the quantity currently chosen, so a per-unit price reads as the pack total the visitor would actually pay.

---

## `data-next-quantity-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Which selector supplies that quantity, by id. Use it when the price sits outside the selector whose stepper drives it.

---

## `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Read from an enclosing selector so a price inside a card follows that card without being configured.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-upsell / data-next-upsell-quantity` | — | Read from an enclosing upsell offer, so a price shown inside an offer reflects the offer quantity rather than a cart line. |
| `data-container` | — | Read while walking up the DOM to find the element a price belongs to, for markup that groups a package without using a selector card. |

## Modifiers

Formatting and hiding work the same as for every display namespace —
`data-next-format`, `data-hide-if-zero`, `data-hide-if-false`,
`data-hide-zero-cents`, `data-multiply-by`, `data-divide-by`. They are
documented once in
[display-core](../../../../display/display-core/guide/reference/attributes.md).

The `campaign.` namespace is an alias for `package.` and resolves identically.

```html
<!-- A package's price, and its per-unit price -->
<span data-next-display="package.101.price"></span>
<span data-next-display="package.101.price" data-divide-by="3"></span>

<!-- Savings, hidden entirely when there are none -->
<span data-next-display="package.101.savingsAmount" data-hide-if-zero="true"></span>
```
