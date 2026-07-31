---
title: "Features/Display/Order Display/Use Cases"
group: "Features"
category: "Order Display"
---

# Use Cases

Situations on a page that comes **after** payment — a receipt, a thank-you page, a
post-purchase upsell — where the page has to describe an order that already exists.

## The receipt header

> Effort: lightweight

**When:** A visitor lands on the thank-you page and needs to see their order number
and what they were charged.

**Why this enhancer:** The order is fetched for you from the `ref_id` in the page
URL, so a generic receipt page needs nothing but the bindings:

```html
<h1>Thanks — order <span data-next-display="order.number">—</span> is confirmed</h1>
<p>Total charged: <span data-next-display="order.total_incl_tax">—</span></p>
```

**Watch out for:** The order is kept for **15 minutes**. A receipt tab reopened the
next morning has nothing to render and every binding falls back to its placeholder —
that is the retention window doing its job, not a bug to chase. If you need the page
to work indefinitely, the visitor has to arrive with `?ref_id` again so the order can
be refetched.

---

## A waiting state and a failure state

> Effort: lightweight

**When:** The order arrives over the network, so on first paint there is nothing to
show. Without a waiting state the receipt flashes empty placeholders.

**Why this enhancer:** The namespace exposes the fetch's own status as paths, so the
states are markup rather than code:

```html
<div data-next-display="order.isLoading">Loading your order…</div>
<div data-next-display="order.hasError">We could not load your order.</div>
<div data-next-display="order.errorMessage"></div>
```

**Watch out for:** There is no retry. If the load fails, `order.hasError` stays true
for the rest of that page view, so your error copy must tell the visitor to reload
rather than implying the page will recover on its own. The `next-loaded` class,
added to a binding once the order has actually arrived, is the reliable signal that
what is on screen is real — style or assert against that rather than against the
rendered text.

---

## Confirming the delivery address back to the visitor

> Effort: lightweight

**When:** The thank-you page should repeat where the order is going, so a wrong
address gets reported while it can still be changed.

**Why this enhancer:** The address is already on the loaded order, as one composed
path or as separate lines:

```html
<address>
  <span data-next-display="order.customer.name">—</span><br>
  <span data-next-display="order.shippingAddress.full">—</span>
</address>
```

**Watch out for:** These are the values captured at purchase. They do not update if
the order is edited afterwards in the admin, because nothing refetches within the
page view.

---

## A post-purchase upsell page that knows what was bought

> Effort: moderate

**When:** After checkout you offer a one-click add-on, and the offer copy should
reference the original purchase — and should not appear at all for orders that
cannot take upsells.

**Why this enhancer:** `order.supports_upsells` and the `order.lines.*` summary
paths answer both questions without a second request:

```html
<div data-next-display="order.supports_upsells" data-hide-if-false="true">
  Add a refill to <span data-next-display="order.lines.mainProduct">your order</span>
</div>
```

**Watch out for:** `order.lines.mainProduct` is a summary of the order, not a list.
It gives you one product name — it cannot render each purchased line. For that, see
the alternative below.

---

## When NOT to use this

### Listing every line the visitor bought

**Why not:** These bindings each render one value into one element. A receipt table
is rows, and rows have to be generated.

**Use instead:**
[`order-item-list`](../../../order/order-item-list/guide/overview.md) — it renders
one row per purchased line from a template.

### Totals before the purchase happens

**Why not:** There is no order yet, and outside a post-purchase page there is no
`ref_id` in the URL for one to be loaded from. Every `order.*` binding stays at its
placeholder.

**Use instead:**
[`cart-summary`](../../../cart/cart-summary/guide/overview.md) — the `cart.*`
namespace for what the visitor is about to be charged.
