---
title: "Features/Display/Display Core/Attributes"
group: "Features"
category: "Display Core"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Binds any element to a live value from the cart, campaign, order, or a selector — and formats it.

Turned on by `[data-next-display]`.

## `data-next-display`

| | |
|---|---|
| Type | `string (namespaced path)` |
| Required | yes |
| Default | — |

The value to show, written as `{namespace}.{path}` — for example `cart.total` or `package.101.price`. The namespace decides which part of the SDK answers; see **Namespaces** below. The element's text is replaced whenever that value changes, so you write no JavaScript to keep it current.

> **Watch out:** An unknown namespace means no feature is instantiated and the element never updates. Check the namespace table below if an element stays blank.

---

## `data-next-format`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `auto` |

How to render the value. `auto` infers from the value and the path — money paths format as currency, booleans as yes/no — so set this only when the inference is wrong.

**Valid values:**

- `currency` — Money, in the campaign's currency and locale.
- `number` — A plain number with locale grouping.
- `percentage` — A percentage.
- `boolean` — A true/false value.
- `date` — A date.
- `text` — Verbatim, no formatting.
- `auto` — Infer from the value and the path.

> **Watch out:** `data-format` is accepted as an alias for backward compatibility.

---

## `data-hide-if-zero`

| | |
|---|---|
| Type | `'true'` |
| Required | no |
| Default | — |

Hides the element when the value is zero. Use it for a savings or discount row that should disappear rather than read "$0.00".

---

## `data-hide-if-false`

| | |
|---|---|
| Type | `'true'` |
| Required | no |
| Default | — |

Hides the element when the value is false, for a badge that should be absent rather than showing "No".

---

## `data-hide-zero-cents`

| | |
|---|---|
| Type | `'true'` |
| Required | no |
| Default | — |

Renders a whole amount as `$49` instead of `$49.00`, while amounts with cents keep them.

---

## `data-multiply-by`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | — |

Multiplies the value before formatting — for showing a per-unit price as a pack total, or a rate as a percentage.

---

## `data-divide-by`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | — |

Divides the value before formatting — most often to show a per-unit price from a pack total.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-package` | — | Accepted as an alias of `data-next-package-id` when resolving which package an ancestor element stands for. Both this and `data-package-id` work; `data-next-package-id` is the spelling to use. |
| `data-next-cart-item-id` | — | Read from an enclosing element to resolve which cart line a binding is about, alongside `data-next-package-id`, `data-next-shipping-id`, and `data-next-selector-id`. **Watch out:** The cart item list renders rows with `data-cart-item-id` — **without** the `next` segment — so this context does not currently resolve inside its rows. Use `data-next-package-id`, which the same rows do carry, until the two names agree. |

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-format-debug` | — | A JSON snapshot of how the value was resolved and formatted, written when formatting could not produce a sensible result. Read it in devtools when an element shows the wrong thing. |

## Namespaces

The first segment of `data-next-display` selects which feature resolves the rest
of the path. The modifiers above work with all of them.

| Namespace | Resolves against | Reference |
|---|---|---|
| `cart.` / `cart-summary.` | The cart: totals, counts, shipping, discounts | [cart-summary](../../../../cart/cart-summary/guide/reference/attributes.md) |
| `package.` / `campaign.` | A campaign package's own fields and prices | [product-display](../../../../display/product-display/guide/reference/attributes.md) |
| `selection.` | What a selector currently has selected | [selection-display](../../../../display/selection-display/guide/reference/attributes.md) |
| `order.` | A completed order, on receipt and upsell pages | [order-display](../../../../display/order-display/guide/reference/attributes.md) |
| `shipping.` | A shipping method's name and cost | [shipping-display](../../../../display/shipping-display/guide/reference/attributes.md) |
| `selector.` | One card inside a package selector | [package-selector](../../../../cart/package-selector/guide/reference/attributes.md) |
| `bundle.` | A bundle selector's current bundle | [bundle-selector](../../../../cart/bundle-selector/guide/reference/attributes.md) |
| `toggle.` | One package toggle's state and price | [package-toggle](../../../../cart/package-toggle/guide/reference/attributes.md) |

```html
<span data-next-display="cart.total"></span>
<span data-next-display="cart.savingsAmount" data-hide-if-zero="true"></span>
<span data-next-display="package.101.price" data-divide-by="3"></span>
<span data-next-display="order.number"></span>
```
