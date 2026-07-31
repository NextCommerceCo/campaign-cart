---
title: "Features/Display/Conditional Display/Attributes"
group: "Features"
category: "Conditional Display"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Shows or hides an element based on a live condition — cart contents, totals, selection state, or a URL parameter.

Turned on by `[data-next-show]` — and equally by `[data-next-hide]`.

## `data-next-show`

| | |
|---|---|
| Type | `string (condition)` |
| Required | no |
| Default | — |

Shows the element while the condition is true and hides it otherwise, re-evaluating on every relevant change. Set either this or `data-next-hide`.

> **Watch out:** A condition that fails to parse is logged and the element is left visible, so a typo does not hide content silently.

---

## `data-next-hide`

| | |
|---|---|
| Type | `string (condition)` |
| Required | no |
| Default | — |

The inverse: hides the element while the condition is true. Use whichever reads more naturally — `hide="cart.isEmpty"` beats `show="!cart.isEmpty"`.

---

## `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Which selector a `selection.*` condition refers to. Without it the feature walks up the DOM to find the nearest enclosing selector, so this is only needed when the element sits outside one.

> **Watch out:** `data-selector-id` is accepted as an alias.

---

## `data-next-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Fallback identifier read from an enclosing cart selector when it has no `data-next-selector-id`.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-cart-selector` | — | Read while walking up the DOM: marks the enclosing element as the cart selector whose selection a `selection.*` condition should resolve against. |
| `data-next-shipping-id` | — | Read from an enclosing element so a condition can refer to the shipping method that element represents. |

## URL parameter conditions

Alongside the SDK's own state, a condition can test a **URL query parameter** with
the `param.` namespace. That is how a link can drive what a page shows — a
preview mode, a variant of the copy, a banner suppressed for paid traffic.

```html
<!-- ?preview=1 -->
<div data-next-show="param.preview">Preview mode</div>

<!-- ?mode=advanced -->
<div data-next-show="param.mode == 'advanced'">Advanced options</div>

<!-- ?banner=n  — hide for anyone arriving with it -->
<div data-next-hide="param.banner == 'n'">Free shipping over $50</div>

<!-- combined with cart state -->
<div data-next-show="param.vip && cart.total > 100">VIP bonus unlocked</div>
```

A bare `param.name` with no operator is a truthy check: it fires when the
parameter is present. `params.` is accepted as an alias for `param.`.

Parameters are read once the SDK has processed the URL, which is announced by
`sdk:url-parameters-processed` — a condition evaluated before that sees nothing.
To read or change them from code, use `next.getParam()`, `next.getAllParams()`,
`next.hasParam()`, and `next.setParam()`; setting one re-evaluates every
conditional that depends on it.

## Conditions

A condition is a path, optionally compared to a value. Paths use the same
namespaces as [`data-next-display`](../../../../display/display-core/guide/reference/attributes.md),
so anything you can show, you can also test.

```html
<!-- presence and emptiness -->
<div data-next-hide="cart.isEmpty">You have items in your cart</div>
<div data-next-show="cart.hasItems">Proceed to checkout</div>

<!-- comparisons -->
<div data-next-show="cart.total > 100">Free shipping unlocked</div>
<div data-next-show="cart.hasItem(101)">Your bundle includes the starter kit</div>

<!-- selection state, scoped to a selector -->
<div data-next-show="selection.hasSelection" data-next-selector-id="main">
  Ready to add
</div>
```

Supported operators: `==`, `!=`, `>`, `>=`, `<`, `<=`, and `!` for negation.
Conditions can be joined with `&&` and `||`.

**Inside a cart-summary or bundle template**, `data-next-show` and
`data-next-hide` are evaluated by that template's renderer instead, per row,
against the row's own data — this feature is not instantiated there. See
[cart-summary](../../../../cart/cart-summary/guide/reference/attributes.md).
