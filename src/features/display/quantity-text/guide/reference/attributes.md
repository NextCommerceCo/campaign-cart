---
title: "Features/Display/Quantity Text/Attributes"
group: "Features"
category: "Quantity Text"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Writes a sentence that mentions a live quantity — "3 bottles selected" — and rewrites it as the quantity changes.

Turned on by `[data-next-quantity-text]`.

## `data-next-quantity-text`

| | |
|---|---|
| Type | `string (template)` |
| Required | yes |
| Default | — |

The sentence to render, with `{qty}` where the number belongs. Everything else is written out as-is, and it is re-rendered whenever the quantity it is watching changes. Three token forms are recognised — see **Tokens** below.

> **Watch out:** The token is `{qty}`, **not** `{quantity}`. An unrecognised token is not an error: it is written out literally, so `{quantity} bottles` reaches the visitor as the text "{quantity} bottles". Empty or missing, the feature logs `QuantityTextEnhancer requires data-next-quantity-text attribute` and renders nothing.

---

## `data-next-quantity-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Which quantity to watch, by selector id — for a sentence that tracks a selector card's stepper rather than a cart line.

---

## `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Read from an enclosing selector when the element sits inside one, so the sentence follows that selector without being told which.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-package-id` | — | Read from the nearest enclosing element that carries it, to work out which package's quantity the sentence is about. This is why a quantity-text inside a selector card or cart row needs no configuration. |
| `data-next-upsell / data-next-upsell-quantity` | — | Read from an enclosing upsell offer so the sentence reflects the offer quantity rather than a cart line. |

## Tokens

Three forms are substituted, in this order:

| Token | Renders | Example at quantity 2 |
|---|---|---|
| `{qty}` | the quantity itself | `2` |
| `{qty*3}`, `{qty+1}`, `{qty-1}` | arithmetic on the quantity | `6`, `3`, `1` |
| `{bottle\|bottles}` | the first word at quantity 1, the second otherwise | `bottles` |

Subtraction never goes below zero, so `{qty-5}` at quantity 2 renders `0` rather
than a negative number.

Combining them is where this feature earns its place over a plain number:

```html
<span data-next-quantity-text="{qty} {bottle|bottles}, and you get {qty*3} free"></span>
```

Anything else in braces is left alone and reaches the visitor as literal text —
there is no warning for a misspelled token.

## Example

```html
<!-- Inside a selector card: package id and selector are inferred -->
<div data-next-selector-card data-next-package-id="101">
  <span data-next-quantity-text="{qty} bottles selected"></span>
</div>

<!-- Standalone: name the selector to follow -->
<span data-next-quantity-text="You are buying {qty}"
      data-next-quantity-selector-id="main"></span>
```

For a bare number with no surrounding words, use
[`data-next-display`](../../../../display/display-core/guide/reference/attributes.md) instead —
it formats values and needs no template.
