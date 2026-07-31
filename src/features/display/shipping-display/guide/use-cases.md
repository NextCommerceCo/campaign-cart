---
title: "Features/Display/Shipping Display/Use Cases"
group: "Features"
category: "Shipping Display"
---

# Use Cases

Situations where the page has to describe a delivery option the campaign offers — its
name, its cost, whether it is free.

## A "choose your delivery" list

> Effort: lightweight

**When:** Checkout offers standard, express, and overnight shipping, and each row has
to show that method's own name and price.

**Why this enhancer:** Each row declares its method once, and every binding inside the
row resolves against it — so the row is a plain template you repeat:

```html
<label data-next-shipping-id="1">
  <input type="radio" name="shipping">
  <span data-next-display="shipping.name">Standard</span>
  <span data-next-display="shipping.cost">—</span>
</label>

<label data-next-shipping-id="2">
  <input type="radio" name="shipping">
  <span data-next-display="shipping.name">Express</span>
  <span data-next-display="shipping.cost">—</span>
</label>
```

**Watch out for:** With no `data-next-shipping-id` on the binding or on any ancestor,
the feature warns `ShippingDisplayEnhancer requires data-next-shipping-id context`
and the element renders empty. A blank shipping price is nearly always a binding that
escaped its row — move it inside the element carrying the id, or put the id on the
binding itself.

---

## "Free" instead of "$0.00"

> Effort: lightweight

**When:** The cheapest option costs nothing, and the row should say so in words —
`$0.00` reads to a visitor like a charge they have to think about.

**Why this enhancer:** `isFree` is a separate value from the cost, so the word and the
number can be two elements and only one shows:

```html
<label data-next-shipping-id="1">
  <span data-next-display="shipping.name">Standard</span>
  <span data-next-display="shipping.isFree" data-hide-if-false="true">Free</span>
  <span data-next-display="shipping.cost" data-hide-if-zero="true">—</span>
</label>
```

**Watch out for:** `isFree` describes the **campaign's method**, not the visitor's
bill. A method that costs $9.99 but is being discounted to nothing in this cart still
reports `isFree` as false, so this row will disagree with the summary. Show
`cart.shipping` wherever the actual charge is stated.

---

## Advertising the delivery promise above the fold

> Effort: lightweight

**When:** The landing page headline says "Free standard shipping" and the copy should
be driven by the campaign rather than hard-coded, so changing the method in the admin
changes the page.

**Why this enhancer:** One wrapper carrying the method's id lets the whole block read
from the campaign:

```html
<p data-next-shipping-id="1">
  <span data-next-display="shipping.name">Standard</span> delivery —
  <span data-next-display="shipping.cost">—</span>
</p>
```

**Watch out for:** The id is the shipping method's `ref_id` in the campaign. If the
campaign has no method with that id, the feature warns
`Shipping method {shippingId} not found in campaign data` and the bindings stay at
their placeholders — so an id copied from another campaign fails silently on the
page. Check the ids against the campaign's shipping methods, and author a sensible
placeholder so a miss does not leave a hole in the sentence.

---

## When NOT to use this

### What the visitor is actually paying for shipping

**Why not:** These paths describe a method that exists in the campaign, chosen or
not, and they know nothing about shipping discounts — which apply to the cart.

**Use instead:**
[`cart-summary`](../../../cart/cart-summary/guide/overview.md) — `cart.shipping` for
the charge, and `cart.shippingDiscountAmount` for the reduction.

### Letting the visitor choose a method

**Why not:** This feature only describes options. It does not read the radio button,
and selecting a method does not change what it renders.

**Use instead:**
[`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — it owns
shipping-method selection and writes it to the cart.
