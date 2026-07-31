---
title: "Features/Display/Conditional Display/Use Cases"
group: "Features"
category: "Conditional Display"
---

# Use Cases

Situations on a real campaign page where an element has to appear or disappear on
its own, without you writing a listener for it.

## Free-shipping and minimum-spend messaging

> Effort: lightweight

**When:** The page promises free shipping over a threshold, and the promise should
change into a confirmation the moment the cart crosses it.

**Why this enhancer:** The condition is re-evaluated on every cart change, so the
two messages swap themselves. No code listens to the cart:

```html
<p data-next-show="cart.total < 50">
  Spend $50 for free shipping.
</p>
<p data-next-show="cart.total >= 50">
  Free shipping unlocked.
</p>
```

**Watch out for:** A condition the parser cannot read is logged as
`Error evaluating condition:` under `ConditionalDisplayEnhancer` and **the element
is left visible**. The symptom is a banner that never goes away rather than one
that never appears — so a stuck message means checking the console, not the CSS.
Stay inside the supported operators (`==`, `!=`, `>`, `>=`, `<`, `<=`, `!`, `&&`,
`||`) listed in [reference/attributes.md](./reference/attributes.md).

---

## Empty-cart and filled-cart states in the same markup

> Effort: lightweight

**When:** A cart drawer needs an "your cart is empty" panel and a checkout button,
and exactly one of them should be on screen.

**Why this enhancer:** `data-next-hide` lets you write the readable direction of
each test instead of negating one condition twice:

```html
<div data-next-hide="cart.hasItems">Your cart is empty</div>
<a href="/checkout" data-next-show="cart.hasItems">Checkout</a>
```

**Watch out for:** Inside a cart-summary or bundle **row template**, these same two
attributes are evaluated by that template's row renderer instead — against the
row's own data — and this feature is never instantiated for them. The symptom is a
condition like `cart.hasItems` that silently does nothing inside a row. Keep
page-level conditions outside the template, and use the row paths documented in
[cart-summary](../../../cart/cart-summary/guide/overview.md) for per-row tests.

---

## A link that changes what the page shows

> Effort: lightweight

**When:** You want one URL for the client's preview, or a version of the page with
the free-shipping banner suppressed for paid traffic — without publishing a second
page.

**Why this enhancer:** The `param.` namespace tests URL query parameters, so the
link itself carries the switch:

```html
<!-- shown for ?preview=1 -->
<div data-next-show="param.preview">Preview mode — orders are not charged</div>

<!-- hidden for anyone arriving with ?banner=n -->
<div data-next-hide="param.banner == 'n'">Free shipping over $50</div>
```

**Watch out for:** Parameters are only readable after the SDK has processed the URL,
announced by `sdk:url-parameters-processed`. A `param.` condition evaluated before
that sees nothing, so an element gated on one can render in its authored state for
the first moment of the page. If that flash matters, author the element hidden in
CSS and let the condition reveal it. Changing a parameter from code with
`next.setParam()` re-evaluates every conditional that depends on it.

---

## Gating an add-to-cart button on a selection

> Effort: lightweight

**When:** A package selector starts with nothing chosen and the call to action
should not be clickable until the visitor picks something.

**Why this enhancer:** `selection.hasSelection` follows the selector's live choice,
and an element inside the selector needs no id at all:

```html
<div data-next-package-selector data-next-selector-id="main">
  <!-- selector cards here -->
  <button data-next-action="add-to-cart" data-next-show="selection.hasSelection">
    Add to cart
  </button>
</div>
```

**Watch out for:** A `selection.*` condition placed **outside** every selector logs
`Selection condition used but no selector context found` and has nothing to
resolve, so the element stays in its authored state. Fix it by naming the selector
on the element: `data-next-selector-id="main"`.

---

## When NOT to use this

### Showing a value, and hiding it only when it is zero or false

**Why not:** A discount row that should vanish at `$0.00` does not need a
condition — the display system already has a modifier for it, and one attribute is
less to keep in sync than a condition plus a binding.

**Use instead:** [`display-core`](../../../display/display-core/guide/overview.md) —
`data-hide-if-zero="true"` and `data-hide-if-false="true"` on the binding itself.

### Per-row conditions inside a cart summary or bundle template

**Why not:** This feature is not instantiated inside those templates. The row
renderer owns `data-next-show` and `data-next-hide` there, and it evaluates them
against a single row's data, so the page-level namespaces are not available.

**Use instead:** [`cart-summary`](../../../cart/cart-summary/guide/overview.md) —
its row template documents the data each row can be tested against.

### Hiding content from a particular kind of visitor

**Why not:** The profile system was removed in SDK 0.4.6.
`data-next-show-if-profile` and `data-next-hide-if-profile` are inert attributes
now — nothing manages the element, so content that was previously hidden renders
**visible** to everyone.

**Use instead:** nothing replaces the profile namespace. Delete the element, or
express the rule as a real condition over cart, selection, or `param.` state — for
example a `?vip=1` link instead of a visitor profile.
