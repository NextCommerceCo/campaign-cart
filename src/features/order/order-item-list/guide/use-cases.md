---
title: "Features/Order/Order Item List/Use Cases"
group: "Features"
category: "Order Item List"
---

# Use Cases

Where a list of purchased lines belongs on a post-purchase page, and which feature
to reach for when it does not. For what the feature is and how it renders, start at
[overview.md](./overview.md).

## Thank-you page that confirms what was bought

> Effort: lightweight

**When:** Payment went through and the visitor lands on the confirmation page. They
want to see the products, quantities, and prices they were charged for — the single
biggest driver of "did my order actually go through" support tickets.

**Why this enhancer:** An empty `data-next-order-items` container is the whole
setup. The order is fetched from the `ref_id` in the page URL, and the feature has
a built-in row template covering name, SKU, variant, quantity, unit price, and line
total — so a working receipt exists before anyone designs one.

**Watch out for:** Opened without `?ref_id` in the URL there is no order to render,
and the container falls back to its empty state — by default the text
`No items found in order`. That reads to a visitor as "your order is empty" when the
real cause is a link that dropped the parameter. Keep `ref_id` on every link into
this page, and word `data-empty-template` as a load failure with a support
route, not as an empty basket. Style `order-error` the same way; see
[reference/attributes.md](./reference/attributes.md).

---

## Receipt rows in the campaign's own design

> Effort: lightweight

**When:** The confirmation page is designed alongside the rest of the campaign —
its own row layout, its own type, an image per line — and the default rows do not
match it.

**Why this enhancer:** Point `data-item-template-id` at a `<template>` and write the
row once with `{item.*}` tokens. Money tokens come out already formatted in the
campaign's currency, so no formatting code is needed:

```html
<div data-next-order-items data-item-template-id="receipt-row"></div>

<template id="receipt-row">
  <div class="receipt-row">
    <img class="receipt-row__image" src="{item.image}" alt="{item.name}">
    <span class="receipt-row__name">{item.name}</span>
    <span class="receipt-row__qty">x{item.quantity}</span>
    <span class="receipt-row__total">{item.lineTotal}</span>
  </div>
</template>
```

**Watch out for:** A row template written for the cart list is not interchangeable
here. A token that exists on a cart line but not on an order line renders as an
empty string — no leftover `{token}`, no console warning — so you get
correctly-shaped rows with blank fields and nothing telling you why. Look every
field up in
[order display paths](../../../display/order-display/guide/reference/display-paths.md)
before reusing a cart template.

---

## Upsell page whose summary grows as offers are accepted

> Effort: moderate

**When:** After checkout the visitor is walked through post-purchase offers, and the
running summary beside the offer should show the new item the moment they accept it
— proof the offer was added to the order they already paid for.

**Why this enhancer:** The list follows the loaded order rather than rendering once.
Accepting a post-purchase offer replaces the order with the updated one from the
API, and the list re-renders with the extra line. Tokens `{item.upsellBadge}` and
`{item.showUpsell}` let the new line be labelled as an upsell rather than looking
like part of the original purchase.

**Watch out for:** Every re-render replaces the container's `innerHTML`, so a
listener, tooltip, or animation attached to a rendered row is destroyed the moment
an offer is accepted — the row is still on screen but nothing responds to it. Bind
on the container and let the event bubble from the row, never on the row itself.

---

## Receipt in a language other than English

> Effort: moderate

**When:** The campaign runs in a non-English market and every string on the
confirmation page is translated copy.

**Why this enhancer:** The row template and `data-empty-template` are both your
markup, so the purchased lines and the empty state carry your translated copy with
no string table in the SDK.

**Watch out for:** The in-flight and failure placeholders are **not** configurable —
while the order loads the container shows `Loading order items...`, and on a failed
load `Error loading order items`. The symptom is English text flashing on a German
or French receipt. Hide the container's own text while `order-loading` or
`order-error` is set and render your translated message from those same classes:

```css
[data-next-order-items].order-loading,
[data-next-order-items].order-error { visibility: hidden; }
```

---

## When NOT to use this

### Order number, totals, tax, shipping address

**Why not:** Those are single values on the order, not one row per line. This
feature only stamps out a template per line and shows no totals at all.

**Use instead:** [`order-display`](../../../display/order-display/guide/overview.md)
— binds any field of a loaded order, including every total, to an element.

### The list of items before the visitor pays

**Why not:** This feature reads a completed order fetched by reference. It never
looks at the cart, so it renders nothing on a pre-purchase page.

**Use instead:** [`cart-item-list`](../../../cart/cart-item-list/guide/overview.md)
— the same template idea, driven by the live cart.

### Presenting a post-purchase offer

**Why not:** This feature reports what the order already contains. It has no offer
to show, no accept action, and emits no events.

**Use instead:** [`upsell`](../../../order/upsell/guide/overview.md) for the offer
itself, or [`accept-upsell`](../../../cart/accept-upsell/guide/overview.md) for an
accept button that adds a package to the paid order.
