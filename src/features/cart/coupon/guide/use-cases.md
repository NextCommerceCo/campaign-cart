---
title: "Features/Cart/Coupon/Use Cases"
group: "Features"
category: "Coupon"
---

# Use Cases

Where a discount-code box earns its place on a campaign page, and where another
feature does the job better. For what the feature is and how it works, start at
[overview.md](./overview.md).

## Discount-code box on the checkout page

> Effort: lightweight

**When:** The campaign runs promo codes — an affiliate code, a win-back code from
an email, a code support hands out on the phone — and the visitor needs somewhere
to type it before paying.

**Why this enhancer:** One container marked `data-next-coupon` turns an input and
a button into a working code box. It hands the code to the cart, clears the input
on success, blocks a second submit while the first is in flight, and prints the
outcome for the visitor. No JavaScript is written for any of it.

**Watch out for:** Without a `data-next-coupon="messages"` element on the page,
the outcome text has nowhere to go and is written to the browser console instead.
The visitor types a bad code, sees the input clear, and gets no explanation — the
page looks like it accepted the code. Add the messages element anywhere on the
page (it is found document-wide) and style
`coupon-message--success` / `--error` / `--info`; see
[reference/attributes.md](./reference/attributes.md).

---

## Applied codes shown as removable chips in the summary panel

> Effort: lightweight

**When:** The cart or checkout summary needs to show which codes are on the order,
each with its own "Remove" control — the pattern every store uses so the visitor
can back out of a code without reloading.

**Why this enhancer:** You write **one** coupon card in your markup and mark it
`data-template`. The feature hides that card, stamps out a copy per applied code,
fills `[pb-checkout="coupon-title"]` with the code, and wires
`[pb-checkout="coupon-remove"]` to remove that code. The list re-renders itself
whenever the applied codes change, including changes made from JavaScript.

**Watch out for:** The template is only recognised as a
`[pb-checkout="coupon-card"]` element **inside** the
`data-next-coupon="display"` area. Put it elsewhere, or name the card something
else, and no card ever renders — the visitor sees the success message but no chip,
and the only clue is the debug log `No display area or template found for coupons`
(see [reference/logs.md](./reference/logs.md)). Match the structure in
[reference/attributes.md](./reference/attributes.md), and turn on `?debug=true`
when a chip is missing.

---

## Adopting a coupon box that predates the SDK

> Effort: lightweight

**When:** An existing campaign page already has a styled coupon block — its own
input, its own button, its own classes — and it is being moved onto the SDK
without a redesign.

**Why this enhancer:** The parts are located by falling back through several
selectors rather than by one required attribute. An input marked
`os-checkout-field="coupon"`, or plainly the first text input in the container,
is found on its own, so adding `data-next-coupon` to the wrapper is usually the
whole migration.

**Watch out for:** The **first `<button>` inside the container wins**, even when
another element carries `data-next-coupon="apply"`. If the container also wraps a
"Continue" button that appears earlier in the markup, that button becomes the
apply trigger — clicking Continue applies the code and no longer continues,
because the feature calls `preventDefault()` on it. Keep the apply button as the
first (ideally the only) `<button>` inside the `data-next-coupon` container and
move unrelated buttons outside it.

---

## Auto-applying a code carried in the landing URL

> Effort: moderate

**When:** Traffic arrives from an ad or an email with the promo code already in
the link, and the visitor should not have to retype it — but should still see it
applied and be able to remove it.

**Why this enhancer:** Apply the code from JavaScript and let the coupon area
render it. The list of applied codes is driven by cart state, not by what was
typed, so a code applied through the SDK shows up as a chip with a working remove
button exactly like a typed one:

```js
window.nextReady.push(async () => {
  const code = new URLSearchParams(location.search).get('promo');
  if (code) {
    const { success, message } = await next.applyCoupon(code);
    if (!success) console.warn(message);
  }
});
```

**Watch out for:** Codes are stored upper-cased and trimmed, and removal is an
exact match. `next.applyCoupon('save10')` stores `SAVE10`, and a later
`next.removeCoupon('save10')` matches nothing and removes nothing, with no error
— the chip stays on screen. Pass the upper-cased code to `removeCoupon`, or read
the stored spelling back from `next.getCoupons()`. Apply the code after the cart
has items too: the discount is computed against the cart lines, so a code applied
to an empty cart changes no total.

---

## When NOT to use this

### Vouchers that belong to a bundle the visitor picks

**Why not:** A code listed in `data-next-bundle-vouchers` is applied and removed
automatically as bundles are selected. Applying the same code by hand as well
leaves the voucher in an unpredictable state — the two owners disagree about
whether it should be on the cart. This is a real conflict, not a preference; see
[relations.md](./relations.md).

**Use instead:** [`bundle-selector`](../../../cart/bundle-selector/guide/overview.md)
— it owns bundle-scoped vouchers end to end, applying and removing them with the
selection.

### Showing how much a code took off

**Why not:** This feature shows the code, never the amount. The discount lives in
the cart's totals, and the coupon area has no total in it.

**Use instead:** [`cart-summary`](../../../cart/cart-summary/guide/overview.md) —
its `data-next-discounts="voucher"` container renders a row per voucher discount
with the money on it. See
[its attributes](../../../cart/cart-summary/guide/reference/attributes.md).

### A second coupon box elsewhere on the same page

**Why not:** The display and message elements are resolved document-wide as a
fallback, so two coupon areas end up writing chips and messages into the same
targets. The symptom is chips appearing in the wrong panel, or a message
overwritten the moment the other box acts.

**Use instead:** Keep one coupon area per page, and mirror the applied state
elsewhere with [`cart-summary`](../../../cart/cart-summary/guide/overview.md)
rather than a second input.
