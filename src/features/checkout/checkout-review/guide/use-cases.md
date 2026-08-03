---
title: "Features/Checkout/Checkout Review/Use Cases"
group: "Features"
category: "Checkout Review"
---

# Use Cases

`checkout-review` is for showing the visitor what they have entered, back to them,
without asking them to move to another page. Below are the situations it fits, and
the ones it does not.

## A confirm-before-pay block on a one-page checkout

> Effort: lightweight

**When:** The checkout is a single page and the pay button sits at the bottom. You
want a short "shipping to" summary above it so the visitor can see the address they
typed without scrolling back up through the form.

**Why this enhancer:** Each slot names a checkout field and is rewritten as the
visitor types, so the summary cannot disagree with the form. The `address` and
`name` formats assemble a readable line out of several fields, which is what you
want here rather than echoing eight inputs one by one.

```html
<div data-next-enhancer="checkout-review">
  <p data-next-checkout-review="fname" data-next-format="name"
     data-next-fallback="Your name"></p>
  <p data-next-checkout-review="address1" data-next-format="address"
     data-next-fallback="No address yet"></p>
  <p data-next-checkout-review="email" data-next-fallback="No email yet"></p>
</div>
```

**Watch out for:** A slot whose field name does not match any
`data-next-checkout-field` on the form renders its fallback forever. The symptom is
one review row stuck on its placeholder while the rest update — which reads as a
data problem rather than a spelling one. Check the name against
[checkout-form's field names](../../../checkout/checkout-form/guide/reference/attributes.md),
and give every slot a `data-next-fallback` so an unfilled row is a sentence rather
than a gap in the layout.

---

## The final step of a multi-step checkout

> Effort: lightweight

**When:** Contact and address were collected on earlier pages and the last page
only takes payment. The visitor needs to see what those earlier steps captured
before they pay, because they cannot see those fields any more.

**Why this enhancer:** It reads the checkout store, which persists across the step
pages, so the last page can play back entries made two pages earlier with no extra
wiring. Dot paths reach values that are not plain form fields — the chosen delivery
option is `shippingMethod.name`, and the billing address fields sit under
`billingAddress`.

```html
<div data-next-enhancer="checkout-review">
  <p data-next-checkout-review="shippingMethod.name"
     data-next-fallback="No delivery method chosen"></p>
  <p data-next-checkout-review="billingAddress.city"
     data-next-fallback="Same as shipping"></p>
</div>
```

**Watch out for:** The block is turned on by the generic
`data-next-enhancer` attribute, whose value names the enhancer to attach. A typo
fails silently — the console warns `Unknown enhancer type: checkout-reveiw` and the
whole block stays empty, with no error on the page. If every slot is blank at once
rather than one of them, check that value first.

---

## When NOT to use this

### Showing the cart's line items and totals

**Why not:** This feature mirrors form entries, not the cart. Its `currency` format
is fixed to US dollars, so a campaign selling in another currency would show the
wrong symbol and the wrong grouping.

**Use instead:**
[`cart-summary`](../../../cart/cart-summary/guide/overview.md) for totals and
[`cart-item-list`](../../../cart/cart-item-list/guide/overview.md) for the lines —
both format money in the campaign's own currency.

### Letting the visitor correct something from the review

**Why not:** The review is read-only by design; it never writes to the form or the
order. An editable review would need its own validation, which would put a field's
rules in two places.

**Use instead:**
[`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — link the
visitor back to the input itself and let the form's validation stay the only copy.

### Summarising an order that has already been placed

**Why not:** After the order exists, the values live on the order rather than in
the checkout form, and a page reached after payment has no form for this feature to
mirror. Every slot renders its fallback.

**Use instead:**
[`order-display`](../../../display/order-display/guide/overview.md) — reads the
completed order, which is what a thank-you or upsell page has to work with.

### Hiding the review block until the visitor has filled something in

**Why not:** This feature always renders — an empty field shows its fallback and
gets the `next-review-empty` class, but the container itself stays visible.

**Use instead:**
[`conditional-display`](../../../display/conditional-display/guide/overview.md) —
wrap the block and give it a condition, so the section appears only when there is
something worth showing.
