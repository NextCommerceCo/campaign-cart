---
title: "Features/Display/Quantity Text/Use Cases"
group: "Features"
category: "Quantity Text"
---

# Use Cases

Situations where a live quantity has to appear **inside a sentence**, so the wording
and the number cannot be separate elements.

## Offer copy that follows the quantity stepper

> Effort: lightweight

**When:** A post-purchase upsell offers a refill pack with a quantity stepper, and
the headline has to read "2 packs — get 6 pillowcases free" and rewrite itself as the
visitor steps up.

**Why this enhancer:** The whole sentence is the template. `{qty}` becomes the
current quantity and the arithmetic forms derive the rest, so one string holds the
copy and every number in it:

```html
<span data-next-quantity-text="{qty} packs — get {qty*3} pillowcases free"
      data-next-quantity-selector-id="refill"></span>
```

Supported forms are `{qty}`, `{qty*2}`, `{qty+1}`, and `{qty-1}`.

**Watch out for:** A token the feature does not recognise is rendered **literally** —
the visitor sees `{quantity}` printed on the page. The number token is `{qty}`. If a
sentence shows braces to a visitor, that is the cause.

---

## Wording that matches the number

> Effort: lightweight

**When:** "1 bottles" in a headline undermines the whole offer, and the copy has to
read correctly at every quantity.

**Why this enhancer:** A `{singular|plural}` token picks its form from the same
quantity, in the same string, so the two can never drift apart:

```html
<span data-next-quantity-text="{qty} {bottle|bottles} in your order"
      data-next-quantity-selector-id="refill"></span>
```

**Watch out for:** The singular form is chosen **only** when the quantity is exactly
1. At quantity 0 you get the plural — "0 bottles", which reads correctly, but do not
expect a special empty-state wording. If you need different copy at zero, wrap the
element in a
[`conditional-display`](../../../display/conditional-display/guide/overview.md)
condition and author two sentences.

---

## A sentence that sits away from the control it describes

> Effort: moderate

**When:** The stepper is inside the offer card, but the confirming sentence belongs
in a sticky bar at the bottom of the page.

**Why this enhancer:** Naming the quantity selector explicitly detaches the sentence
from its subject:

```html
<div data-next-upsell data-next-package-id="101">
  <!-- the offer's quantity control lives here -->
</div>

<div class="sticky-bar">
  <span data-next-quantity-text="You are adding {qty} {pack|packs}"
        data-next-quantity-selector-id="refill"></span>
</div>
```

**Watch out for:** With no `data-next-quantity-selector-id` and no enclosing
`data-next-package-id`, the feature has no subject to match against, so the quantity
stays at its starting value of 1 and the sentence never changes. The symptom is
copy that looks correct on load and then never moves. Either name the selector or
place the element inside the element carrying the package id.

---

## When NOT to use this

### A bare number with no words around it

**Why not:** This feature does no formatting — no thousands grouping, no currency,
no rounding. It substitutes a raw integer into a string.

**Use instead:**
[`display-core`](../../../display/display-core/guide/overview.md) —
`data-next-display` resolves and formats a value and needs no template.

### Copy that has to follow a cart line's quantity

**Why not:** The only quantity change this feature listens for is
`upsell:quantity-changed`, which the
[`upsell`](../../../order/upsell/guide/overview.md) feature emits. A quantity control
on a cart row does not update it, so the sentence silently freezes at its initial
value.

**Use instead:**
[`cart-summary`](../../../cart/cart-summary/guide/overview.md) — bind
`data-next-display="cart.quantity"` and write the surrounding words as ordinary
markup.
